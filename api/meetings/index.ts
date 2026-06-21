import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUid, resolveOwnerUid, parseBody, withErrorHandling, HttpError } from '../_lib/http';
import { adminDb } from '../_lib/admin';
import { syncMeetingToCalendars } from '../_lib/calendar';

// POST /api/meetings — create a meeting (DB write + calendar sync, atomically).
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const callerUid = await requireUid(req);
  const { ownerUid, clientId, title, startTime, endTime, description, createdAt } = parseBody(req);
  if (!title || !startTime || !endTime) throw new HttpError(400, 'title, startTime, endTime are required');

  const owner = await resolveOwnerUid(callerUid, ownerUid);
  const meetingData: any = {
    clientId: clientId || '', title, startTime, endTime,
    description: description || '', createdAt: createdAt || Date.now(),
  };

  const ref = await adminDb.collection('users').doc(owner).collection('meetings').add(meetingData);

  const googleEventIds = await syncMeetingToCalendars(owner, meetingData);
  if (Object.keys(googleEventIds).length > 0) {
    await ref.update({ googleEventIds });
  }

  res.status(200).json({ id: ref.id, googleEventIds });
});
