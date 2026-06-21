import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUid, resolveOwnerUid, parseBody, withErrorHandling, HttpError } from '../_lib/http';
import { adminDb, FieldValue } from '../_lib/admin';
import { normalizePhone, findClientsByPhone } from '../_lib/whatsapp';

// Send an outbound WhatsApp message via the owner's Green API instance.
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const callerUid = await requireUid(req);
  const { to, message, ownerUid } = parseBody(req);
  const toStr = typeof to === 'string' ? to.trim() : '';
  const messageStr = typeof message === 'string' ? message : '';
  if (!toStr || !messageStr) throw new HttpError(400, 'Both "to" and "message" are required.');

  const resolvedOwner = await resolveOwnerUid(callerUid, ownerUid);

  const settingsDoc = await adminDb
    .collection('users').doc(resolvedOwner).collection('settings').doc('whatsapp').get();
  if (!settingsDoc.exists) throw new HttpError(400, 'Green API לא הוגדר.');
  const settings = settingsDoc.data()!;
  const idInstance = (settings.idInstance || '').trim();
  const apiTokenInstance = (settings.apiTokenInstance || '').trim();
  if (!idInstance || !apiTokenInstance) throw new HttpError(400, 'חסרים פרטי חיבור ל-Green API.');

  const normalizedTo = normalizePhone(toStr);
  if (!normalizedTo) {
    res.status(200).json({ ok: false, error: 'מספר טלפון לא תקין' });
    return;
  }
  const chatId = `${normalizedTo}@c.us`;

  const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
  let greenApiResp: any;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message: messageStr }),
    });
    const text = await r.text();
    try { greenApiResp = JSON.parse(text); } catch { greenApiResp = { raw: text }; }
    if (!r.ok) {
      res.status(200).json({ ok: false, error: `Green API ${r.status}: ${text.slice(0, 200)}` });
      return;
    }
  } catch (e: any) {
    res.status(200).json({ ok: false, error: e.message || String(e) });
    return;
  }

  const idMessage = greenApiResp && greenApiResp.idMessage;
  if (!idMessage) {
    res.status(200).json({ ok: false, error: 'Green API לא החזיר idMessage' });
    return;
  }

  // Best-effort mirror to the matching client doc (the webhook dedups by idMessage).
  try {
    const matches = await findClientsByPhone(resolvedOwner, normalizedTo);
    if (matches.length > 0) {
      const messageDoc = {
        direction: 'outbound', timestamp: Date.now(), type: 'text', text: messageStr,
        placeholder: null, fromPhone: null, toPhone: normalizedTo, matchedPhone: normalizedTo,
        status: 'sent', rawTypeWebhook: 'apiSent', receivedAt: Date.now(),
      };
      await Promise.all(matches.map(async (client) => {
        const msgRef = client.ref.collection('whatsappMessages').doc(idMessage);
        if ((await msgRef.get()).exists) return;
        await msgRef.set(messageDoc);
        await client.ref.update({
          activityLog: FieldValue.arrayUnion({
            id: `wa_${idMessage}`, type: 'whatsapp_outbound', timestamp: messageDoc.timestamp,
            title: 'נשלחה הודעת וואטסאפ', refId: idMessage,
          }),
        });
      }));
    }
  } catch (e) {
    console.error('[whatsapp/send] failed to mirror to client doc', e);
  }

  res.status(200).json({ ok: true, idMessage });
});
