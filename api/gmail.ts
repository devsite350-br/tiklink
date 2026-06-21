import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { requireUid, parseBody, withErrorHandling, HttpError } from './_lib/http';
import { adminDb, FieldValue } from './_lib/admin';
import { makeOAuthClient, GMAIL_SCOPES } from './_lib/google';

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
      scope: GMAIL_SCOPES,
      state: JSON.stringify({ uid, flow: 'gmail' }),
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
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;
    await adminDb
      .collection('users').doc(uid)
      .collection('settings').doc('gmailConnection')
      .set({
        email,
        refreshToken: tokens.refresh_token || '',
        connectedAt: FieldValue.serverTimestamp(),
      });
    res.status(200).json({ success: true, email }); return;
  }

  throw new HttpError(400, 'action must be auth-url | callback');
});
