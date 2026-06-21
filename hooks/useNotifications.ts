import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { CrmNotification, NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS, Meeting, Task, Client } from '../types';
import { playNotificationSound } from '../utils/notificationSound';

const CHECK_INTERVAL_MS = 30_000; // check every 30 seconds
const CLEANUP_DAYS = 30;

export function useNotifications(
  effectiveUserId: string,
  userId: string,
  meetings: Meeting[],
  clients: Client[],
) {
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ── Load settings ──
  useEffect(() => {
    if (!effectiveUserId) return;
    const settingsRef = doc(db, 'users', effectiveUserId, 'settings', 'notifications');
    const unsub = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...snap.data() as NotificationSettings });
      } else {
        setSettings(DEFAULT_NOTIFICATION_SETTINGS);
      }
      setSettingsLoaded(true);
    });
    return unsub;
  }, [effectiveUserId]);

  // ── Load notifications (for this user only) ──
  useEffect(() => {
    if (!effectiveUserId || !userId) return;
    const colRef = collection(db, 'users', effectiveUserId, 'notifications');
    const unsub = onSnapshot(colRef, (snap) => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as CrmNotification))
        .filter(n => !n.dismissed)
        .sort((a, b) => b.triggerTime - a.triggerTime);
      setNotifications(all);
    });
    return unsub;
  }, [effectiveUserId, userId]);

  // ── Generate notifications for upcoming meetings & tasks ──
  useEffect(() => {
    if (!effectiveUserId || !settingsLoaded || !settings.enabled) return;

    // Collect all tasks from all clients
    const allTasks: { task: Task; clientId: string; clientName: string }[] = [];
    for (const client of clients) {
      for (const task of client.tasks || []) {
        if (!task.isCompleted && task.dueDate) {
          allTasks.push({ task, clientId: client.id, clientName: client.name });
        }
      }
    }

    const generateNotifications = async () => {
      const now = Date.now();
      const colRef = collection(db, 'users', effectiveUserId, 'notifications');

      // Get existing notification relatedIds to avoid duplicates
      // Only count non-dismissed notifications as "existing"
      const existingSnap = await getDocs(colRef);
      const existingKeys = new Set(
        existingSnap.docs
          .filter(d => !d.data().dismissed)
          .map(d => {
            const data = d.data();
            return `${data.type}:${data.relatedId}`;
          })
      );

      // Clean up dismissed notifications so they don't pile up
      for (const d of existingSnap.docs) {
        if (d.data().dismissed) {
          await deleteDoc(d.ref);
        }
      }

      const batch: Omit<CrmNotification, 'id'>[] = [];

      // Meeting reminders
      if (settings.meetingReminderMinutes > 0) {
        for (const meeting of meetings) {
          const startMs = new Date(meeting.startTime).getTime();
          const triggerTime = startMs - settings.meetingReminderMinutes * 60_000;
          const key = `meeting_reminder:${meeting.id}`;

          // Create if: trigger time has arrived, meeting hasn't ended yet, and doesn't already exist
          if (triggerTime <= now && startMs > now && !existingKeys.has(key)) {
            const client = clients.find(c => c.id === meeting.clientId);
            const minutesLeft = Math.round((startMs - now) / 60_000);
            batch.push({
              type: 'meeting_reminder',
              title: `תזכורת פגישה`,
              body: `${meeting.title}${client ? ` - ${client.name}` : ''} ${minutesLeft > 0 ? `בעוד ${minutesLeft} דקות` : 'מתחילה עכשיו'}`,
              relatedId: meeting.id,
              relatedType: 'meeting',
              clientId: meeting.clientId,
              triggerTime: Math.max(triggerTime, now),
              read: false,
              dismissed: false,
              browserNotified: false,
              createdAt: now,
            });
          }
        }
      }

      // Helper: parse dueDate which can be "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"
      const parseDueDate = (dueDate: string): { dueMs: number; dueDayEnd: number } => {
        if (dueDate.includes('T')) {
          // datetime-local format: use actual time
          const dueMs = new Date(dueDate).getTime();
          const dayStr = dueDate.split('T')[0];
          const dueDayEnd = new Date(dayStr + 'T23:59:59').getTime();
          return { dueMs, dueDayEnd };
        }
        // date-only: use end of day
        const dueDayEnd = new Date(dueDate + 'T23:59:59').getTime();
        return { dueMs: dueDayEnd, dueDayEnd };
      };

      // Task reminders — trigger when dueDate is today or upcoming within reminder window
      if (settings.taskReminderMinutes > 0) {
        for (const { task, clientId, clientName } of allTasks) {
          if (!task.dueDate) continue;
          const { dueMs, dueDayEnd } = parseDueDate(task.dueDate);
          const triggerTime = dueMs - settings.taskReminderMinutes * 60_000;
          const key = `task_reminder:${task.id}`;

          // Create if: trigger time has arrived, due date hasn't fully passed, and doesn't exist
          if (triggerTime <= now && dueDayEnd > now && !existingKeys.has(key)) {
            batch.push({
              type: 'task_reminder',
              title: `תזכורת משימה`,
              body: `${task.text}${clientName ? ` (${clientName})` : ''} - מועד יעד מתקרב`,
              relatedId: task.id,
              relatedType: 'task',
              clientId,
              triggerTime: Math.max(triggerTime, now),
              read: false,
              dismissed: false,
              browserNotified: false,
              createdAt: now,
            });
          }
        }
      }

      // Overdue task alerts
      if (settings.overdueTaskAlerts) {
        for (const { task, clientId, clientName } of allTasks) {
          if (!task.dueDate) continue;
          const { dueDayEnd } = parseDueDate(task.dueDate);
          const key = `task_overdue:${task.id}`;

          if (dueDayEnd < now && !existingKeys.has(key)) {
            const daysLate = Math.ceil((now - dueDayEnd) / (24 * 60 * 60_000));
            batch.push({
              type: 'task_overdue',
              title: `משימה באיחור`,
              body: `${task.text}${clientName ? ` (${clientName})` : ''} - באיחור של ${daysLate === 1 ? 'יום' : `${daysLate} ימים`}`,
              relatedId: task.id,
              relatedType: 'task',
              clientId,
              triggerTime: dueDayEnd,
              read: false,
              dismissed: false,
              browserNotified: false,
              createdAt: now,
            });
          }
        }
      }

      // Write new notifications
      for (const notif of batch) {
        await addDoc(colRef, notif);
      }

      // Cleanup old notifications (> 30 days)
      const cutoff = now - CLEANUP_DAYS * 24 * 60 * 60_000;
      for (const d of existingSnap.docs) {
        const data = d.data();
        if (data.createdAt && data.createdAt < cutoff) {
          await deleteDoc(d.ref);
        }
      }
    };

    generateNotifications();
    const interval = setInterval(generateNotifications, 5 * 60_000); // re-generate every 5 min
    return () => clearInterval(interval);
  }, [effectiveUserId, settingsLoaded, settings, meetings, clients]);

  // ── Check for triggered notifications & send browser alerts ──
  useEffect(() => {
    if (!settings.enabled) return;

    const checkAndNotify = async () => {
      const now = Date.now();
      for (const notif of notifications) {
        if (notif.triggerTime <= now && !notif.browserNotified && !notif.read) {
          if (settings.soundEnabled !== false) {
            playNotificationSound();
          }
          // Mark as browser-notified
          const notifRef = doc(db, 'users', effectiveUserId, 'notifications', notif.id);
          await updateDoc(notifRef, { browserNotified: true });
        }
      }
    };

    checkAndNotify();
    const interval = setInterval(checkAndNotify, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [notifications, settings, effectiveUserId]);

  // ── Actions ──
  const markAsRead = useCallback(async (notificationId: string) => {
    const ref = doc(db, 'users', effectiveUserId, 'notifications', notificationId);
    await updateDoc(ref, { read: true });
  }, [effectiveUserId]);

  const markAllAsRead = useCallback(async () => {
    for (const n of notifications.filter(n => !n.read)) {
      const ref = doc(db, 'users', effectiveUserId, 'notifications', n.id);
      await updateDoc(ref, { read: true });
    }
  }, [effectiveUserId, notifications]);

  const dismissNotification = useCallback(async (notificationId: string) => {
    const ref = doc(db, 'users', effectiveUserId, 'notifications', notificationId);
    await updateDoc(ref, { dismissed: true });
  }, [effectiveUserId]);

  const updateSettings = useCallback(async (newSettings: NotificationSettings) => {
    const ref = doc(db, 'users', effectiveUserId, 'settings', 'notifications');
    await setDoc(ref, newSettings);
  }, [effectiveUserId]);

  const unreadCount = notifications.filter(n => !n.read && n.triggerTime <= Date.now()).length;

  return {
    notifications: notifications.filter(n => n.triggerTime <= Date.now()),
    unreadCount,
    settings,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    updateSettings,
  };
}
