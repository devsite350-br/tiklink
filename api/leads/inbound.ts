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

  for (const [key, value] of Object.entries(otherParams)) {
    if (key === 'notes') continue;
    const mapping = mappings.find((m: any) => m.key === key);
    if (mapping) {
      if (mapping.fieldId === 'name') clientData.name = value;
      else clientData.customFields[mapping.fieldId] = value;
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
