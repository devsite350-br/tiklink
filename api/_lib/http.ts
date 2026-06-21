// Shared HTTP helpers for the API routes: auth, body parsing, error handling.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminAuth, adminDb } from './admin';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Verify the Firebase ID token from the Authorization header and return the uid.
export async function requireUid(req: VercelRequest): Promise<string> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Missing authentication token');
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new HttpError(401, 'Invalid authentication token');
  }
}

// Resolve the owner account a caller is allowed to act on. The caller must be
// the owner themselves, or a registered team member of that owner.
export async function resolveOwnerUid(callerUid: string, requestedOwnerUid?: string): Promise<string> {
  const ownerUid = requestedOwnerUid && requestedOwnerUid.trim() ? requestedOwnerUid.trim() : callerUid;
  if (ownerUid === callerUid) return ownerUid;
  const memberDoc = await adminDb
    .collection('users').doc(ownerUid)
    .collection('team_members').doc(callerUid).get();
  if (!memberDoc.exists) {
    throw new HttpError(403, 'Caller is not a team member of the requested owner');
  }
  return ownerUid;
}

// Validate a public webhook request. When WEBHOOK_SECRET is configured the
// request must carry a matching `secret` query param (or x-webhook-secret
// header). When OWNER_UID is configured the target userId must match it.
export function validateWebhook(req: VercelRequest, userId: string): void {
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = (getFirst(req.query.secret) || req.headers['x-webhook-secret']) as string | undefined;
    if (provided !== expectedSecret) {
      throw new HttpError(401, 'Invalid webhook secret');
    }
  }
  const ownerUid = process.env.OWNER_UID;
  if (ownerUid && userId !== ownerUid) {
    throw new HttpError(403, 'Unknown userId');
  }
}

// If a query param is sent multiple times, take the first value.
export const getFirst = (v: unknown): string | undefined =>
  Array.isArray(v) ? v[0] : (v as string | undefined);

// Parse a JSON body that may arrive as a string (depends on content-type).
export function parseBody<T = any>(req: VercelRequest): T {
  let body: any = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return (body || {}) as T;
}

// Wrap a handler so thrown HttpErrors become proper status codes.
export function withErrorHandling(
  fn: (req: VercelRequest, res: VercelResponse) => Promise<void>,
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status >= 500) console.error('[api] error:', e);
      res.status(status).json({ error: e.message || 'Internal Server Error' });
    }
  };
}
