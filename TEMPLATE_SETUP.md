# הקמת לקוח חדש מהתבנית — אוטומטי

מדריך זה מסביר איך להקים עותק חדש של המערכת ללקוח, ברובו **אוטומטי** דרך הסקריפט
`scripts/setup-deployment.mjs` (פקודה: `npm run setup`).

> רוב התהליך מבוצע אוטומטית. נשארות 3 פעולות ידניות שדורשות גישה לקונסולות (יצירת
> פרויקט Firebase, רישום Web App, והתחברות ל-CLIs) — הן מסומנות ב-**[ידני]**.

---

## שלב 1 — **[ידני]** יצירת הריפו מהתבנית
1. ב-GitHub: בריפו התבנית → **Use this template → Create a new repository**.
2. `git clone` של הריפו החדש למחשב, ו-`cd` לתוכו.
3. `npm install`.

## שלב 2 — **[ידני]** יצירת פרויקט Firebase + Web App
1. [Firebase Console](https://console.firebase.google.com) → **Add project** (ללא Analytics).
2. **Build → Firestore Database** — אפשר לדלג, הסקריפט יוצר את ה-DB. (אם תיצור ידנית: מצב Production.)
3. **Project settings → General → Your apps → Web (`</>`)** → רשום אפליקציית web והעתק את
   ערכי ה-config (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
4. (מומלץ) **Authentication → Get started** → ודא ש-**Email/Password** מופעל. הסקריפט מנסה
   להפעיל אוטומטית, אבל אם הוא נכשל — זה ה-fallback הידני.

## שלב 3 — **[ידני]** התחברות ל-CLIs (לחשבונות של הלקוח)
לכל לקוח יש חשבון Firebase/Vercel משלו, אז יש להתחבר מחדש:
```bash
npx vercel login                 # חשבון ה-Vercel של הלקוח
gcloud auth login                # חשבון Google שהוא owner של פרויקט ה-Firebase
npx firebase-tools login         # אותו חשבון Google
gcloud config set project <PROJECT_ID>
```

## שלב 4 — מילוי הקונפיג והרצת הסקריפט
1. העתק את `setup.config.example.json` ל-`setup.config.json` (האחרון ב-`.gitignore`).
2. מלא את הערכים: `vercelProjectName`, `githubRepo`, `superAdminEmail`, ואת בלוק `firebase`
   מהשלב הקודם.
3. הרץ:
   ```bash
   npm run setup
   ```

הסקריפט מבצע אוטומטית:
- יצירת/קישור פרויקט Vercel
- יצירת `APP_ENCRYPTION_KEY` + `WEBHOOK_SECRET`
- הגדרת **כל** משתני הסביבה (config של Firebase, סודות, `VITE_SUPER_ADMIN_EMAIL`) בכל הסביבות
- יצירת מסד Firestore (אם חסר) + פריסת `firestore.rules`
- יצירת מפתח Service Account (דרך gcloud) והגדרת `FIREBASE_SERVICE_ACCOUNT`
- הפעלת ספק Email/Password (best effort)
- יצירת וחיבור **Vercel Blob** store ציבורי (להעלאות)
- **דיפלוי לפרודקשן**
- הוספת דומיין הפרודקשן ל-**Authorized domains** של Firebase
- חיבור הריפו ב-GitHub לדיפלוי אוטומטי

בסיום תקבל את כתובת הפרודקשן.

---

## שלב 5 — בדיקה (flow)
המערכת היא **לקוח-יחיד**:
- **המשתמש הרגיל הראשון שנרשם = הבעלים (owner)**; נרשם ב-`config/owner`.
- כל הרשמה רגילה נוספת נחסמת ("מערכת פרטית"), אלא אם יש קישור הזמנה או שזה הסופר-אדמין.
- **הסופר-אדמין** (`superAdminEmail`) עוקף את החסימה → מגיע למסך **"ניהול חשבונות"** → לוחץ
  **"כניסה"** ונכנס כבעלים (impersonation, עם פס תמיכה).

לבדיקה בחלון נקי (אינקוגניטו, או אחרי Clear site data):
1. הירשם עם משתמש בדיקה רגיל → הופך לבעלים.
2. התנתק → התחבר כסופר-אדמין → מסך הניהול → "כניסה" לבעלים.

> **חשוב:** אחרי שינוי משתמשים/דיפלוי, נקה site data בדפדפן או השתמש באינקוגניטו —
> סשן/מטמון ישנים גורמים ל"לא מתחבר".

## איפוס לבדיקות חוזרות
```bash
npm run reset        # מוחק את כל המשתמשים והנתונים, משמר את הסופר-אדמין
```

---

## הערות
- **`superAdminEmail` חייב להיות זהה לאימייל המוקשח ב-`firestore.rules`** (כרגע
  `devsite350@gmail.com`). אם משנים אותו — לעדכן בשני המקומות.
- משתני `VITE_*` נצרבים ב-build וגלויים בדפדפן — אין להכניס בהם סודות אמיתיים.
- פרטים על OAuth (יומן/Gmail), Resend, ו-`OWNER_UID` — ראה `DEPLOYMENT.md`.
