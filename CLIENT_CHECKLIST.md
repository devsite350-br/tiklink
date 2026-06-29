# ✅ צ'קליסט שכפול לקוח חדש

תהליך שכפול הסביבה ללקוח חדש. רוב העבודה אוטומטית דרך `npm run setup`.
לכל לקוח: **ריפו GitHub חדש + פרויקט Firebase חדש + חשבון/פרויקט Vercel חדש**.

> מקרא: **[ידני]** = פעולה שאתה עושה בקונסולה/דפדפן · **[אוטו]** = הסקריפט עושה לבד.

---

## שלב 0 — לפני שמתחילים (פעם אחת)
- [ ] ודא שמותקנים: `node`, `git`, ו-CLIs: `vercel`, `gcloud`, `firebase-tools` (האחרונים מגיעים עם `npm install`).
- [ ] החלט מה האימייל של **הסופר-אדמין** ללקוח הזה (האימייל שלך לניהול). זה קריטי — ראה שלב 4ב.

---

## שלב 1 — **[ידני]** יצירת הריפו מהתבנית
- [ ] ב-GitHub → ריפו התבנית `devsite350-br/tiklink` → **Use this template → Create a new repository**.
- [ ] בחר owner/שם לריפו הלקוח (למשל `your-org/client-name`).
- [ ] שכפל למחשב והיכנס לתיקייה:
  ```bash
  git clone https://github.com/<org>/<client-name>.git
  cd <client-name>
  npm install
  ```

---

## שלב 2 — **[ידני]** יצירת פרויקט Firebase + Web App
- [ ] [Firebase Console](https://console.firebase.google.com) → **Add project** (ללא Google Analytics).
- [ ] **Project settings → General → Your apps → Web (`</>`)** → רשום אפליקציית web.
- [ ] העתק את ערכי ה-config: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
- [ ] (מומלץ) **Authentication → Get started** ובדוק ש-**Email/Password** מופעל. הסקריפט מנסה להפעיל לבד; זה רק fallback.
- [ ] Firestore — אפשר לדלג (הסקריפט יוצר). אם יוצרים ידנית: מצב **Production**.

---

## שלב 3 — **[ידני]** התחברות ל-CLIs לחשבונות הלקוח
החשבונות שונים מלקוח ללקוח — חובה להתחבר מחדש בכל שכפול:
- [ ] `npx vercel login` — חשבון/team ה-Vercel של הלקוח
- [ ] `gcloud auth login` — חשבון Google שהוא **owner** של פרויקט ה-Firebase
- [ ] `npx firebase-tools login` — אותו חשבון Google
- [ ] `gcloud config set project <PROJECT_ID>`
- [ ] ודא זהות נכונה: `vercel whoami` ו-`gcloud config get-value account`

---

## שלב 4 — קונפיג + הרצת הסקריפט

### 4א. מילוי הקונפיג
- [ ] העתק את התבנית (הקובץ `setup.config.json` ב-`.gitignore`, לא נכנס לריפו):
  ```bash
  cp setup.config.example.json setup.config.json
  ```
- [ ] מלא בו: `vercelProjectName`, `githubRepo` (כתובת הריפו החדש), `superAdminEmail`, ובלוק `firebase` מהשלב הקודם.

### 4ב. ⚠️ קריטי — אימייל הסופר-אדמין ב-firestore.rules
האימייל מוקשח בקוד ב-`firestore.rules` (כרגע `devsite350@gmail.com`, בשתי שורות).
**אם הסופר-אדמין של הלקוח שונה** — חובה לעדכן בשני המקומות, אחרת ההרשאות לא יעבדו:
- [ ] ערוך את `firestore.rules` והחלף את כל `'devsite350@gmail.com'` באימייל הסופר-אדמין של הלקוח.
- [ ] ודא שזה **בדיוק** אותו ערך כמו `superAdminEmail` ב-`setup.config.json`.
- [ ] (אם משאיר את אותו אימייל סופר-אדמין לכל הלקוחות — אפשר לדלג על 4ב.)

### 4ג. הרצה
- [ ] ```bash
  npm run setup
  ```
- [ ] בסיום — שמור את **כתובת הפרודקשן** שהסקריפט מדפיס.

הסקריפט מבצע אוטומטית (idempotent — בטוח להריץ שוב אם נכשל באמצע):
קישור פרויקט Vercel · יצירת `APP_ENCRYPTION_KEY`+`WEBHOOK_SECRET` · כל משתני הסביבה בכל הסביבות ·
יצירת Firestore + פריסת rules · מפתח Service Account → `FIREBASE_SERVICE_ACCOUNT` ·
הפעלת Email/Password · יצירת+חיבור Vercel Blob · דיפלוי לפרודקשן ·
הוספת הדומיין ל-Authorized domains · חיבור הריפו ל-GitHub לדיפלוי אוטומטי.

---

## שלב 5 — בדיקת flow (חלון אינקוגניטו!)
המערכת **לקוח-יחיד**: המשתמש הרגיל הראשון שנרשם = הבעלים; הרשמות נוספות חסומות.
- [ ] בחלון אינקוגניטו: היכנס לכתובת הפרודקשן.
- [ ] הירשם עם משתמש בדיקה רגיל → הופך לבעלים (owner).
- [ ] התנתק → התחבר עם **הסופר-אדמין** → מסך **"ניהול חשבונות"** → **"כניסה"** לבעלים (impersonation).

> ⚠️ אחרי כל דיפלוי/שינוי משתמשים — נקה site data או השתמש באינקוגניטו, אחרת "לא מתחבר" (סשן ישן).

---

## שלב 6 — סיום
- [ ] ודא שהאתר עולה ושההתחברות עובדת.
- [ ] מסור ללקוח את כתובת הפרודקשן.
- [ ] (אופציונלי) דומיין מותאם אישית: הוסף ב-Vercel, ואז הוסף את הדומיין ל-Firebase Authorized domains.

---

## כלים ותקלות נפוצות
- **איפוס לבדיקה חוזרת:** `npm run reset` — מוחק כל המשתמשים/נתונים, משמר את הסופר-אדמין.
- **דיפלוי שינויי קוד:** עשה `git push` לריפו הלקוח (Vercel מדפלוי אוטומטית). ⚠️ ריפו לקוח קיים הוא snapshot — **לא** מתעדכן מהתבנית אוטומטית; שינויי תבנית צריך לפורט ידנית.
- **מגבלת Vercel Hobby = 12 serverless functions.** תיקיית `api/` כבר על הגבול — אל תוסיף קובץ `api/*.ts` חדש; מזג לוגיקה לתוך handler קיים (branch על שדה ב-body).
- **`VITE_*` נצרבים ב-build וגלויים בדפדפן** — אל תכניס בהם סודות אמיתיים.
- **OAuth (יומן/Gmail), Resend, `OWNER_UID`** — אופציונלי, ראה `DEPLOYMENT.md`.

> מדריך מלא יותר: `TEMPLATE_SETUP.md`.
