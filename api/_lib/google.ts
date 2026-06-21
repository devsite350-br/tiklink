// Google OAuth2 client factory. Credentials come from env vars (never hardcoded).
import { google } from 'googleapis';
import { HttpError } from './http';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const getCredentials = () => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new HttpError(500, 'Google OAuth is not configured (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET)');
  }
  return { clientId, clientSecret };
};

// Build an OAuth2 client. `redirectUri` is required for the auth-url / token
// exchange flows and omitted when refreshing an existing token.
export function makeOAuthClient(redirectUri?: string) {
  const { clientId, clientSecret } = getCredentials();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
