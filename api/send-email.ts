import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUid, resolveOwnerUid, parseBody, withErrorHandling, HttpError } from './_lib/http';
import { sendEmail } from './_lib/email';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const callerUid = await requireUid(req);
  const { to, subject, body, ownerUid } = parseBody(req);
  if (!to || !subject) throw new HttpError(400, 'שדות "to" ו-"subject" הם חובה.');

  const resolvedOwner = await resolveOwnerUid(callerUid, ownerUid);
  const result = await sendEmail(resolvedOwner, callerUid, {
    to: String(to).trim(),
    subject: String(subject),
    body: String(body || ''),
  });
  res.status(200).json(result);
});
