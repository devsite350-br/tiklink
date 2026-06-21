import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirst, validateWebhook, withErrorHandling } from '../_lib/http';
import { adminDb, FieldValue } from '../_lib/admin';

// Public webhook: add a task to the "unassociated" client.
// URL: /api/tasks/inbound?crmSource=..&userId=..&name=..&secret=..
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const crmSource = getFirst(req.query.crmSource);
  const userId = getFirst(req.query.userId);
  const name = getFirst(req.query.name);
  if (!crmSource || !userId || !name) {
    res.status(400).send('Missing required parameters: crmSource, userId, name');
    return;
  }
  validateWebhook(req, userId);

  const userRef = adminDb.collection('users').doc(userId);

  const sourceDoc = await userRef.collection('leadSources').doc(crmSource).get();
  if (!sourceDoc.exists) { res.status(404).send('Invalid lead source'); return; }

  const unassociatedRef = userRef.collection('clients').doc('unassociated_client_id');
  const unassociatedDoc = await unassociatedRef.get();

  const newTask = {
    id: `task_${Date.now()}`, text: name, isCompleted: false, isRunning: false, labelIds: [],
  };

  if (!unassociatedDoc.exists) {
    const statusesSnapshot = await userRef.collection('statuses').orderBy('order').limit(1).get();
    const statusName = statusesSnapshot.empty ? 'New' : statusesSnapshot.docs[0].data().name;
    await unassociatedRef.set({
      name: 'משימות כלליות', status: statusName, tasks: [newTask],
      comments: [], customFields: {}, labelIds: [], createdAt: Date.now(),
    });
  } else {
    await unassociatedRef.update({ tasks: FieldValue.arrayUnion(newTask) });
  }

  res.status(200).send('Task added successfully');
});
