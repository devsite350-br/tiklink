import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { requireUid, resolveOwnerUid, parseBody, withErrorHandling, HttpError } from './_lib/http';
import { adminDb, FieldValue } from './_lib/admin';
import { makeOAuthClient, CALENDAR_SCOPES } from './_lib/google';
import { syncMeetingToCalendars } from './_lib/calendar';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const body = parseBody(req);
  const action = body.action as string;

  if (action === 'auth-url') {
    const uid = await requireUid(req);
    const { redirectUri } = body;
    if (!redirectUri) throw new HttpError(400, 'redirectUri is required');
    const oauth2Client = makeOAuthClient(redirectUri);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: CALENDAR_SCOPES,
      state: uid,
    });
    res.status(200).json({ url }); return;
  }

  if (action === 'callback') {
    const uid = await requireUid(req);
    const { code, redirectUri } = body;
    if (!code || !redirectUri) throw new HttpError(400, 'code and redirectUri are required');
    const oauth2Client = makeOAuthClient(redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    if (!tokens.refresh_token) {
      throw new HttpError(400,
        'לא התקבל refresh token מגוגל. נסה להסיר את ההרשאה באתר https://myaccount.google.com/permissions ולהתחבר מחדש.');
    }
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;
    const calendarsRef = adminDb.collection('users').doc(uid).collection('connectedCalendars');
    const existing = await calendarsRef.where('email', '==', email).get();
    if (!existing.empty) {
      const batch = adminDb.batch();
      existing.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    await calendarsRef.add({
      email,
      refreshToken: tokens.refresh_token,
      createdAt: FieldValue.serverTimestamp(),
    });
    res.status(200).json({ success: true, email }); return;
  }

  if (action === 'resync') {
    const callerUid = await requireUid(req);
    const { ownerUid } = body;
    const owner = await resolveOwnerUid(callerUid, ownerUid);
    const meetingsSnap = await adminDb.collection('users').doc(owner).collection('meetings').get();
    if (meetingsSnap.empty) { res.status(200).json({ synced: 0, total: 0 }); return; }
    let synced = 0;
    for (const meetingDoc of meetingsSnap.docs) {
      try {
        const newEventIds = await syncMeetingToCalendars(owner, meetingDoc.data());
        if (Object.keys(newEventIds).length > 0) {
          await meetingDoc.ref.update({ googleEventIds: newEventIds });
          synced++;
        }
      } catch (err: any) {
        console.error(`[calendar/resync] Error syncing ${meetingDoc.id}:`, err.message);
      }
    }
    res.status(200).json({ synced, total: meetingsSnap.size }); return;
  }

  throw new HttpError(400, 'action must be auth-url | callback | resync');
});
