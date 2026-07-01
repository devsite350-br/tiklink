import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFirst, validateWebhook, withErrorHandling } from '../_lib/http';
import { adminDb } from '../_lib/admin';
import { decryptApiKey } from '../_lib/crypto';

// Public webhook: create a lead/client. URL: /api/leads/inbound?crmSource=..&userId=..&secret=..
// After creation, runs optional AI enrichment inline (replaces the processNewClient trigger).
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const rawQuery = req.query;
  const crmSource = getFirst(rawQuery.crmSource);
  const userId = getFirst(rawQuery.userId);
  if (!crmSource || !userId) {
    res.status(400).send('Missing required parameters: crmSource, userId');
    return;
  }
  validateWebhook(req, userId);

  const reservedKeys = new Set(['crmSource', 'userId', 'secret']);
  const otherParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawQuery)) {
    if (!reservedKeys.has(key)) otherParams[key] = getFirst(value) || '';
  }

  const userRef = adminDb.collection('users').doc(userId);

  // Validate source
  const sourceDoc = await userRef.collection('leadSources').doc(crmSource).get();
  if (!sourceDoc.exists) { res.status(404).send('Invalid lead source'); return; }
  const sourceData = sourceDoc.data()!;
  const mappings = Array.isArray(sourceData.mappings) ? sourceData.mappings : [];

  // Default status
  const statusesSnapshot = await userRef.collection('statuses').orderBy('order').limit(1).get();
  const statusName = statusesSnapshot.empty ? 'New' : statusesSnapshot.docs[0].data().name;

  const clientData: any = {
    name: otherParams.name || 'New Client',
    status: statusName,
    tasks: [], comments: [], labelIds: [],
    sourceId: crmSource, customFields: {},
    notes: otherParams.notes || '',
    createdFrom: 'api', createdAt: Date.now(),
  };

  const customFieldsSnapshot = await userRef.collection('customFields').get();
  const definedFields = customFieldsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  const additions: string[] = [];

  // Load reference lists only for the system fields that are actually mapped, so
  // mapped values can be resolved by exact-name match (see resolveSystemField).
  const mappedFieldIds = new Set(mappings.map((m: any) => m.fieldId).filter(Boolean));
  const refs = await loadMappingRefs(userRef, userId, mappedFieldIds);

  for (const [key, value] of Object.entries(otherParams)) {
    if (key === 'notes') continue;
    const mapping = mappings.find((m: any) => m.key === key && m.fieldId);
    if (mapping) {
      resolveSystemField(clientData, mapping.fieldId, value, refs);
      continue;
    }
    const matchingField = definedFields.find((f: any) => f.name.toLowerCase() === key.toLowerCase() || f.id === key);
    if (matchingField) {
      clientData.customFields[matchingField.id] = value;
    } else if (key === 'name') {
      if (!mappings.some((m: any) => m.key === 'name' && m.fieldId === 'name')) clientData.name = value;
    } else {
      additions.push(`${key}: ${value}`);
    }
  }

  if (additions.length > 0) {
    clientData.notes = clientData.notes
      ? `${clientData.notes}\n\nUnmapped Params:\n${additions.join('\n')}`
      : `Unmapped Params:\n${additions.join('\n')}`;
  }

  const clientRef = await userRef.collection('clients').add(clientData);

  // ── Optional AI enrichment (merged from processNewClient) ──
  try {
    const userSettings = (await userRef.get()).data() || {};
    if (userSettings.aiEnabled && userSettings.geminiApiKey) {
      await enrichLeadWithAI(userId, clientRef, clientData, userSettings.geminiApiKey);
    }
  } catch (e: any) {
    console.error('[leads/inbound] AI enrichment failed:', e.message);
  }

  res.status(200).send('Lead added successfully');
});

// Reference lists used to resolve mapped system fields by exact name. Each list
// is only loaded when its system field is actually referenced by a mapping.
// (Mirrors NON_MAPPABLE_SYSTEM_FIELD_IDS in ../../types.ts: __name/__createdAt/
// __notes are never offered as targets, so they are not resolved here.)
interface MappingRefs {
  statuses: { name: string }[];
  labels: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  members: { id: string; name: string; email: string }[];
}

async function loadMappingRefs(
  userRef: FirebaseFirestore.DocumentReference,
  userId: string,
  mappedFieldIds: Set<string>,
): Promise<MappingRefs> {
  const refs: MappingRefs = { statuses: [], labels: [], sources: [], members: [] };

  if (mappedFieldIds.has('__status')) {
    const snap = await userRef.collection('statuses').get();
    refs.statuses = snap.docs.map(d => ({ name: d.data().name }));
  }
  if (mappedFieldIds.has('__labels')) {
    const snap = await userRef.collection('labels').where('module', '==', 'client').get();
    refs.labels = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
  }
  if (mappedFieldIds.has('__sourceId')) {
    const snap = await userRef.collection('leadSources').get();
    refs.sources = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
  }
  if (mappedFieldIds.has('__assignedTo')) {
    const snap = await userRef.collection('team_members').get();
    for (const d of snap.docs) {
      const data = d.data();
      let name = data.displayName || (data.email ? String(data.email).split('@')[0] : '');
      try {
        const profile = await adminDb.collection('users').doc(d.id).get();
        if (profile.exists) name = profile.data()?.displayName || name;
      } catch { /* ignore */ }
      refs.members.push({ id: d.id, name, email: data.email || '' });
    }
    try {
      const owner = (await userRef.get()).data();
      if (owner) refs.members.push({ id: userId, name: owner.displayName || '', email: owner.email || '' });
    } catch { /* ignore */ }
  }

  return refs;
}

// Apply a single mapped value to the client. System fields resolve by exact-name
// match against their reference list; a value that matches nothing is ignored
// (never dumped into customFields). Everything else is a real custom field.
function resolveSystemField(clientData: any, fieldId: string, value: string, refs: MappingRefs) {
  const v = (value ?? '').trim();
  switch (fieldId) {
    case 'name':
    case '__name':
      clientData.name = value;
      return;
    case '__status': {
      const match = refs.statuses.find(s => (s.name || '').trim() === v);
      if (match) clientData.status = match.name;
      return;
    }
    case '__labels': {
      const match = refs.labels.find(l => (l.name || '').trim() === v);
      if (match && !clientData.labelIds.includes(match.id)) clientData.labelIds.push(match.id);
      return;
    }
    case '__sourceId': {
      const match = refs.sources.find(s => (s.name || '').trim() === v);
      if (match) clientData.sourceId = match.id;
      return;
    }
    case '__assignedTo': {
      const match = refs.members.find(
        m => (m.email || '').trim().toLowerCase() === v.toLowerCase() || (m.name || '').trim() === v,
      );
      if (match) clientData.assignedTo = match.id;
      return;
    }
    case '__createdAt':
    case '__notes':
      // System-managed / catch-all fields — never set via mapping.
      return;
    default:
      clientData.customFields[fieldId] = value;
  }
}

async function enrichLeadWithAI(
  userId: string,
  clientRef: FirebaseFirestore.DocumentReference,
  clientData: any,
  encryptedKey: string,
) {
  const labelsSnapshot = await adminDb
    .collection('users').doc(userId).collection('labels').where('module', '==', 'client').get();
  const labels = labelsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

  const prompt = `
        Analyze the following customer inquiry and categorize it using the provided labels. Also provide a brief summary in Hebrew.

        Customer Inquiry:
        Name: ${clientData.name}
        Notes/Message: ${clientData.notes || ''}
        Custom Fields: ${JSON.stringify(clientData.customFields || {})}

        Available Labels:
        ${labels.map(l => l.name).join(', ')}

        Output JSON format:
        {
          "tags": ["tag1", "tag2"],
          "summary": "סיכום בעברית..."
        }
      `;

  try {
    const genAI = new GoogleGenerativeAI(decryptApiKey(encryptedKey));
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiData = JSON.parse(jsonMatch[0]);
      const updates: any = { aiSummary: aiData.summary || null, labelIds: clientData.labelIds || [] };
      if (Array.isArray(aiData.tags)) {
        const matchedLabelIds = aiData.tags
          .map((tagName: string) => labels.find(l => l.name === tagName)?.id)
          .filter((id: string | undefined) => id);
        if (matchedLabelIds.length > 0) {
          updates.labelIds = [...new Set([...updates.labelIds, ...matchedLabelIds])];
        }
      }
      await clientRef.update(updates);
    } else {
      await clientRef.update({ aiSummary: 'שגיאה: לא ניתן לעבד את תגובת ה-AI.' });
    }
  } catch (error: any) {
    await clientRef.update({ aiSummary: `שגיאה: ${error.message}` });
  }
}
