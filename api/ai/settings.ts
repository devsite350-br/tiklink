import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUid, parseBody, withErrorHandling, HttpError } from '../_lib/http';
import { adminDb } from '../_lib/admin';
import { encryptApiKey, maskApiKey } from '../_lib/crypto';

// GET  /api/ai/settings — returns { aiEnabled, maskedKey, hasKey }
// POST /api/ai/settings — body { aiEnabled, apiKey? } → saves (key encrypted)
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const uid = await requireUid(req);
  const userRef = adminDb.collection('users').doc(uid);

  if (req.method === 'GET') {
    const userDoc = await userRef.get();
    if (!userDoc.exists) { res.status(200).json({ aiEnabled: false, maskedKey: '', hasKey: false }); return; }
    const data = userDoc.data()!;
    let maskedKey = data.geminiApiKeyMasked || '';
    const hasKey = !!data.geminiApiKey;
    if (hasKey && !maskedKey) {
      const rawKey = data.geminiApiKey;
      if (!rawKey.includes(':')) {
        maskedKey = maskApiKey(rawKey);
        await userRef.set({ geminiApiKey: encryptApiKey(rawKey), geminiApiKeyMasked: maskedKey }, { merge: true });
      } else {
        maskedKey = 'AIza•••••••••••••••••••••••••';
      }
    }
    res.status(200).json({ aiEnabled: !!data.aiEnabled, maskedKey, hasKey });
    return;
  }

  if (req.method === 'POST') {
    const { aiEnabled, apiKey } = parseBody(req);
    const updateData: any = { aiEnabled: !!aiEnabled };
    if (typeof apiKey === 'string' && apiKey.trim()) {
      const trimmed = apiKey.trim();
      updateData.geminiApiKey = encryptApiKey(trimmed);
      updateData.geminiApiKeyMasked = maskApiKey(trimmed);
    }
    await userRef.set(updateData, { merge: true });
    const data = (await userRef.get()).data() || {};
    res.status(200).json({ success: true, maskedKey: data.geminiApiKeyMasked || '', aiEnabled: !!data.aiEnabled });
    return;
  }

  throw new HttpError(405, 'Method not allowed');
});
