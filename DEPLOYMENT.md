# מדריך פריסה — Simpofy CRM Standalone

מדריך זה מסביר כיצד להקים ולפרוס עותק חדש של המערכת ללקוח בודד, מאפס ועד אונליין,
תוך שימוש אך ורק במסלולים חינמיים (חוץ מ-AI שהוא אופציונלי ובאחריות הלקוח).

> סדר העבודה המומלץ: **Firebase → Google Cloud → Resend → Vercel → התאמות סופיות**.

---

## שלב 0 — יצירת העותק (Repository)

1. ב-GitHub: לחץ **Use this template → Create a new repository** (או בצע fork/clone).
2. שמור את שם ה-repo — תחבר אותו ל-Vercel בהמשך.

---

## שלב 1 — Firebase (Spark / חינמי)

1. היכנס ל-[Firebase Console](https://console.firebase.google.com) → **Add project**.
   אין צורך ב-Google Analytics.
2. **Build → Authentication → Get started** → בלשונית **Sign-in method** הפעל:
   - **Email/Password**
   - **Google** (אופציונלי, להתחברות מהירה)
3. **Build → Firestore Database → Create database** → בחר מצב **Production** ואזור
   (למשל `eur3` / `me-west1`).
4. השג את ה-**Firebase Web config** (לפרונט-אנד):
   - ⚙️ **Project settings → General → Your apps → Web app (`</>`)** → צור אפליקציית web.
   - העתק את הערכים: `apiKey`, `authDomain`, `projectId`, `storageBucket`,
     `messagingSenderId`, `appId`. אלו יוזנו כ-`VITE_FIREBASE_*` ב-Vercel.
5. השג את ה-**Service Account** (לבק-אנד):
   - ⚙️ **Project settings → Service accounts → Generate new private key** → יורד קובץ JSON.
   - המר אותו ל-base64 (מומלץ, כדי שלא יישברו שורות בהדבקה):
     ```bash
     base64 -w0 serviceAccount.json   # Linux
     base64 -i serviceAccount.json    # macOS
     ```
     שמור את הפלט — זהו הערך של `FIREBASE_SERVICE_ACCOUNT`.
6. פרוס את כללי האבטחה (`firestore.rules`). אפשרות א' (CLI):
   ```bash
   npx firebase-tools login
   npx firebase-tools use <PROJECT_ID>
   npm run rules:deploy
   ```
   אפשרות ב' (ידני): העתק את תוכן `firestore.rules` ל-**Firestore → Rules → Publish**.

> **אין צורך** ב-Cloud Functions, ב-Storage או במסלול Blaze. כל אלו הוחלפו ב-Vercel.

---

## שלב 2 — Google Cloud OAuth (Gmail + Calendar, חינמי)

נדרש רק אם רוצים סנכרון יומן Google ו/או שליחת מייל דרך חשבון Gmail.

1. היכנס ל-[Google Cloud Console](https://console.cloud.google.com) ובחר את אותו
   הפרויקט שנוצר ע"י Firebase.
2. **APIs & Services → Library** → הפעל:
   - **Google Calendar API**
   - **Gmail API**
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**, מצב **Testing** (עד 100 משתמשים — מספיק לארגון בודד).
   - הוסף את כתובת המייל של הבעלים תחת **Test users**.
   - Scopes: ניתן להשאיר ריק (האפליקציה מבקשת scopes בזמן ההתחברות).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: כתובת ה-Vercel (למשל `https://your-app.vercel.app`)
     וגם `http://localhost:3000` לפיתוח.
   - **Authorized redirect URIs**: הוסף את **כתובת השורש** של האתר (כפי שמופיע בקוד):
     - `https://your-app.vercel.app/`
     - `https://your-app.vercel.app/settings` (אם משתמשים בחיבור Gmail מעמוד ההגדרות)
     - `http://localhost:3000/`
   - שמור את ה-**Client ID** וה-**Client secret** → `GOOGLE_OAUTH_CLIENT_ID` /
     `GOOGLE_OAUTH_CLIENT_SECRET`.

> את ה-redirect URIs המדויקים אפשר לעדכן שוב אחרי שתדע את הדומיין הסופי של Vercel (שלב 6).

---

## שלב 3 — Resend (אימייל fallback, חינמי) — אופציונלי

שליחת מייל עובדת לפי סדר עדיפויות: **Gmail OAuth → SMTP מותאם → Resend**.
Resend משמש כברירת מחדל כשהמשתמש לא חיבר Gmail/SMTP.

1. הירשם ל-[Resend](https://resend.com) → **API Keys → Create API Key** → `RESEND_API_KEY`.
2. (מומלץ) אמת דומיין משלך תחת **Domains**, וקבע כתובת שולח, למשל
   `CRM <crm@yourdomain.com>` → `RESEND_FROM_EMAIL`.
   ללא דומיין מאומת אפשר להשתמש בכתובת הבדיקה `onboarding@resend.dev`.

---

## שלב 4 — WhatsApp (Green API) — אופציונלי

המערכת תומכת ב-[Green API](https://green-api.com) לקליטה ושליחה של הודעות וואטסאפ.

1. צור instance ב-Green API וקבל `idInstance` ו-`apiTokenInstance`.
2. את הפרטים מזינים **בתוך המערכת** (הגדרות → וואטסאפ), לא ב-env.
3. כתובת ה-webhook לקליטת הודעות מוצגת באותו מסך — מדביקים אותה ב-Green API.
   הכתובת תהיה בפורמט:
   `https://your-app.vercel.app/api/whatsapp/inbound?userId=<UID>&secret=<WEBHOOK_SECRET>`

---

## שלב 5 — Vercel (Hosting + Backend)

1. היכנס ל-[Vercel](https://vercel.com) → **Add New → Project** → ייבא את ה-repo מ-GitHub.
2. Framework Preset: **Vite** (מזוהה אוטומטית). Build/Output כבר מוגדרים ב-`vercel.json`.
3. **Storage → Create → Blob** (לאחסון קבצים/תמונות) → **Connect to Project**.
   Vercel יזריק אוטומטית `BLOB_STORE_ID` ו-`BLOB_WEBHOOK_PUBLIC_KEY` לפרויקט.
   אין צורך בהגדרה ידנית נוספת.
4. **Settings → Environment Variables** — הזן את כל המשתנים (ראה `.env.example`):

   | משתנה | סוג | ערך |
   |---|---|---|
   | `VITE_FIREBASE_API_KEY` | Public | מ-Firebase Web config |
   | `VITE_FIREBASE_AUTH_DOMAIN` | Public | מ-Firebase Web config |
   | `VITE_FIREBASE_PROJECT_ID` | Public | מ-Firebase Web config |
   | `VITE_FIREBASE_STORAGE_BUCKET` | Public | מ-Firebase Web config |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | Public | מ-Firebase Web config |
   | `VITE_FIREBASE_APP_ID` | Public | מ-Firebase Web config |
   | `VITE_WEBHOOK_SECRET` | Public | זהה ל-`WEBHOOK_SECRET` (אופציונלי) |
   | `VITE_SUPER_ADMIN_EMAIL` | Public | אימייל הסופר-אדמין (מסך ניהול + impersonation). זהה לאימייל ב-`firestore.rules` |
   | `FIREBASE_SERVICE_ACCOUNT` | Secret | ה-JSON ב-base64 (שלב 1.5) |
   | `GOOGLE_OAUTH_CLIENT_ID` | Secret | שלב 2 |
   | `GOOGLE_OAUTH_CLIENT_SECRET` | Secret | שלב 2 |
   | `RESEND_API_KEY` | Secret | שלב 3 (אופציונלי) |
   | `RESEND_FROM_EMAIL` | Secret | שלב 3 (אופציונלי) |
   | `APP_ENCRYPTION_KEY` | Secret | מחרוזת אקראית ארוכה (`openssl rand -hex 32`) |
   | `WEBHOOK_SECRET` | Secret | מחרוזת אקראית (אופציונלי) |
   | `OWNER_UID` | Secret | ה-UID של הבעלים (אופציונלי, מומלץ) |

   > הערה: משתני `VITE_*` נצרבים בזמן ה-build וגלויים בדפדפן — אל תכניס בהם סודות אמיתיים.
   > כל שאר המשתנים נשארים בצד-שרת בלבד.

5. לחץ **Deploy**. בסיום תקבל כתובת `https://your-app.vercel.app`.

---

## שלב 6 — התאמות סופיות

1. **עדכון redirect URIs**: חזור ל-Google Cloud (שלב 2.4) ועדכן את ה-origins וה-redirect
   URIs לדומיין הסופי של Vercel (כולל דומיין מותאם אם הגדרת כזה).
2. **משתמש ראשון**: היכנס לאתר והירשם (Email/Password או Google). זהו חשבון הבעלים.
3. **הגדרת `OWNER_UID`** (מומלץ): מצא את ה-UID של הבעלים ב-Firebase Console
   (**Authentication → Users**), הזן אותו כמשתנה `OWNER_UID` ב-Vercel ובצע **Redeploy**.
   כך ה-webhooks הציבוריים יקבלו רק את החשבון הזה.
4. **בדיקות קצה לקצה**:
   - יצירת/עריכת/מחיקת לקוח (Firestore).
   - חיבור יומן Google (הגדרות → יומן) ויצירת פגישה → בדוק שהאירוע מופיע ב-Google Calendar.
   - חיבור Gmail או הגדרת Resend → שלח מייל דרך אוטומציה.
   - העלאת תמונת פרופיל / תמונה בתגובה → נשמרת ב-Vercel Blob.
   - אם משתמשים ב-AI: הגדרות → AI → הזן מפתח Gemini, ובדוק העשרת ליד שמגיע דרך webhook.

---

## טבלת מיפוי: Cloud Functions → Vercel API

| פונקציה מקורית | יעד חדש |
|---|---|
| `sendEmail` | `POST /api/send-email` |
| `sendWhatsAppMessage` | `POST /api/whatsapp/send` |
| `addWhatsAppMessage` (webhook) | `POST /api/whatsapp/inbound` |
| `addLead` (webhook) + `processNewClient` (trigger) | `POST /api/leads/inbound` (כולל העשרת AI) |
| `addTask` (webhook) | `POST /api/tasks/inbound` |
| `onMeetingCreate/Update/Delete` (triggers) | `POST/PATCH/DELETE /api/meetings[/:id]` |
| `resyncAllMeetings` | `POST /api/calendar/resync` |
| `getGoogleAuthUrl` / `googleAuthCallback` | `POST /api/calendar/auth-url` / `callback` |
| `getGmailAuthUrl` / `gmailAuthCallback` | `POST /api/gmail/auth-url` / `callback` |
| `saveAISettings` / `getAISettings` | `POST/GET /api/ai/settings` |
| העלאת קבצים (Firebase Storage) | `POST /api/upload` (Vercel Blob) |
| `listUsers`, `getUsersWithStats`, `setUserPlan`, `setUserBlockedModules`, `setUserEntityLabel`, `getImpersonateToken`, `deleteUserAccount`, `onClientCreate`, `onClientDelete`, `debugCalendarSync` | **הוסרו** (שכבת SaaS) |

---

## הערות ואבטחה

- **Firestore Rules**: הבק-אנד עובד עם Service Account ולכן עוקף את ה-rules. ה-rules
  נשארים הדוקים מול גישה ישירה של ה-client SDK (בעלים + חברי צוות בלבד).
- **Webhooks ציבוריים**: כשמוגדר `WEBHOOK_SECRET`, יש לכלול `secret=...` בכתובת.
  כשמוגדר `OWNER_UID`, נדחה כל `userId` אחר.
- **מפתח Gemini**: נשמר **מוצפן** ב-Firestore (AES-256-GCM) לפי `APP_ENCRYPTION_KEY`.
  אל תשנה את `APP_ENCRYPTION_KEY` אחרי שנשמרו מפתחות — אחרת לא ניתן יהיה לפענח אותם.
- **Push notifications**: ההתראות הן מקומיות בדפדפן (Web Notifications + Service Worker),
  אינן דורשות שליחת FCM מצד-שרת, ולכן אין צורך בהגדרה נוספת.
- **Vercel Hobby**: מסלול ה-Hobby מיועד לשימוש לא-מסחרי. לשימוש מסחרי יש לשדרג ל-Pro.
