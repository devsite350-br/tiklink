import type { VercelRequest, VercelResponse } from '@vercel/node';
import { issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';
import { adminAuth } from './_lib/admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as HandleUploadPresignedBody;
  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request: req as any,
      getSignedToken: async (pathname, clientPayload) => {
        const firebaseToken = clientPayload || '';
        await adminAuth.verifyIdToken(firebaseToken);
        const signedToken = await issueSignedToken({
          pathname,
          operations: ['put'],
          allowedContentTypes: [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'image/svg+xml', 'application/pdf',
          ],
          maximumSizeInBytes: 10 * 1024 * 1024,
        });
        return { token: signedToken };
      },
      onUploadCompleted: async () => {},
    });
    res.status(200).json(jsonResponse);
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Upload failed' });
  }
}
