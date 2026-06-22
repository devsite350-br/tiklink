import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { adminAuth } from './_lib/admin';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from './_lib/uploads';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request: req as any,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // The Firebase ID token is passed from the client as the clientPayload.
        const firebaseToken = clientPayload || '';
        await adminAuth.verifyIdToken(firebaseToken);
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
