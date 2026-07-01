import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireUid, resolveOwnerUid, parseBody, withErrorHandling, HttpError } from '../_lib/http';
import { adminDb } from '../_lib/admin';
import { encryptApiKey, maskApiKey, decryptApiKey } from '../_lib/crypto';

// GET  /api/ai/settings — returns { aiEnabled, maskedKey, hasKey }
// POST /api/ai/settings — body { aiEnabled, apiKey? } → saves (key encrypted)
// POST /api/ai/settings — body { action: 'summarize', ownerUid?, clientId }
//   → generates a manual, on-demand AI summary for a single card and returns
//     { aiSummary, aiSummaryUpdatedAt }. (Merged here rather than as its own
//     file to stay under the Hobby 12-function cap.)
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
    const body = parseBody(req);

    if (body.action === 'summarize') {
      await handleSummarize(uid, body, res);
      return;
    }

    const { aiEnabled, apiKey } = body;
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

// ── Manual on-demand card summary ──────────────────────────────────────────
// Unlike the automatic enrichment in /api/leads/inbound (which only analyses the
// initial inbound inquiry), this summary is built from the *current, full* card:
// name, labels, notes, custom fields, tasks, comments and activity history.
//
// The Gemini API key never leaves the server: the client only sends a card id,
// the handler loads the card server-side, calls Gemini, and writes back the
// result. Status is deliberately excluded from the prompt as a live value — only
// the last dated status-change event (from the activity log) is passed, so a
// stale summary can never misreport the current status.
async function handleSummarize(callerUid: string, body: any, res: VercelResponse) {
  const { ownerUid, clientId } = body;
  if (!clientId) throw new HttpError(400, 'clientId is required');

  const owner = await resolveOwnerUid(callerUid, ownerUid);
  const userRef = adminDb.collection('users').doc(owner);

  const userSettings = (await userRef.get()).data() || {};
  if (!userSettings.aiEnabled) {
    throw new HttpError(400, 'עיבוד AI כבוי. יש להפעיל אותו בהגדרות ה-AI.');
  }
  if (!userSettings.geminiApiKey) {
    throw new HttpError(400, 'לא הוגדר מפתח API של Gemini בהגדרות ה-AI.');
  }

  const clientRef = userRef.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  if (!clientDoc.exists) throw new HttpError(404, 'הכרטיס לא נמצא.');
  const client: any = clientDoc.data();

  // Resolve custom-field and label ids to their human-readable names so the
  // model gets meaningful context instead of opaque ids.
  const [customFieldsSnapshot, labelsSnapshot] = await Promise.all([
    userRef.collection('customFields').get(),
    userRef.collection('labels').where('module', '==', 'client').get(),
  ]);
  const fieldNameById: Record<string, string> = {};
  customFieldsSnapshot.docs.forEach(d => { fieldNameById[d.id] = (d.data() as any).name || d.id; });
  const labelNameById: Record<string, string> = {};
  labelsSnapshot.docs.forEach(d => { labelNameById[d.id] = (d.data() as any).name || d.id; });

  const prompt = buildSummaryPrompt(client, fieldNameById, labelNameById);

  const genAI = new GoogleGenerativeAI(decryptApiKey(userSettings.geminiApiKey));
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);
  const summary = (await result.response).text().trim();
  if (!summary) throw new HttpError(502, 'ה-AI לא החזיר סיכום. נסה שוב.');

  const aiSummaryUpdatedAt = Date.now();
  await clientRef.update({ aiSummary: summary, aiSummaryUpdatedAt });

  res.status(200).json({ aiSummary: summary, aiSummaryUpdatedAt });
}

const formatDate = (ts?: number): string =>
  ts ? new Date(ts).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

function buildSummaryPrompt(
  client: any,
  fieldNameById: Record<string, string>,
  labelNameById: Record<string, string>,
): string {
  const sections: string[] = [];

  sections.push(`שם: ${client.name || 'ללא שם'}`);

  const labelNames = (client.labelIds || []).map((id: string) => labelNameById[id]).filter(Boolean);
  if (labelNames.length) sections.push(`תוויות: ${labelNames.join(', ')}`);

  if (client.notes && String(client.notes).trim()) {
    sections.push(`הערות:\n${client.notes}`);
  }

  const customFields = client.customFields || {};
  const customFieldLines = Object.entries(customFields)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([id, v]) => `- ${fieldNameById[id] || id}: ${v}`);
  if (customFieldLines.length) sections.push(`שדות מותאמים אישית:\n${customFieldLines.join('\n')}`);

  const tasks = Array.isArray(client.tasks) ? client.tasks : [];
  if (tasks.length) {
    const taskLines = tasks.map((t: any) => `- [${t.isCompleted ? 'הושלם' : 'פתוח'}] ${t.text}`);
    sections.push(`משימות:\n${taskLines.join('\n')}`);
  }

  const comments = Array.isArray(client.comments) ? client.comments : [];
  if (comments.length) {
    const commentLines = comments
      .filter((c: any) => c.text && String(c.text).trim())
      .map((c: any) => `- ${formatDate(c.timestamp)}${c.authorName ? ` (${c.authorName})` : ''}: ${c.text}`);
    if (commentLines.length) sections.push(`תגובות:\n${commentLines.join('\n')}`);
  }

  const activityLog = Array.isArray(client.activityLog) ? client.activityLog : [];
  const nonStatusActivity = activityLog
    .filter((e: any) => e.type !== 'status_change')
    .map((e: any) => `- ${formatDate(e.timestamp)}: ${e.title}${e.description ? ` — ${e.description}` : ''}`);
  if (nonStatusActivity.length) sections.push(`היסטוריית פעילות:\n${nonStatusActivity.join('\n')}`);

  // Status handling: never expose the live status. Pass only the most recent
  // status-change event as a dated historical fact.
  const statusChanges = activityLog
    .filter((e: any) => e.type === 'status_change' && e.toStatus)
    .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
  const lastStatusChange = statusChanges[statusChanges.length - 1];
  let statusInstruction = 'אין אירוע שינוי סטטוס בכרטיס — אין להזכיר סטטוס כלל.';
  if (lastStatusChange) {
    statusInstruction =
      `שינוי הסטטוס האחרון: בתאריך ${formatDate(lastStatusChange.timestamp)} הסטטוס שונה ל-"${lastStatusChange.toStatus}". ` +
      `יש להתייחס לסטטוס אך ורק כאירוע היסטורי מתוארך בנוסח "בתאריך X הסטטוס שונה ל-Y". אין לתאר את הסטטוס כמצב נוכחי.`;
  }

  return `אתה עוזר ב-CRM. סכם את הכרטיס הבא בעברית.

הנחיות:
- כתוב פסקה קצרה של 2-4 משפטים בלבד.
- כסה את המצב, מה נעשה עד כה, והצעד הבא המומלץ.
- אל תמציא מידע שאינו קיים בכרטיס.
- ${statusInstruction}

פרטי הכרטיס:
${sections.join('\n\n')}`;
}
