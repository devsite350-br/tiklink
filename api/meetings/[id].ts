import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUid, resolveOwnerUid, parseBody, getFirst, withErrorHandling, HttpError } from '../_lib/http';
import { adminDb } from '../_lib/admin';
import { syncMeetingToCalendars } from '../_lib/calendar';

// PATCH /api/meetings/:id — update meeting (DB + calendar)
// DELETE /api/meetings/:id — delete meeting (DB + calendar)
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const callerUid = await requireUid(req);
  const meetingId = getFirst(req.query.id);
  if (!meetingId) throw new HttpError(400, 'Missing meeting id');

  const body = parseBody(req);
  const owner = await resolveOwnerUid(callerUid, body.ownerUid || getFirst(req.query.ownerUid));
  const meetingRef = adminDb.collection('users').doc(owner).collection('meetings').doc(meetingId);
  const existing = await meetingRef.get();
  if (!existing.exists) throw new HttpError(404, 'Meeting not found');
  const existingData = existing.data()!;

  if (req.method === 'DELETE') {
    await syncMeetingToCalendars(owner, existingData, true);
    await meetingRef.delete();
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const { ownerUid, id, googleEventIds, ...updates } = body;
    const merged = { ...existingData, ...updates };
    await meetingRef.set(updates, { merge: true });
    const newEventIds = await syncMeetingToCalendars(owner, merged);
    await meetingRef.update({ googleEventIds: newEventIds });
    res.status(200).json({ ok: true, googleEventIds: newEventIds });
    return;
  }

  throw new HttpError(405, 'Method not allowed');
});
