// Thin client for the Vercel Serverless API. Replaces Firebase httpsCallable.
// Every request carries the current user's Firebase ID token as a Bearer token,
// which the API verifies with admin.auth().verifyIdToken().
import { auth } from '../firebaseConfig';
import { upload } from '@vercel/blob/client';

// Optional API base (defaults to relative — same Vercel deployment).
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export async function api<T = any>(
  path: string,
  body?: unknown,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST',
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_BASE}/api/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { error: text }; } })() : {};
  if (!res.ok) {
    throw new Error(data?.error || res.statusText);
  }
  return data as T;
}

// Build a public webhook URL (for lead sources / WhatsApp inbound) shown in the
// UI for pasting into external systems. Includes the webhook secret when set.
export function webhookUrl(path: string, params: Record<string, string>): string {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  const search = new URLSearchParams(params);
  const secret = import.meta.env.VITE_WEBHOOK_SECRET;
  if (secret) search.set('secret', secret);
  return `${base}/api/${path}?${search.toString()}`;
}

// Upload a file to Vercel Blob via the /api/upload token endpoint and return its
// public URL (stored in Firestore exactly like the previous download URL).
export async function uploadFile(file: File, prefix: string): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  const pathname = `${prefix}/${Date.now()}_${file.name}`;
  const result = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: `${API_BASE}/api/upload`,
    clientPayload: token || '',
  });
  return result.url;
}

// Anonymous upload from the public checklist share link. Authorized by the
// checklist share token rather than a Firebase login. Uploads to Blob, then
// records the file as a document attached to the given checklist item.
export async function uploadPublicFile(
  file: File,
  opts: { userId: string; shareToken: string; subtaskId: string },
): Promise<string> {
  const pathname = `client-uploads/${opts.userId}/${Date.now()}_${file.name}`;
  const result = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: `${API_BASE}/api/public-files`,
    clientPayload: JSON.stringify({ userId: opts.userId, shareToken: opts.shareToken }),
  });
  await api('public-files', {
    action: 'attach',
    userId: opts.userId,
    shareToken: opts.shareToken,
    subtaskId: opts.subtaskId,
    fileUrl: result.url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  });
  return result.url;
}

// Toggle a checklist item from the public share link (no login). Authorized by
// the checklist share token; the write is performed server-side (Admin SDK).
export async function togglePublicSubtask(
  userId: string,
  shareToken: string,
  subtaskId: string,
  isCompleted: boolean,
): Promise<void> {
  await api('public-files', { action: 'toggle', userId, shareToken, subtaskId, isCompleted });
}
