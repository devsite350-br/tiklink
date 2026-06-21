import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirst, parseBody, validateWebhook, withErrorHandling } from '../_lib/http';
import { adminDb, FieldValue } from '../_lib/admin';
import { parseGreenApiWebhook } from '../_lib/whatsapp';

// Public Green API webhook receiver. URL: /api/whatsapp/inbound?userId=...&secret=...
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const userId = getFirst(req.query.userId);
  if (!userId) { res.status(400).send('Missing userId'); return; }

  if (req.method === 'GET') {
    res.status(200).send('WhatsApp webhook is live. POST Green API events here.');
    return;
  }

  validateWebhook(req, userId);

  const message = parseGreenApiWebhook(parseBody(req));
  if (!message) { res.status(200).send('Ignored (non-message event)'); return; }
  if (!message.matchedPhone) { res.status(200).send('Ignored (no phone)'); return; }

  const customFieldsSnap = await adminDb
    .collection('users').doc(userId).collection('customFields').get();
  const phoneFieldIds = customFieldsSnap.docs
    .filter(d => d.data().type === 'טלפון')
    .map(d => d.id);
  if (phoneFieldIds.length === 0) { res.status(200).send('No phone fields configured'); return; }

  const { normalizePhone } = await import('../_lib/whatsapp');
  const clientsSnap = await adminDb
    .collection('users').doc(userId).collection('clients').get();
  const matchingClients: { id: string; ref: FirebaseFirestore.DocumentReference }[] = [];
  clientsSnap.docs.forEach(doc => {
    if (doc.id === 'unassociated_client_id') return;
    const cf = doc.data().customFields || {};
    for (const fieldId of phoneFieldIds) {
      const normalized = normalizePhone(cf[fieldId]);
      if (normalized && normalized === message.matchedPhone) {
        matchingClients.push({ id: doc.id, ref: doc.ref });
        return;
      }
    }
  });

  if (matchingClients.length === 0) { res.status(200).send('No matching client'); return; }

  const messageDoc = {
    direction: message.direction, timestamp: message.timestamp, type: message.type,
    text: message.text || null, placeholder: message.placeholder || null,
    fromPhone: message.fromPhone || null, toPhone: message.toPhone || null,
    matchedPhone: message.matchedPhone, status: message.status,
    rawTypeWebhook: message.rawTypeWebhook, receivedAt: Date.now(),
  };
  const activityTitle = message.direction === 'inbound' ? 'התקבלה הודעת וואטסאפ' : 'נשלחה הודעת וואטסאפ';

  const writes = matchingClients.map(async (client) => {
    const msgRef = client.ref.collection('whatsappMessages').doc(message.idMessage);
    if ((await msgRef.get()).exists) return { client: client.id, skipped: true };
    await msgRef.set(messageDoc);
    await client.ref.update({
      activityLog: FieldValue.arrayUnion({
        id: `wa_${message.idMessage}`,
        type: message.direction === 'inbound' ? 'whatsapp_inbound' : 'whatsapp_outbound',
        timestamp: message.timestamp, title: activityTitle, refId: message.idMessage,
      }),
    });
    return { client: client.id, skipped: false };
  });

  const results = await Promise.all(writes);
  res.status(200).json({ ok: true, matched: results.length, results });
});
