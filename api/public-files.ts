import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { adminDb } from './_lib/admin';
import {
  ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, MAX_FILES_PER_SUBTASK,
  resolveShareToken, countSubtaskFiles, isValidBlobUrl,
} from './_lib/uploads';

// Combined anonymous file endpoint for the public checklist share link.
// Handles two phases (kept in one function to stay under the Vercel function
// limit), both authorized by the checklist share token rather than a login:
//   1. action === 'attach' → record an already-uploaded file as a document on
//      the client, attached to a specific checklist item (with all the caps).
//   2. otherwise → @vercel/blob handleUpload token issuance (onBeforeGenerateToken).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as any;

  // ── Toggle a checklist item (anonymous, authorized by share token) ──
  if (body && body.action === 'toggle') {
    try {
      const { userId, shareToken, subtaskId, isCompleted } = body;
      if (!userId || !shareToken || !subtaskId) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const share = await resolveShareToken(userId, shareToken);
      if (!share) {
        res.status(403).json({ error: 'Invalid or revoked share link' });
        return;
      }
      const subtask = (share.task.subtasks || []).find(s => s.id === subtaskId);
      if (!subtask) {
        res.status(403).json({ error: 'Checklist item not found' });
        return;
      }
      const clientRef = adminDb.collection('users').doc(userId).collection('clients').doc(share.clientId);
      const snap = await clientRef.get();
      const data = snap.data() as { tasks?: any[] } | undefined;
      const tasks = (data?.tasks || []).map((t: any) =>
        t.shareToken === shareToken
          ? { ...t, subtasks: (t.subtasks || []).map((s: any) => s.id === subtaskId ? { ...s, isCompleted: !!isCompleted } : s) }
          : t
      );
      await clientRef.update({ tasks });
      res.status(200).json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Toggle failed' });
    }
    return;
  }

  // ── Phase 2: attach a recorded file ──
  if (body && body.action === 'attach') {
    try {
      const { userId, shareToken, subtaskId, fileUrl, fileName, fileSize, mimeType } = body;

      if (!userId || !shareToken || !subtaskId || !fileUrl) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      if (!isValidBlobUrl(fileUrl, userId)) {
        res.status(400).json({ error: 'Invalid file URL' });
        return;
      }
      if (typeof fileSize === 'number' && fileSize > MAX_UPLOAD_BYTES) {
        res.status(400).json({ error: 'File too large' });
        return;
      }
      if (mimeType && !ALLOWED_UPLOAD_TYPES.includes(mimeType)) {
        res.status(400).json({ error: 'File type not allowed' });
        return;
      }

      const share = await resolveShareToken(userId, shareToken);
      if (!share) {
        res.status(403).json({ error: 'Invalid or revoked share link' });
        return;
      }

      // The link may only attach to EXISTING checklist rows — never create one.
      const subtask = (share.task.subtasks || []).find(s => s.id === subtaskId);
      if (!subtask) {
        res.status(403).json({ error: 'Checklist item not found' });
        return;
      }

      const existing = await countSubtaskFiles(userId, share.clientId, subtaskId);
      if (existing >= MAX_FILES_PER_SUBTASK) {
        res.status(409).json({ error: `Limit of ${MAX_FILES_PER_SUBTASK} files per item reached` });
        return;
      }

      const now = Date.now();
      const docData = {
        clientId: share.clientId,
        title: fileName || 'קובץ',
        status: 'sent' as const,
        kind: 'file' as const,
        fileUrl,
        fileName: fileName || 'קובץ',
        fileSize: typeof fileSize === 'number' ? fileSize : 0,
        mimeType: mimeType || '',
        uploadedBy: 'client' as const,
        sourceSubtaskId: subtaskId,
        sourceSubtaskText: subtask.text || '',
        publicToken: '',
        createdAt: now,
        updatedAt: now,
      };
      const ref = await adminDb.collection('users').doc(userId).collection('documents').add(docData);

      // Notify the owner that a client attached a file.
      await adminDb.collection('users').doc(userId).collection('notifications').add({
        type: 'file_uploaded',
        title: 'קובץ חדש מהלקוח',
        body: `${share.clientName || 'לקוח'} צירף קובץ "${docData.fileName}" לפריט "${subtask.text || ''}"`,
        relatedId: ref.id,
        relatedType: 'document',
        clientId: share.clientId,
        triggerTime: now,
        read: false,
        dismissed: false,
        browserNotified: false,
        createdAt: now,
      });

      res.status(200).json({ id: ref.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Attach failed' });
    }
    return;
  }

  // ── Phase 1: issue a Blob upload token (validated by the share token) ──
  try {
    const jsonResponse = await handleUpload({
      body: body as HandleUploadBody,
      request: req as any,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let userId = '';
        let shareToken = '';
        try {
          const parsed = JSON.parse(clientPayload || '{}');
          userId = parsed.userId || '';
          shareToken = parsed.shareToken || '';
        } catch {
          throw new Error('Invalid client payload');
        }
        const share = await resolveShareToken(userId, shareToken);
        if (!share) throw new Error('Invalid or revoked share link');
        return {
          allowedContentTypes: ALLOWED_UPLOAD_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
        };
      },
      onUploadCompleted: async () => {},
    });
    res.status(200).json(jsonResponse);
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Upload failed' });
  }
}
