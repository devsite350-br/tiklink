// Email sending: Gmail OAuth → custom SMTP → Resend fallback. Ported from the
// original Cloud Function, with secrets read from env instead of functions.config().
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { adminAuth, adminDb } from './admin';
import { makeOAuthClient } from './google';

const wrapEmailHtml = (bodyText: string): string => {
  const content = bodyText.replace(/\n/g, '<br>');
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"></head><body style="direction:rtl;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222;margin:0;padding:20px;">${content}</body></html>`;
};

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}

// Sends an email on behalf of `ownerUid`. `callerUid` is used for the From name.
export async function sendEmail(
  ownerUid: string,
  callerUid: string,
  { to, subject, body }: SendEmailInput,
): Promise<SendEmailResult> {
  let fromName = '';
  let fromEmail = '';
  try {
    const userRecord = await adminAuth.getUser(callerUid);
    fromName = userRecord.displayName || '';
    fromEmail = userRecord.email || '';
  } catch { /* fallback below */ }

  // ── 1) Gmail OAuth ──
  const gmailDoc = await adminDb
    .collection('users').doc(ownerUid).collection('settings').doc('gmailConnection').get();
  const gmailConn = gmailDoc.exists ? gmailDoc.data() : null;

  if (gmailConn && gmailConn.refreshToken) {
    const oauth2Client = makeOAuthClient();
    oauth2Client.setCredentials({ refresh_token: gmailConn.refreshToken });
    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const senderEmail = gmailConn.email || fromEmail;
      const fromHeader = fromName ? `${fromName} <${senderEmail}>` : senderEmail;
      const rawMessage = [
        `From: ${fromHeader}`,
        `To: ${to}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        '',
        wrapEmailHtml(body),
      ].join('\r\n');
      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
      return { ok: true, messageId: result.data.id || undefined, provider: 'gmail' };
    } catch (e: any) {
      console.error('[sendEmail] Gmail send failed', e);
      return { ok: false, error: e.message || String(e) };
    }
  }

  // ── 2) Custom SMTP ──
  const settingsDoc = await adminDb
    .collection('users').doc(ownerUid).collection('settings').doc('email').get();
  const settings = settingsDoc.exists ? settingsDoc.data() : null;
  const hasSmtp = settings && settings.smtpHost && settings.smtpUser && settings.smtpPass;

  if (hasSmtp) {
    const transporter = nodemailer.createTransport({
      host: settings!.smtpHost,
      port: Number(settings!.smtpPort) || 587,
      secure: settings!.smtpSecure === true,
      auth: { user: settings!.smtpUser, pass: settings!.smtpPass },
    });
    const senderEmail = fromEmail || settings!.smtpUser;
    try {
      const info = await transporter.sendMail({
        from: fromName ? `"${fromName}" <${senderEmail}>` : senderEmail,
        to, subject, html: wrapEmailHtml(body),
      });
      return { ok: true, messageId: info.messageId, provider: 'smtp' };
    } catch (e: any) {
      console.error('[sendEmail] SMTP send failed', e);
      return { ok: false, error: e.message || String(e) };
    }
  }

  // ── 3) Resend (API key stored in Firestore by the tenant) ──
  const resendKey = settings?.resendApiKey || process.env.RESEND_API_KEY || '';
  if (!resendKey) {
    return { ok: false, error: 'שליחת מייל לא זמינה. יש להגדיר Gmail, SMTP או Resend בהגדרות.' };
  }
  const senderAddress = settings?.resendFromEmail || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: senderAddress, to: [to], subject, html: wrapEmailHtml(body) }),
    });
    const result = await res.json();
    if (!res.ok) {
      return { ok: false, error: result.message || `Resend error ${res.status}` };
    }
    return { ok: true, messageId: result.id, provider: 'resend' };
  } catch (e: any) {
    console.error('[sendEmail] Resend send failed', e);
    return { ok: false, error: e.message || String(e) };
  }
}
