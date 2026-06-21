import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, X, Calendar, ClipboardList, AlertTriangle, Settings, Clock } from 'lucide-react';
import { CrmNotification, NotificationSettings } from '../types';

interface NotificationCenterProps {
  notifications: CrmNotification[];
  unreadCount: number;
  settings: NotificationSettings;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDismiss: (id: string) => void;
  onUpdateSettings: (settings: NotificationSettings) => void;
  onNotificationClick?: (notification: CrmNotification) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  unreadCount,
  settings,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onUpdateSettings,
  onNotificationClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState<NotificationSettings>(settings);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getIcon = (notification: CrmNotification) => {
    switch (notification.type) {
      case 'meeting_reminder':
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'task_reminder':
        return <ClipboardList className="w-4 h-4 text-amber-500" />;
      case 'task_overdue':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (minutes < 1) return 'עכשיו';
    if (minutes < 60) return `לפני ${minutes} דק׳`;
    if (hours < 24) return `לפני ${hours} שע׳`;
    return `לפני ${days} ימים`;
  };

  const saveSettings = () => {
    onUpdateSettings(localSettings);
    setShowSettings(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => { setIsOpen(!isOpen); setShowSettings(false); }}
        className="relative p-1 sm:p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        title="התראות"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 sm:top-0 sm:right-0 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 animate-in zoom-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div style={{ left: 0, right: 'auto' }} className="absolute mt-2 w-80 sm:w-96 bg-white dark:bg-base-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 z-50 animate-in fade-in slide-in-from-top-1 overflow-hidden">
          {showSettings ? (
            /* ── Settings View ── */
            <div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">הגדרות התראות</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                {/* Enable/Disable */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700 dark:text-gray-300">הפעל התראות</span>
                  <input
                    type="checkbox"
                    checked={localSettings.enabled}
                    onChange={(e) => setLocalSettings({ ...localSettings, enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                </label>

                {/* Sound */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700 dark:text-gray-300">צליל התראה</span>
                  <input
                    type="checkbox"
                    checked={localSettings.soundEnabled !== false}
                    onChange={(e) => setLocalSettings({ ...localSettings, soundEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                    disabled={!localSettings.enabled}
                  />
                </label>

                {/* Meeting reminder minutes */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">תזכורת לפני פגישה (דקות)</span>
                  <select
                    value={localSettings.meetingReminderMinutes}
                    onChange={(e) => setLocalSettings({ ...localSettings, meetingReminderMinutes: Number(e.target.value) })}
                    className="text-sm rounded-lg border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-base-900 text-gray-700 dark:text-gray-300 px-2 py-1"
                    disabled={!localSettings.enabled}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={60}>60</option>
                    <option value={120}>120</option>
                  </select>
                </div>

                {/* Task reminder minutes */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">תזכורת לפני משימה (דקות)</span>
                  <select
                    value={localSettings.taskReminderMinutes}
                    onChange={(e) => setLocalSettings({ ...localSettings, taskReminderMinutes: Number(e.target.value) })}
                    className="text-sm rounded-lg border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-base-900 text-gray-700 dark:text-gray-300 px-2 py-1"
                    disabled={!localSettings.enabled}
                  >
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={60}>60</option>
                    <option value={120}>120</option>
                    <option value={240}>240</option>
                    <option value={480}>480</option>
                  </select>
                </div>

                {/* Overdue alerts */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700 dark:text-gray-300">התראות על משימות באיחור</span>
                  <input
                    type="checkbox"
                    checked={localSettings.overdueTaskAlerts}
                    onChange={(e) => setLocalSettings({ ...localSettings, overdueTaskAlerts: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                    disabled={!localSettings.enabled}
                  />
                </label>

                <button
                  onClick={saveSettings}
                  className="w-full py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
                >
                  שמור הגדרות
                </button>
              </div>
            </div>
          ) : (
            /* ── Notifications List View ── */
            <div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">התראות</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkAllAsRead}
                      className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                      title="סמן הכל כנקרא"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      סמן הכל
                    </button>
                  )}
                  <button
                    onClick={() => setShowSettings(true)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    title="הגדרות התראות"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Bell className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">אין התראות חדשות</p>
                  </div>
                ) : (
                  <div>
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer ${
                          !notif.read ? 'bg-primary/5 dark:bg-primary/10' : ''
                        }`}
                        onClick={() => {
                          if (!notif.read) onMarkAsRead(notif.id);
                          onNotificationClick?.(notif);
                        }}
                      >
                        <div className="mt-0.5 shrink-0">
                          {getIcon(notif)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
                              {notif.title}
                            </p>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.body}</p>
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(notif.triggerTime)}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismiss(notif.id);
                          }}
                          className="shrink-0 mt-0.5 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors"
                          title="הסר"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
