import React, { createContext, useContext, ReactNode, useCallback, useState, useEffect, useMemo } from 'react';
import { Client, CustomFieldDefinition, Automation, AutomationTrigger, StatusDefinition, LabelDefinition, CustomFieldType, LeadSource, ImportBatch, VisibilitySettings, DEFAULT_VISIBILITY_SETTINGS, Meeting, ConnectedCalendar, CrmDocument, DocumentContent, DocumentTemplate, UserPlan, PLAN_LIMITS, WhatsAppSettings, EmailSettings, EntityLabel, EntityLabels, getEntityLabels } from '../types';
import { db, auth } from '../firebaseConfig';
import { collection, onSnapshot, doc, addDoc, setDoc, deleteDoc, writeBatch, getDocs, getDoc, updateDoc, increment } from 'firebase/firestore';
import { api } from '../utils/apiClient';
import { normalizePhoneForGreenApi } from '../utils/phone';

// Maps an admin-blockable module key to its key in VisibilitySettings.
// A blocked module is treated as if its module toggle (`enabled`) were off,
// which hides it from the nav menu and the client card tabs.
const MODULE_TO_VISIBILITY_KEY: Record<string, keyof VisibilitySettings> = {
  meetings: 'meetings',
  tasks: 'tasks',
  whatsapp: 'whatsapp',
  ai: 'aiSummary',
  team: 'users',
  leadSources: 'leadSources',
  documents: 'documents',
};

// Migrate legacy automation documents (pre trigger/action union schema) to the
// current shape. Old shape: { name, triggerStatus, webhookUrl, method, fieldMapping }.
const migrateAutomation = (id: string, raw: any): Automation => {
  if (raw && raw.trigger && raw.action) {
    return { id, name: raw.name || '', enabled: raw.enabled !== false, trigger: raw.trigger, action: raw.action };
  }
  return {
    id,
    name: raw?.name || '',
    enabled: raw?.enabled !== false,
    trigger: { type: 'status_change', status: raw?.triggerStatus || '' },
    action: {
      type: 'webhook',
      url: raw?.webhookUrl || '',
      method: raw?.method || 'POST',
      fieldMapping: Array.isArray(raw?.fieldMapping) ? raw.fieldMapping : [],
    },
  };
};

export type AutomationTriggerEvent =
  | { type: 'status_change'; from: string; to: string }
  | { type: 'client_created' };

export interface TeamMember {
  id: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  joinedAt: number;
}

interface AppContextType {
  userId: string;
  effectiveUserId: string;
  isOwner: boolean;
  organizationId: string | null;
  clients: Client[];
  updateClient: (updatedClient: Partial<Client> & { id: string }) => Promise<void>;
  updateClientStatus: (clientId: string, newStatus: string) => Promise<void>;
  addClient: (newClient: Omit<Client, 'id'>) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  customFields: CustomFieldDefinition[];
  addCustomField: (field: Omit<CustomFieldDefinition, 'id' | 'order'>) => Promise<void>;
  updateCustomField: (field: CustomFieldDefinition) => Promise<void>;
  deleteCustomField: (fieldId: string) => Promise<void>;
  setCustomFieldsOrder: (fieldIds: string[]) => Promise<void>;
  automations: Automation[];
  addAutomation: (automation: Omit<Automation, 'id'>) => Promise<void>;
  updateAutomation: (automation: Automation) => Promise<void>;
  deleteAutomation: (automationId: string) => Promise<void>;
  triggerAutomations: (client: Client, event: AutomationTriggerEvent) => void;
  whatsappSettings: WhatsAppSettings | null;
  updateWhatsAppSettings: (settings: WhatsAppSettings) => Promise<void>;
  emailSettings: EmailSettings | null;
  updateEmailSettings: (settings: EmailSettings) => Promise<void>;
  statuses: StatusDefinition[];
  statusMap: Map<string, StatusDefinition>;
  addStatus: (name: string, color: string) => Promise<void>;
  updateStatus: (status: StatusDefinition) => Promise<void>;
  deleteStatus: (statusId: string) => Promise<void>;
  setStatusesOrder: (statusIds: string[]) => Promise<void>;
  labels: LabelDefinition[];
  labelMap: Map<string, LabelDefinition>;
  addLabel: (name: string, color: string, module?: 'client' | 'task') => Promise<void>;
  updateLabel: (label: LabelDefinition) => Promise<void>;
  deleteLabel: (labelId: string) => Promise<void>;
  leadSources: LeadSource[];
  addLeadSource: (name: string) => Promise<void>;
  updateLeadSource: (source: LeadSource) => Promise<void>;
  deleteLeadSource: (id: string) => Promise<void>;
  importHistory: ImportBatch[];
  bulkAddClients: (clients: Omit<Client, 'id'>[], fileName: string) => Promise<string[]>;
  undoImport: (batchId: string) => Promise<void>;
  teamMembers: TeamMember[];
  visibilitySettings: VisibilitySettings;
  updateVisibilitySettings: (settings: VisibilitySettings) => Promise<void>;
  isSyncing: boolean;
  isLoading: boolean;
  dbError: string | null;
  meetings: Meeting[];
  addMeeting: (meeting: Omit<Meeting, 'id' | 'googleEventIds'>) => Promise<void>;
  updateMeeting: (meeting: Meeting) => Promise<void>;
  deleteMeeting: (meetingId: string) => Promise<void>;
  connectedCalendars: ConnectedCalendar[];
  deleteConnectedCalendar: (calendarId: string) => Promise<void>;
  documents: CrmDocument[];
  addDocument: (doc: Omit<CrmDocument, 'id'>) => Promise<string>;
  updateDocument: (doc: CrmDocument) => Promise<void>;
  deleteDocument: (docId: string) => Promise<void>;
  documentTemplates: DocumentTemplate[];
  addDocumentTemplate: (template: Omit<DocumentTemplate, 'id'>) => Promise<void>;
  updateDocumentTemplate: (template: DocumentTemplate) => Promise<void>;
  deleteDocumentTemplate: (templateId: string) => Promise<void>;
  plan: UserPlan;
  entityLabel: EntityLabel;
  entityLabels: EntityLabels;
  blockedModules: string[];
  clientCount: number;
  fileCount: number;
  canCreateClient: boolean;
  canUploadFile: boolean;
  incrementFileCount: () => Promise<void>;
  logoUrl: string | null;
  updateLogoUrl: (url: string | null) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_STATUSES: Omit<StatusDefinition, 'id' | 'order'>[] = [
  // Order is critical: New -> In Progress -> Pending -> Finished
  { name: 'חדש', color: '#D5D8E3' },
  { name: 'בטיפול', color: '#1E5CC5' },
  { name: 'בהמתנה', color: '#EDB728' },
  { name: 'הסתיים', color: '#14BC88' },
];

const DEFAULT_LABELS: Omit<LabelDefinition, 'id'>[] = [
  // Client Tags
  { name: 'שירות', color: '#33E0FF', module: 'client' }, // Cyan
  { name: 'מכירות', color: '#8833FF', module: 'client' }, // Purple
];

const DEFAULT_FIELDS: Omit<CustomFieldDefinition, 'id' | 'order'>[] = [
  { name: 'טלפון', type: CustomFieldType.PHONE, showInGrid: true, showInList: true, showInCard: true },
  { name: 'אימייל', type: CustomFieldType.EMAIL, showInGrid: true, showInList: true, showInCard: true },
];

const userColl = (collectionName: string, userId: string) => collection(db, 'users', userId, collectionName);

export const AppProvider: React.FC<{ children: ReactNode; userId: string }> = ({ children, userId }) => {
  const [effectiveUserId, setEffectiveUserId] = useState<string>(userId);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const isOwner = userId === effectiveUserId;

  const [clients, setClients] = useState<Client[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [labels, setLabels] = useState<LabelDefinition[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [importHistory, setImportHistory] = useState<ImportBatch[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [visibilitySettings, setVisibilitySettings] = useState<VisibilitySettings>(DEFAULT_VISIBILITY_SETTINGS);
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppSettings | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [connectedCalendars, setConnectedCalendars] = useState<ConnectedCalendar[]>([]);
  const [documents, setDocuments] = useState<CrmDocument[]>([]);
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
  // Standalone single-customer: no plan tiers — everything is unlocked.
  const plan: UserPlan = 'active';
  const [entityLabel, setEntityLabel] = useState<EntityLabel>('clients');
  const entityLabels = useMemo(() => getEntityLabels(entityLabel), [entityLabel]);
  const [clientCount, setClientCount] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  // System logo URL (stored on the public config/owner doc). null => default.
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  // No admin-managed module blocking in the standalone build.
  const blockedModules: string[] = [];
  const effectiveVisibilitySettings = visibilitySettings;
  const [isSyncing, setIsSyncing] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const sortWithOrder = <T extends { order?: number }>(a: T, b: T) => (a.order ?? 999) - (b.order ?? 999);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      setIsSyncing(false);
      return;
    }

    const handleError = (err: any) => {
      console.error("Firestore Error:", err);
      if (err.code === 'permission-denied') {
        setDbError("אין הרשאות גישה ל-Firestore. בדוק את כללי האבטחה במסוף Firebase.");
      } else {
        setDbError(`שגיאת תקשורת עם מסד הנתונים: ${err.message}`)
      }
      setIsSyncing(false);
      setIsLoading(false);
    };

    const initializeAndListen = async () => {
      let aborted = false;
      setIsLoading(true);
      setDbError(null);

      try {
        // 1. Determine Effective User ID (Organization)
        let targetUserId = userId;

        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.organizationId) {
            targetUserId = userData.organizationId;
            setOrganizationId(userData.organizationId);
          }
        }

        setEffectiveUserId(targetUserId);

        // 2. Initialize Default Data (Only if Owner)
        if (userId === targetUserId) {
          const statusesSnap = await getDocs(userColl('statuses', targetUserId));
          if (aborted) return () => { };

          if (statusesSnap.empty) {
            const batch = writeBatch(db);
            DEFAULT_STATUSES.forEach((s, i) => batch.set(doc(userColl('statuses', targetUserId)), { ...s, order: i }));
            await batch.commit();
          } else {
            // Deduplicate statuses: if there are duplicate names, remove the extras
            const seenNames = new Map<string, string>(); // name -> first doc id
            const duplicateIds: string[] = [];
            statusesSnap.docs.forEach(d => {
              const name = d.data().name;
              if (seenNames.has(name)) {
                duplicateIds.push(d.id);
              } else {
                seenNames.set(name, d.id);
              }
            });
            if (duplicateIds.length > 0) {
              console.log(`[Dedup] Removing ${duplicateIds.length} duplicate statuses`);
              const batch = writeBatch(db);
              duplicateIds.forEach(id => batch.delete(doc(db, 'users', targetUserId, 'statuses', id)));
              await batch.commit();
            }
          }
          if (aborted) return () => { };

          const fieldsSnap = await getDocs(userColl('customFields', targetUserId));
          if (aborted) return () => { };

          if (fieldsSnap.empty) {
            const batch = writeBatch(db);
            DEFAULT_FIELDS.forEach((f, i) => batch.set(doc(userColl('customFields', targetUserId)), { ...f, order: i }));
            await batch.commit();
          } else {
            // Deduplicate custom fields
            const seenNames = new Map<string, string>();
            const duplicateIds: string[] = [];
            fieldsSnap.docs.forEach(d => {
              const name = d.data().name;
              if (seenNames.has(name)) {
                duplicateIds.push(d.id);
              } else {
                seenNames.set(name, d.id);
              }
            });
            if (duplicateIds.length > 0) {
              console.log(`[Dedup] Removing ${duplicateIds.length} duplicate custom fields`);
              const batch = writeBatch(db);
              duplicateIds.forEach(id => batch.delete(doc(db, 'users', targetUserId, 'customFields', id)));
              await batch.commit();
            }
          }
          if (aborted) return () => { };

          const labelsSnap = await getDocs(userColl('labels', targetUserId));
          if (aborted) return () => { };

          if (labelsSnap.empty) {
            const batch = writeBatch(db);
            DEFAULT_LABELS.forEach((l) => batch.set(doc(userColl('labels', targetUserId)), l));
            await batch.commit();
          } else {
            // Deduplicate labels
            const seenNames = new Map<string, string>();
            const duplicateIds: string[] = [];
            labelsSnap.docs.forEach(d => {
              const name = d.data().name;
              if (seenNames.has(name)) {
                duplicateIds.push(d.id);
              } else {
                seenNames.set(name, d.id);
              }
            });
            if (duplicateIds.length > 0) {
              console.log(`[Dedup] Removing ${duplicateIds.length} duplicate labels`);
              const batch = writeBatch(db);
              duplicateIds.forEach(id => batch.delete(doc(db, 'users', targetUserId, 'labels', id)));
              await batch.commit();
            }
          }
        }

        // Initialize visibility settings
        const visibilityDocRef = doc(db, 'users', targetUserId, 'settings', 'visibility');
        const visibilityDoc = await getDoc(visibilityDocRef);
        if (visibilityDoc.exists()) {
          setVisibilitySettings({ ...DEFAULT_VISIBILITY_SETTINGS, ...visibilityDoc.data() as VisibilitySettings });
        }

        // 2b. Listen to the owner doc for account-level settings (e.g. entityLabel).
        // No plan/blocked-modules gating in the standalone single-customer build.
        const userDocListener = onSnapshot(doc(db, 'users', targetUserId), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setEntityLabel((data.entityLabel as EntityLabel) || 'clients');
            setClientCount(data.clientCount || 0);
            setFileCount(data.fileCount || 0);
          }
        }, handleError);

        // 2c. Listen to the public branding config (system logo) so both the
        // app and the anonymous public share pages share one source of truth.
        const brandingListener = onSnapshot(doc(db, 'config', 'owner'), (snap) => {
          setLogoUrl(snap.exists() ? ((snap.data().logoUrl as string) || null) : null);
        }, handleError);

        // 3. Listen to Data
        const unsubscribers = [
          userDocListener,
          brandingListener,
          onSnapshot(userColl('statuses', targetUserId), snap => setStatuses(snap.docs.map(d => ({ id: d.id, ...d.data() } as StatusDefinition)).sort(sortWithOrder)), handleError),
          onSnapshot(userColl('clients', targetUserId), snap => { setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client))); setIsSyncing(false); }, handleError),
          onSnapshot(userColl('customFields', targetUserId), snap => setCustomFields(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomFieldDefinition)).sort(sortWithOrder)), handleError),
          onSnapshot(userColl('automations', targetUserId), snap => setAutomations(snap.docs.map(d => migrateAutomation(d.id, d.data()))), handleError),
          onSnapshot(doc(db, 'users', targetUserId, 'settings', 'whatsapp'), snap => {
            setWhatsappSettings(snap.exists() ? (snap.data() as WhatsAppSettings) : null);
          }, handleError),
          onSnapshot(doc(db, 'users', targetUserId, 'settings', 'email'), snap => {
            setEmailSettings(snap.exists() ? (snap.data() as EmailSettings) : null);
          }, handleError),
          onSnapshot(userColl('labels', targetUserId), snap => setLabels(snap.docs.map(d => ({ id: d.id, ...d.data() } as LabelDefinition))), handleError),
          onSnapshot(userColl('leadSources', targetUserId), snap => setLeadSources(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeadSource))), handleError),
          onSnapshot(userColl('importHistory', targetUserId), snap => setImportHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as ImportBatch)).sort((a, b) => b.timestamp - a.timestamp)), handleError),
          onSnapshot(userColl('meetings', targetUserId), snap => setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting))), handleError),
          onSnapshot(userColl('connectedCalendars', targetUserId), snap => setConnectedCalendars(snap.docs.map(d => ({ id: d.id, ...d.data() } as ConnectedCalendar))), handleError),
          onSnapshot(userColl('documents', targetUserId), snap => setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CrmDocument)).sort((a, b) => b.createdAt - a.createdAt)), handleError),
          onSnapshot(userColl('documentTemplates', targetUserId), snap => setDocumentTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentTemplate)).sort((a, b) => b.createdAt - a.createdAt)), handleError),
        ];

        // Listen to team_members for assignee data
        if (userId === targetUserId) {
          // Owner: listen to own team_members
          unsubscribers.push(
            onSnapshot(userColl('team_members', targetUserId), async snap => {
              const members: TeamMember[] = [];
              for (const d of snap.docs) {
                const data = d.data();
                // Try to get display name and photo from the member's user profile
                let displayName = data.displayName || data.email?.split('@')[0] || '';
                let photoUrl = data.photoUrl || '';
                try {
                  const memberProfileDoc = await getDoc(doc(db, 'users', d.id));
                  if (memberProfileDoc.exists()) {
                    const profile = memberProfileDoc.data();
                    displayName = profile.displayName || displayName;
                    photoUrl = profile.photoUrl || photoUrl;
                  }
                } catch { /* ignore */ }
                members.push({ id: d.id, email: data.email, displayName, photoUrl, joinedAt: data.joinedAt });
              }
              // Add owner to team members list
              const currentUser = auth.currentUser;
              if (currentUser) {
                let ownerPhoto = currentUser.photoURL || '';
                let ownerName = currentUser.displayName || currentUser.email?.split('@')[0] || '';
                try {
                  const ownerProfileDoc = await getDoc(doc(db, 'users', targetUserId));
                  if (ownerProfileDoc.exists()) {
                    const profile = ownerProfileDoc.data();
                    ownerPhoto = profile.photoUrl || ownerPhoto;
                    ownerName = profile.displayName || ownerName;
                  }
                } catch { /* ignore */ }
                members.unshift({ id: targetUserId, email: currentUser.email || '', displayName: ownerName, photoUrl: ownerPhoto, joinedAt: 0 });
              }
              setTeamMembers(members);
            }, handleError)
          );
        } else {
          // Team member: load owner + other team members
          try {
            const membersSnap = await getDocs(userColl('team_members', targetUserId));
            const members: TeamMember[] = [];
            for (const d of membersSnap.docs) {
              const data = d.data();
              let displayName = data.displayName || data.email?.split('@')[0] || '';
              let photoUrl = data.photoUrl || '';
              try {
                const memberProfileDoc = await getDoc(doc(db, 'users', d.id));
                if (memberProfileDoc.exists()) {
                  const profile = memberProfileDoc.data();
                  displayName = profile.displayName || displayName;
                  photoUrl = profile.photoUrl || photoUrl;
                }
              } catch { /* ignore */ }
              members.push({ id: d.id, email: data.email, displayName, photoUrl, joinedAt: data.joinedAt });
            }
            // Add owner
            try {
              const ownerProfileDoc = await getDoc(doc(db, 'users', targetUserId));
              if (ownerProfileDoc.exists()) {
                const profile = ownerProfileDoc.data();
                members.unshift({
                  id: targetUserId,
                  email: profile.email || '',
                  displayName: profile.displayName || profile.email?.split('@')[0] || 'מנהל',
                  photoUrl: profile.photoUrl || '',
                  joinedAt: 0,
                });
              }
            } catch { /* ignore */ }
            setTeamMembers(members);
          } catch { /* ignore */ }
        }

        setIsLoading(false);
        return () => {
          aborted = true;
          unsubscribers.forEach(unsub => unsub());
        };

      } catch (err) {
        handleError(err);
        return () => { };
      }
    };

    const unsubPromise = initializeAndListen();

    return () => {
      unsubPromise.then(unsub => unsub && unsub());
    };

  }, [userId]);

  const statusMap = useMemo(() => new Map(statuses.map(s => [s.name, s])), [statuses]);
  const labelMap = useMemo(() => new Map(labels.map(l => [l.id, l])), [labels]);

  const updateAutomation = (a: Automation) => setDocForUser('automations', a.id, {
    name: a.name,
    enabled: a.enabled,
    trigger: a.trigger,
    action: a.action,
  });

  const triggerAutomations = useCallback(async (client: Client, event: AutomationTriggerEvent) => {
    const matchesTrigger = (trigger: AutomationTrigger): boolean => {
      if (trigger.type !== event.type) return false;
      if (trigger.type === 'status_change' && event.type === 'status_change') {
        return trigger.status === event.to;
      }
      return true;
    };

    const relevant = automations.filter(a => a.enabled !== false && matchesTrigger(a.trigger));
    if (relevant.length === 0) return;

    const newStatus = event.type === 'status_change' ? event.to : client.status;
    const previousStatus = event.type === 'status_change' ? event.from : '';

    const replacePlaceholders = (text: string) => {
      let result = text;
      const assignedMember = client.assignedTo ? teamMembers.find(m => m.id === client.assignedTo) : null;
      const source = client.sourceId ? leadSources.find(s => s.id === client.sourceId) : null;

      result = result.replace(/{{שם הלקוח}}/g, client.name || '');
      result = result.replace(/{{שם הפרויקט}}/g, client.name || '');
      result = result.replace(/{{מזהה לקוח}}/g, client.id || '');
      result = result.replace(/{{מזהה פרויקט}}/g, client.id || '');
      result = result.replace(/{{סטטוס}}/g, newStatus || '');
      result = result.replace(/{{סטטוס קודם}}/g, previousStatus || '');
      result = result.replace(/{{הערות}}/g, client.notes || '');
      result = result.replace(/{{תאריך יצירה}}/g, client.createdAt ? new Date(client.createdAt).toLocaleDateString('he-IL') : '');
      result = result.replace(/{{מקור הגעה}}/g, source ? source.name : '');
      result = result.replace(/{{משתמש מוקצה}}/g, assignedMember ? (assignedMember.displayName || assignedMember.email || '') : '');

      customFields.forEach(field => {
        const fieldValue = client.customFields?.[field.id] || client.customFields?.[field.name] || '';
        result = result.replace(new RegExp(`{{${field.name}}}`, 'g'), String(fieldValue));
      });

      return result;
    };

    const logResult = (auto: Automation, status: 'success' | 'error', payload: any, url: string, response?: string) => {
      addDoc(collection(db, 'users', effectiveUserId, 'automationLogs'), {
        automationId: auto.id,
        automationName: auto.name,
        timestamp: Date.now(),
        status,
        payload,
        url,
        ...(response ? { response } : {}),
      });
    };

    for (const auto of relevant) {
      if (auto.action.type === 'webhook') {
        if (!auto.action.url) continue;
        try {
          const action = auto.action;
          let payload: any = {};
          if (action.fieldMapping && action.fieldMapping.length > 0) {
            for (const mapping of action.fieldMapping) {
              if (mapping.key) payload[mapping.key] = replacePlaceholders(mapping.value);
            }
          } else {
            payload = { ...client, status: newStatus, oldStatus: previousStatus };
          }

          const url = new URL(action.url);
          const fetchOptions: RequestInit = {
            method: action.method || 'POST',
            mode: 'no-cors',
          };
          if (action.method === 'GET') {
            Object.keys(payload).forEach(key => url.searchParams.append(key, payload[key]));
          } else {
            fetchOptions.headers = { 'Content-Type': 'application/json' };
            fetchOptions.body = JSON.stringify(payload);
          }
          await fetch(url.toString(), fetchOptions);
          logResult(auto, 'success', payload, url.toString());
        } catch (e: any) {
          console.error(`Automation '${auto.name}' webhook failed`, e);
          logResult(auto, 'error', {}, auto.action.type === 'webhook' ? auto.action.url : '', e.message || String(e));
        }
      } else if (auto.action.type === 'whatsapp') {
        const action = auto.action;
        const rawPhone = action.recipient.mode === 'manual'
          ? (action.recipient.manualPhone || '')
          : String(client.customFields?.[action.recipient.fieldId || ''] || '');
        const normalized = normalizePhoneForGreenApi(rawPhone);
        if (!normalized) {
          console.warn(`Automation '${auto.name}' skipped: missing/invalid phone`);
          logResult(auto, 'error', { rawPhone }, 'whatsapp', 'מספר טלפון לא תקין או חסר');
          continue;
        }
        const message = replacePlaceholders(action.message || '');
        if (!message.trim()) {
          logResult(auto, 'error', { to: normalized }, 'whatsapp', 'תוכן ההודעה ריק');
          continue;
        }
        try {
          const result: any = await api('whatsapp/send', { to: normalized, message, ownerUid: effectiveUserId });
          if (result?.ok) {
            logResult(auto, 'success', { to: normalized, message }, `whatsapp:${normalized}`);
          } else {
            logResult(auto, 'error', { to: normalized, message }, `whatsapp:${normalized}`, result?.error || 'Unknown error');
          }
        } catch (e: any) {
          console.error(`Automation '${auto.name}' whatsapp send failed`, e);
          logResult(auto, 'error', { to: normalized, message }, `whatsapp:${normalized}`, e.message || String(e));
        }
      } else if (auto.action.type === 'email') {
        const action = auto.action;
        const recipientEmail = action.recipient.mode === 'manual'
          ? (action.recipient.manualEmail || '')
          : String(client.customFields?.[action.recipient.fieldId || ''] || '');
        if (!recipientEmail.trim()) {
          logResult(auto, 'error', {}, 'email', 'כתובת מייל חסרה');
          continue;
        }
        const subject = replacePlaceholders(action.subject || '');
        const body = replacePlaceholders(action.body || '');
        if (!subject.trim()) {
          logResult(auto, 'error', { to: recipientEmail }, 'email', 'כותרת המייל ריקה');
          continue;
        }
        try {
          const result: any = await api('send-email', { to: recipientEmail, subject, body, ownerUid: effectiveUserId });
          if (result?.ok) {
            logResult(auto, 'success', { to: recipientEmail, subject }, `email:${recipientEmail}`);
          } else {
            logResult(auto, 'error', { to: recipientEmail, subject }, `email:${recipientEmail}`, result?.error || 'Unknown error');
          }
        } catch (e: any) {
          console.error(`Automation '${auto.name}' email send failed`, e);
          logResult(auto, 'error', { to: recipientEmail, subject }, `email:${recipientEmail}`, e.message || String(e));
        }
      }
    }
  }, [automations, customFields, effectiveUserId, teamMembers, leadSources]);
  const addDocToUser = <T extends {}>(collectionName: string, data: T) => addDoc(userColl(collectionName, effectiveUserId), data);
  const setDocForUser = <T extends {}>(collectionName: string, id: string, data: T) => setDoc(doc(db, 'users', effectiveUserId, collectionName, id), data, { merge: true });
  const deleteDocFromUser = (collectionName: string, id: string) => deleteDoc(doc(db, 'users', effectiveUserId, collectionName, id));

  const addClient = async (data: Omit<Client, 'id'>) => {
    if (statuses.length === 0) {
      setDbError(`לא ניתן להוסיף ${entityLabels.singular} - לא נמצאו סטטוסים. נסה לרענן את העמוד.`);
      return;
    }
    const finalData = {
      ...data,
      status: data.status || statuses[0].name,
      tasks: data.tasks || [],
      customFields: data.customFields || {},
      labelIds: data.labelIds || [],
      createdAt: Date.now(),
    };
    const cleanData = JSON.parse(JSON.stringify(finalData));
    const ref = await addDocToUser('clients', cleanData);
    await triggerAutomations({ ...(cleanData as Client), id: ref.id }, { type: 'client_created' });
  };

  const updateClient = async (c: Partial<Client> & { id: string }) => {
    const { id, ...data } = c;
    // Strip undefined values - Firestore does not accept them
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDocForUser('clients', id, cleanData);
  };

  const updateClientStatus = async (clientId: string, newStatus: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const oldStatus = client.status;
      await updateClient({ ...client, status: newStatus });
      await triggerAutomations({ ...client, status: newStatus }, { type: 'status_change', from: oldStatus, to: newStatus });
    }
  };

  const deleteClient = (id: string) => deleteDocFromUser('clients', id);

  const bulkAddClients = async (clientsData: Omit<Client, 'id'>[], fileName: string): Promise<string[]> => {
    if (statuses.length === 0) {
      throw new Error(`לא ניתן לייבא ${entityLabels.plural} - לא נמצאו סטטוסים.`);
    }
    const clientIds: string[] = [];
    const BATCH_SIZE = 450;
    for (let i = 0; i < clientsData.length; i += BATCH_SIZE) {
      const chunk = clientsData.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(data => {
        const docRef = doc(userColl('clients', effectiveUserId));
        const finalData = {
          ...data,
          status: data.status || statuses[0].name,
          tasks: data.tasks || [],
          customFields: data.customFields || {},
          labelIds: data.labelIds || [],
          createdAt: data.createdAt || Date.now(),
          notes: data.notes || '',
        };
        const cleanData = JSON.parse(JSON.stringify(finalData));
        batch.set(docRef, cleanData);
        clientIds.push(docRef.id);
      });
      await batch.commit();
    }
    await addDocToUser('importHistory', {
      timestamp: Date.now(),
      fileName,
      clientIds,
      recordCount: clientIds.length,
    });
    return clientIds;
  };

  const undoImport = async (batchId: string): Promise<void> => {
    console.log('[Import] undoImport called. batchId:', batchId, 'importHistory length:', importHistory.length);
    const batchRecord = importHistory.find(b => b.id === batchId);
    if (!batchRecord) {
      console.error('[Import] Batch record not found! Available IDs:', importHistory.map(b => b.id));
      throw new Error('רשומת ייבוא לא נמצאה.');
    }
    console.log('[Import] Found batch record:', batchRecord.fileName, 'with', batchRecord.clientIds.length, 'client IDs');
    const CHUNK_SIZE = 450;
    for (let i = 0; i < batchRecord.clientIds.length; i += CHUNK_SIZE) {
      const chunk = batchRecord.clientIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(clientId => {
        batch.delete(doc(db, 'users', effectiveUserId, 'clients', clientId));
      });
      console.log('[Import] Deleting chunk of', chunk.length, 'clients...');
      await batch.commit();
    }
    console.log('[Import] All clients deleted. Now deleting import history record...');
    await deleteDocFromUser('importHistory', batchId);
    console.log('[Import] Import history record deleted. Undo complete!');
  };

  const addCustomField = (f: Omit<CustomFieldDefinition, 'id' | 'order'>) => addDocToUser('customFields', { ...f, order: customFields.length });
  const updateCustomField = async (f: CustomFieldDefinition) => setDocForUser('customFields', f.id, f);
  const deleteCustomField = (id: string) => deleteDocFromUser('customFields', id);

  const addStatus = (name: string, color: string) => addDocToUser('statuses', { name, color, order: statuses.length });
  const updateStatus = (s: StatusDefinition) => setDocForUser('statuses', s.id, s);
  const deleteStatus = (id: string) => deleteDocFromUser('statuses', id);

  const addLabel = (name: string, color: string, module: 'client' | 'task' = 'client') => addDocToUser('labels', { name, color, module });
  const updateLabel = (l: LabelDefinition) => setDocForUser('labels', l.id, { name: l.name, color: l.color, module: l.module });
  const deleteLabel = (id: string) => deleteDocFromUser('labels', id);

  const addAutomation = (a: Omit<Automation, 'id'>) => addDocToUser('automations', a);
  const deleteAutomation = (id: string) => deleteDocFromUser('automations', id);

  const addLeadSource = (name: string) => addDocToUser('leadSources', { name });
  const updateLeadSource = (s: LeadSource) => setDocForUser('leadSources', s.id, { name: s.name, mappings: s.mappings || [] });
  const deleteLeadSource = (id: string) => deleteDocFromUser('leadSources', id);

  const updateVisibilitySettings = async (settings: VisibilitySettings) => {
    // Editors receive the effective (blocked-aware) settings; restore the stored
    // values for blocked modules so a temporary `enabled: false` is never persisted.
    const sanitized: VisibilitySettings = { ...settings };
    for (const mod of blockedModules) {
      const vk = MODULE_TO_VISIBILITY_KEY[mod];
      if (vk && visibilitySettings[vk]) sanitized[vk] = visibilitySettings[vk];
    }
    setVisibilitySettings(sanitized);
    await setDoc(doc(db, 'users', effectiveUserId, 'settings', 'visibility'), sanitized);
  };

  const updateWhatsAppSettings = async (settings: WhatsAppSettings) => {
    await setDoc(doc(db, 'users', effectiveUserId, 'settings', 'whatsapp'), settings);
  };

  const updateEmailSettings = async (settings: EmailSettings) => {
    await setDoc(doc(db, 'users', effectiveUserId, 'settings', 'email'), settings);
  };

  // Persist the system logo on the public config/owner doc. Passing null clears
  // it, which makes the app fall back to the bundled default logo.
  const updateLogoUrl = async (url: string | null) => {
    await setDoc(doc(db, 'config', 'owner'), { logoUrl: url ?? null }, { merge: true });
  };

  // Meetings are routed through the API so the Firestore write and the Google
  // Calendar sync happen atomically (replacing the old Firestore triggers).
  const addMeeting = async (m: Omit<Meeting, 'id' | 'googleEventIds'>) => {
    await api('meetings', { ...m, ownerUid: effectiveUserId });
  };
  const updateMeeting = async (m: Meeting) => {
    const { id, ...data } = m;
    await api(`meetings/${id}`, { ...data, ownerUid: effectiveUserId }, 'PATCH');
  };
  const deleteMeeting = async (id: string) => {
    await api(`meetings/${id}`, { ownerUid: effectiveUserId }, 'DELETE');
  };
  const deleteConnectedCalendar = (id: string) => deleteDocFromUser('connectedCalendars', id);

  const addDocument = async (d: Omit<CrmDocument, 'id'>): Promise<string> => {
    const docRef = await addDocToUser('documents', d);
    return docRef.id;
  };
  const updateDocument = async (d: CrmDocument) => {
    const { id, ...data } = d;
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDocForUser('documents', id, cleanData);
  };
  const deleteDocument = (id: string) => deleteDocFromUser('documents', id);

  const addDocumentTemplate = (t: Omit<DocumentTemplate, 'id'>) => addDocToUser('documentTemplates', t);
  const updateDocumentTemplate = (t: DocumentTemplate) => setDocForUser('documentTemplates', t.id, { name: t.name, content: t.content, createdAt: t.createdAt });
  const deleteDocumentTemplate = (id: string) => deleteDocFromUser('documentTemplates', id);

  const setOrderForCollection = async (collectionName: string, ids: string[]) => {
    const batch = writeBatch(db);
    ids.forEach((id, index) => {
      const docRef = doc(db, 'users', effectiveUserId, collectionName, id);
      batch.set(docRef, { order: index }, { merge: true });
    });
    await batch.commit();
  };

  const setStatusesOrder = (statusIds: string[]) => setOrderForCollection('statuses', statusIds);
  const setCustomFieldsOrder = (fieldIds: string[]) => setOrderForCollection('customFields', fieldIds);

  // Standalone single-customer: no plan gating — everything is available.
  const canCreateClient = true;
  const canUploadFile = true;

  const incrementFileCount = async () => {
    await updateDoc(doc(db, 'users', effectiveUserId), { fileCount: increment(1) });
  };

  return (
    <AppContext.Provider value={{
      userId,
      effectiveUserId, isOwner, organizationId,
      clients, updateClient, updateClientStatus, addClient, deleteClient,
      customFields, addCustomField, updateCustomField, deleteCustomField, setCustomFieldsOrder,
      automations, addAutomation, updateAutomation, deleteAutomation, triggerAutomations,
      statuses, statusMap, addStatus, updateStatus, deleteStatus, setStatusesOrder,
      labels, labelMap, addLabel, updateLabel, deleteLabel,
      leadSources, addLeadSource, updateLeadSource, deleteLeadSource,
      importHistory, bulkAddClients, undoImport,
      teamMembers,
      visibilitySettings: effectiveVisibilitySettings, updateVisibilitySettings,
      whatsappSettings, updateWhatsAppSettings,
      emailSettings, updateEmailSettings,
      meetings, addMeeting, updateMeeting, deleteMeeting,
      connectedCalendars, deleteConnectedCalendar,
      documents, addDocument, updateDocument, deleteDocument,
      documentTemplates, addDocumentTemplate, updateDocumentTemplate, deleteDocumentTemplate,
      isSyncing,
      isLoading,
      dbError,
      plan, entityLabel, entityLabels, blockedModules, clientCount, fileCount,
      canCreateClient, canUploadFile, incrementFileCount,
      logoUrl, updateLogoUrl
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
