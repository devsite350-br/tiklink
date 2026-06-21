# Simpofy CRM — Standalone

מערכת CRM לניהול לקוחות, משימות, פגישות, מסמכים, וואטסאפ ואימייל — בגרסת **standalone**
ללקוח בודד, שמיועדת לפריסה ב-[Vercel](https://vercel.com) עם [Firebase](https://firebase.google.com)
במסלול החינמי (Spark).

הגרסה הזו הומרה ממערכת SaaS רב-לקוחית: הוסרה כל שכבת ניהול המנויים/התוכניות,
וכל הלוגיקה בצד-השרת רצה כ-**Vercel Serverless Functions** (תיקיית `api/`) במקום
Firebase Cloud Functions — כך שאין צורך במסלול Blaze בתשלום.

## ארכיטקטורה

```
דפדפן (React PWA)
  ├── Firebase Auth (client SDK)            → התחברות + ID token
  ├── Firestore (client SDK, real-time)     → קריאה/כתיבה לפי security rules
  └── fetch('/api/...') + Bearer ID token   → Vercel Functions
Vercel
  ├── Static build (Vite)                   → ה-frontend
  └── /api/* (Serverless Functions)
        ├── firebase-admin (Service Account)→ גישה ל-Firestore
        ├── Resend / Gmail / SMTP           → מיילים
        ├── Google Calendar API             → סנכרון יומן
        ├── Vercel Blob                     → קבצים/תמונות
        └── Gemini (מפתח המשתמש, אופציונלי) → העשרת לידים
```

כל פונקציה תחת `/api` מאמתת `Authorization: Bearer <Firebase ID Token>` באמצעות
`admin.auth().verifyIdToken()` לפני ביצוע פעולה. ה-webhooks הציבוריים
(`leads`, `tasks`, `whatsapp`) מוגנים ב-secret אופציונלי בכתובת.

## הרצה מקומית

דרישות מקדימות: Node.js 18+.

```bash
npm install
cp .env.example .env.local   # מלא את הערכים
npm run dev                  # ה-frontend בלבד (vite)
```

להרצה מקומית של גם ה-frontend וגם פונקציות ה-`api/` ביחד, השתמש ב-Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

## פריסה

הקמת לקוח חדש מהתבנית (ברובה אוטומטית, `npm run setup`) — ראה
**[TEMPLATE_SETUP.md](./TEMPLATE_SETUP.md)**.

מדריך הקמה ופריסה ידני ומפורט (Firebase + Google Cloud + Resend + Vercel) נמצא בקובץ
**[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## מבנה התיקיות

```
api/                 ← Vercel Serverless Functions (backend)
  _lib/              ← admin SDK, auth, google OAuth, crypto, email, calendar, whatsapp
  send-email.ts, whatsapp/, leads/, tasks/, meetings/, calendar/, gmail/, ai/, upload.ts
components/          ← React components
context/             ← AppContext (state + data layer)
utils/apiClient.ts   ← קליינט ל-API + העלאת קבצים ל-Blob
firebaseConfig.ts    ← אתחול Firebase מתוך VITE_* env
firestore.rules      ← כללי אבטחה
vercel.json          ← הגדרות build/functions
.env.example         ← כל משתני הסביבה עם הסבר
```
