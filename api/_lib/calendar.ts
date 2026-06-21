// Google Calendar sync. Ported from the original Cloud Function trigger, now
// invoked synchronously from the /api/meetings routes so the DB write and the
// calendar sync happen atomically in a single request.
import { google } from 'googleapis';
import { adminDb } from './admin';
import { makeOAuthClient } from './google';

export interface MeetingData {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  googleEventIds?: { [calendarId: string]: string };
}

// Create / update / delete the meeting's event across all connected calendars.
// Returns the updated googleEventIds map.
export const syncMeetingToCalendars = async (
  userId: string,
  meetingData: MeetingData,
  isDelete = false,
): Promise<{ [calendarId: string]: string }> => {
  const calendarsSnapshot = await adminDb
    .collection('users').doc(userId).collection('connectedCalendars').get();
  if (calendarsSnapshot.empty) return {};

  const newGoogleEventIds: { [calendarId: string]: string } = { ...(meetingData.googleEventIds || {}) };

  for (const doc of calendarsSnapshot.docs) {
    const calendarData = doc.data();
    if (!calendarData.refreshToken) continue;

    const oauth2Client = makeOAuthClient();
    oauth2Client.setCredentials({ refresh_token: calendarData.refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const eventId = newGoogleEventIds[doc.id];

    try {
      if (isDelete) {
        if (eventId) {
          await calendar.events.delete({ calendarId: 'primary', eventId });
          delete newGoogleEventIds[doc.id];
        }
      } else {
        const eventResource = {
          summary: meetingData.title,
          description: meetingData.description,
          start: { dateTime: meetingData.startTime, timeZone: 'Asia/Jerusalem' },
          end: { dateTime: meetingData.endTime, timeZone: 'Asia/Jerusalem' },
        };
        if (eventId) {
          await calendar.events.update({ calendarId: 'primary', eventId, requestBody: eventResource });
        } else {
          const res = await calendar.events.insert({ calendarId: 'primary', requestBody: eventResource });
          if (res.data.id) newGoogleEventIds[doc.id] = res.data.id;
        }
      }
    } catch (error: any) {
      console.error(`[calendar] Error syncing calendar ${doc.id}:`, error.message);
    }
  }
  return newGoogleEventIds;
};
