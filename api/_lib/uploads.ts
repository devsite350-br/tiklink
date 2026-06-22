// Shared helpers for file uploads (mirrors the client-side constants in
// ../../types.ts — kept in sync manually because the api/ project is compiled
// separately and cannot import the app's ESM types).
import { adminDb } from './admin';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB per file
export const MAX_FILES_PER_SUBTASK = 5; // attachments per checklist item

export const ALLOWED_UPLOAD_TYPES: string[] = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

interface Subtask { id: string; text: string; isCompleted?: boolean }
interface Task { id: string; text: string; shareToken?: string; subtasks?: Subtask[] }

export interface ResolvedShare {
  clientId: string;
  clientName: string;
  task: Task;
}

// Find the client + checklist task that owns a given public share token.
// Returns null when no checklist task carries that token.
export async function resolveShareToken(userId: string, token: string): Promise<ResolvedShare | null> {
  if (!userId || !token) return null;
  const clientsSnap = await adminDb.collection('users').doc(userId).collection('clients').get();
  for (const docSnap of clientsSnap.docs) {
    const data = docSnap.data() as { name?: string; tasks?: Task[] };
    const task = (data.tasks || []).find(t => t.shareToken === token && Array.isArray(t.subtasks));
    if (task) {
      return { clientId: docSnap.id, clientName: data.name || '', task };
    }
  }
  return null;
}

// Count how many uploaded files are already attached to a given checklist item.
export async function countSubtaskFiles(userId: string, clientId: string, subtaskId: string): Promise<number> {
  const snap = await adminDb
    .collection('users').doc(userId).collection('documents')
    .where('clientId', '==', clientId)
    .where('sourceSubtaskId', '==', subtaskId)
    .get();
  return snap.size;
}

// Validate that a candidate URL really is a Vercel Blob URL under this user's
// client-uploads prefix (prevents attaching arbitrary external links).
export function isValidBlobUrl(url: string, userId: string): boolean {
  if (typeof url !== 'string') return false;
  return /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(url)
    && url.includes(`/client-uploads/${userId}/`);
}
