
export interface StatusDefinition {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface LabelDefinition {
  id: string;
  name: string;
  color: string;
  module?: 'client' | 'task';
}

export enum CustomFieldType {
  TEXT = 'טקסט',
  EMAIL = 'אימייל',
  PHONE = 'טלפון',
  DATE = 'תאריך',
  URL = 'URL',
  NUMBER = 'מספר',
}

export const CUSTOM_FIELD_TYPE_LIST = [
  CustomFieldType.TEXT,
  CustomFieldType.EMAIL,
  CustomFieldType.PHONE,
  CustomFieldType.DATE,
  CustomFieldType.URL,
  CustomFieldType.NUMBER,
];

export interface Subtask {
  id: string;
  text: string;
  isCompleted: boolean;
}

export type TaskPriority = 'none' | 'medium' | 'high';

export interface Task {
  id: string;
  text: string;
  isCompleted: boolean;
  priority?: TaskPriority;
  totalTime?: number; // accumulated time in milliseconds
  isRunning?: boolean; // is the timer currently active
  startTime?: number; // timestamp when the timer was started
  labelIds?: string[];
  dueDate?: string; // ISO date string (YYYY-MM-DD)
  createdAt?: number; // timestamp when the task was created
  authorId?: string;
  authorName?: string;
  authorPhotoUrl?: string;
  subtasks?: Subtask[]; // when present, task is a checklist task
  shareToken?: string; // when set, checklist is publicly shareable
}

export interface Comment {
  id: string;
  text: string;
  timestamp: number;
  imageUrl?: string;
  authorId?: string;
  authorName?: string;
  authorPhotoUrl?: string;
}

export interface ActivityEvent {
  id: string;
  type: 'status_change' | 'task_created' | 'task_completed' | 'user_assigned' | 'whatsapp_inbound' | 'whatsapp_outbound';
  timestamp: number;
  authorId?: string;
  authorName?: string;
  authorPhotoUrl?: string;
  title: string;
  description?: string;
  fromStatus?: string;
  toStatus?: string;
  refId?: string;
}

export interface WhatsAppMessage {
  id: string; // Green API idMessage (used as Firestore doc ID for dedup)
  direction: 'inbound' | 'outbound';
  timestamp: number; // ms since epoch
  type: 'text' | 'media' | 'audio' | 'voice' | 'video' | 'image' | 'document' | 'location' | 'contact' | 'sticker' | 'unknown';
  text?: string; // text content (only when type=text)
  placeholder?: string; // human-readable placeholder for non-text (e.g. "[הודעת מדיה]")
  fromPhone?: string; // raw sender phone (for inbound)
  toPhone?: string; // raw recipient phone (for outbound)
  matchedPhone?: string; // normalized phone that matched the client
  status?: 'sent' | 'delivered' | 'read' | 'received' | 'failed';
  rawTypeWebhook?: string; // original Green API typeWebhook
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: CustomFieldType;
  showInGrid: boolean;
  showInList: boolean;
  showInCard: boolean;
  order: number;
  isSystem?: boolean; // System fields (e.g. creation date) can't be deleted
}

export interface ModuleVisibility {
  enabled?: boolean;
  showInGrid: boolean;
  showInList: boolean;
  showInCard: boolean;
  enableTimeTracking?: boolean;
}

export interface Meeting {
  id: string;
  clientId: string;
  title: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  description?: string;
  createdAt?: number; // timestamp when the meeting was created
  googleEventIds?: { [calendarId: string]: string }; // Map of connected calendar ID to Google Event ID
}

export interface ConnectedCalendar {
  id: string;
  email: string;
  refreshToken: string;
}

export interface DocumentContent {
  headerRight: string;
  headerLeft: string;
  body: string;
  showSignature: boolean;
  logoUrl?: string;
}

export interface CrmDocument {
  id: string;
  clientId: string;
  title: string;
  templateId?: string;
  status: 'draft' | 'sent' | 'viewed' | 'signed';
  createdAt: number;
  updatedAt: number;
  signedAt?: number;
  publicToken: string;
  content?: DocumentContent; // only for kind === 'generated'
  signatureDataUrl?: string;
  signerName?: string;
  authorId?: string;
  authorName?: string;
  authorPhotoUrl?: string;
  // ── File attachments ──
  // kind defaults to 'generated' (HTML document built from a template). When
  // kind === 'file' the record represents an uploaded file (image / PDF / Office
  // doc) stored on Vercel Blob and shown in the documents tab as a download card.
  kind?: 'generated' | 'file';
  fileUrl?: string; // public Blob URL (kind === 'file')
  fileName?: string; // original file name
  fileSize?: number; // bytes
  mimeType?: string; // content type
  uploadedBy?: 'team' | 'client'; // who attached the file
  sourceSubtaskId?: string; // checklist item this file was attached to (if any)
  sourceSubtaskText?: string; // snapshot of the checklist item text
}

export interface DocumentTemplate {
  id: string;
  name: string;
  content: DocumentContent;
  createdAt: number;
}

export interface VisibilitySettings {
  statuses: ModuleVisibility;
  tasks: ModuleVisibility;
  labels: ModuleVisibility;
  leadSources: ModuleVisibility;
  users: ModuleVisibility;
  aiSummary: ModuleVisibility;
  meetings: ModuleVisibility;
  documents: ModuleVisibility;
  whatsapp: ModuleVisibility;
  email: ModuleVisibility;
}

export const DEFAULT_VISIBILITY_SETTINGS: VisibilitySettings = {
  statuses: { enabled: true, showInGrid: true, showInList: true, showInCard: true },
  tasks: { enabled: true, showInGrid: false, showInList: false, showInCard: true, enableTimeTracking: true },
  labels: { enabled: true, showInGrid: true, showInList: true, showInCard: true },
  leadSources: { enabled: true, showInGrid: true, showInList: true, showInCard: true },
  users: { enabled: true, showInGrid: true, showInList: true, showInCard: true },
  aiSummary: { enabled: true, showInGrid: false, showInList: true, showInCard: true },
  meetings: { enabled: false, showInGrid: false, showInList: false, showInCard: false },
  documents: { enabled: true, showInGrid: false, showInList: false, showInCard: true },
  whatsapp: { enabled: false, showInGrid: false, showInList: false, showInCard: true },
  email: { enabled: false, showInGrid: false, showInList: false, showInCard: true },
};

export const SYSTEM_FIELD_DEFINITIONS = [
  { id: '__createdAt', name: 'תאריך יצירה', type: CustomFieldType.DATE, isSystem: true },
  { id: '__notes', name: 'פרטים נוספים', type: CustomFieldType.TEXT, isSystem: true },
];

export interface Client {
  id: string;
  name: string;
  status: string; // Now a string (the status name)
  createdAt?: number; // Timestamp
  notes: string;
  tasks: Task[];
  comments: Comment[];
  activityLog?: ActivityEvent[];
  customFields: { [key: string]: any };
  labelIds?: string[];
  sourceId?: string; // ID of the lead source
  aiSummary?: string; // AI generated summary
  assignedTo?: string; // User ID of the assigned team member
}

export type AutomationTrigger =
  | { type: 'status_change'; status: string }
  | { type: 'client_created' };

export interface AutomationActionWebhook {
  type: 'webhook';
  url: string;
  method: 'POST' | 'GET';
  fieldMapping: { key: string; value: string }[];
}

export interface WhatsAppRecipient {
  mode: 'manual' | 'field';
  manualPhone?: string;
  fieldId?: string;
}

export interface AutomationActionWhatsApp {
  type: 'whatsapp';
  recipient: WhatsAppRecipient;
  message: string;
}

export interface EmailRecipient {
  mode: 'manual' | 'field';
  manualEmail?: string;
  fieldId?: string;
}

export interface AutomationActionEmail {
  type: 'email';
  recipient: EmailRecipient;
  subject: string;
  body: string;
}

export type AutomationAction = AutomationActionWebhook | AutomationActionWhatsApp | AutomationActionEmail;

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  action: AutomationAction;
}

export interface WhatsAppSettings {
  idInstance: string;
  apiTokenInstance: string;
  senderPhone?: string;
}

export interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  resendApiKey?: string;
  resendFromEmail?: string;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  automationName: string;
  timestamp: number;
  status: 'success' | 'error';
  payload: any;
  url: string;
  response?: string;
}

export interface LeadSource {
  id: string;
  name: string;
  mappings?: { key: string; fieldId: string }[];
}

export interface ImportBatch {
  id: string;
  timestamp: number;
  fileName: string;
  clientIds: string[];
  recordCount: number;
}

export const UNASSOCIATED_CLIENT_ID = 'unassociated_client_id';

// ── Notifications ──────────────────────────────────────────────
export type NotificationType = 'meeting_reminder' | 'task_reminder' | 'task_overdue' | 'file_uploaded';

export interface CrmNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedId: string;
  relatedType: 'meeting' | 'task' | 'document';
  clientId?: string;
  triggerTime: number;
  read: boolean;
  dismissed: boolean;
  browserNotified: boolean;
  createdAt: number;
}

// ── File upload limits (shared client/server) ──
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB per file
export const MAX_FILES_PER_SUBTASK = 5; // attachments per checklist item

// Content types accepted for uploads (images, PDF, Word, Excel).
export const ALLOWED_UPLOAD_TYPES: string[] = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  meetingReminderMinutes: number;
  taskReminderMinutes: number;
  overdueTaskAlerts: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  meetingReminderMinutes: 15,
  taskReminderMinutes: 60,
  overdueTaskAlerts: true,
};

export type UserPlan = 'free' | 'active' | 'inactive';

export const PLAN_LIMITS: Record<UserPlan, { maxClients: number; maxFiles: number }> = {
  inactive: { maxClients: 0, maxFiles: 0 },
  free: { maxClients: 500, maxFiles: 20 },
  active: { maxClients: 10000, maxFiles: 10000 },
};

export const PLAN_LABELS: Record<UserPlan, string> = {
  inactive: 'לא פעיל',
  free: 'חינמי',
  active: 'פעיל',
};

/**
 * Modules an admin can block per-user. Each `key` matches a settings tab id
 * in ManageFieldsPage; a blocked module's tab is hidden for that user.
 */
export const BLOCKABLE_MODULES: { key: string; label: string }[] = [
  { key: 'meetings', label: 'יומן' },
  { key: 'email', label: 'אימייל' },
  { key: 'whatsapp', label: 'וואטסאפ' },
  { key: 'automations', label: 'אוטומציות' },
  { key: 'ai', label: 'הגדרות AI' },
  { key: 'documents', label: 'מסמכים' },
  { key: 'tasks', label: 'משימות' },
  { key: 'team', label: 'ניהול צוות' },
  { key: 'leadSources', label: 'מקורות הגעה' },
];

export const BLOCKABLE_MODULE_KEYS = BLOCKABLE_MODULES.map(m => m.key);

export type EntityLabel = 'clients' | 'projects';

export const ENTITY_LABEL_OPTIONS: { value: EntityLabel; display: string }[] = [
  { value: 'clients', display: 'לקוחות' },
  { value: 'projects', display: 'פרויקטים' },
];

export interface EntityLabels {
  singular: string;       // לקוח / פרויקט
  plural: string;         // לקוחות / פרויקטים
  theSingular: string;    // הלקוח / הפרויקט
  thePlural: string;      // הלקוחות / הפרויקטים
  toSingular: string;     // ללקוח / לפרויקט
  fromSingular: string;   // מהלקוח / מהפרויקט
  nameOf: string;         // שם הלקוח / שם הפרויקט
  idOf: string;           // מזהה לקוח / מזהה פרויקט
  addNew: string;         // הוסף לקוח / הוסף פרויקט
  addNewFull: string;     // הוספת לקוח חדש / הוספת פרויקט חדש
  editEntity: string;     // עריכת לקוח / עריכת פרויקט
  deleteEntity: string;   // מחק לקוח / מחק פרויקט
  saveEntity: string;     // שמור לקוח / שמור פרויקט
  card: string;           // כרטיס לקוח / כרטיס פרויקט
  notFound: string;       // לקוח לא נמצא / פרויקט לא נמצא
  noEntities: string;     // לא נמצאו לקוחות / לא נמצאו פרויקטים
  searchEntity: string;   // חיפוש לקוח... / חיפוש פרויקט...
  newEntity: string;      // לקוח חדש / פרויקט חדש
  createEntity: string;   // יצירת לקוח חדש / יצירת פרויקט חדש
  withoutEntity: string;  // ללא לקוח / ללא פרויקט
  records: string;        // רשומות לקוח / רשומות פרויקט
  allEntities: string;    // כל הלקוחות / כל הפרויקטים
  assignTo: string;       // שיוך ללקוח / שיוך לפרויקט
  entityTags: string;     // תגיות לקוח / תגיות פרויקט
  showInCard: string;     // הצג בכרטיס לקוח / הצג בכרטיס פרויקט
  templateNameVar: string; // {{שם הלקוח}} / {{שם הפרויקט}}
  templateIdVar: string;   // {{מזהה לקוח}} / {{מזהה פרויקט}}
}

const CLIENT_LABELS: EntityLabels = {
  singular: 'לקוח',
  plural: 'לקוחות',
  theSingular: 'הלקוח',
  thePlural: 'הלקוחות',
  toSingular: 'ללקוח',
  fromSingular: 'מהלקוח',
  nameOf: 'שם הלקוח',
  idOf: 'מזהה לקוח',
  addNew: 'הוסף לקוח',
  addNewFull: 'הוספת לקוח חדש',
  editEntity: 'עריכת לקוח',
  deleteEntity: 'מחק לקוח',
  saveEntity: 'שמור לקוח',
  card: 'כרטיס לקוח',
  notFound: 'לקוח לא נמצא',
  noEntities: 'לא נמצאו לקוחות',
  searchEntity: 'חיפוש לקוח...',
  newEntity: 'לקוח חדש',
  createEntity: 'יצירת לקוח חדש',
  withoutEntity: 'ללא לקוח',
  records: 'רשומות לקוח',
  allEntities: 'כל הלקוחות',
  assignTo: 'שיוך ללקוח',
  entityTags: 'תגיות לקוח',
  showInCard: 'הצג בכרטיס לקוח',
  templateNameVar: '{{שם הלקוח}}',
  templateIdVar: '{{מזהה לקוח}}',
};

const PROJECT_LABELS: EntityLabels = {
  singular: 'פרויקט',
  plural: 'פרויקטים',
  theSingular: 'הפרויקט',
  thePlural: 'הפרויקטים',
  toSingular: 'לפרויקט',
  fromSingular: 'מהפרויקט',
  nameOf: 'שם הפרויקט',
  idOf: 'מזהה פרויקט',
  addNew: 'הוסף פרויקט',
  addNewFull: 'הוספת פרויקט חדש',
  editEntity: 'עריכת פרויקט',
  deleteEntity: 'מחק פרויקט',
  saveEntity: 'שמור פרויקט',
  card: 'כרטיס פרויקט',
  notFound: 'פרויקט לא נמצא',
  noEntities: 'לא נמצאו פרויקטים',
  searchEntity: 'חיפוש פרויקט...',
  newEntity: 'פרויקט חדש',
  createEntity: 'יצירת פרויקט חדש',
  withoutEntity: 'ללא פרויקט',
  records: 'רשומות פרויקט',
  allEntities: 'כל הפרויקטים',
  assignTo: 'שיוך לפרויקט',
  entityTags: 'תגיות פרויקט',
  showInCard: 'הצג בכרטיס פרויקט',
  templateNameVar: '{{שם הפרויקט}}',
  templateIdVar: '{{מזהה פרויקט}}',
};

export function getEntityLabels(entityLabel: EntityLabel): EntityLabels {
  return entityLabel === 'projects' ? PROJECT_LABELS : CLIENT_LABELS;
}
