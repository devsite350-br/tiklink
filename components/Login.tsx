
import React, { useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, AuthError, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Template super admin: hardcoded fallback so devsite350 stays super admin in
// every deployment even if VITE_SUPER_ADMIN_EMAIL is missing. Must match firestore.rules.
const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'devsite350@gmail.com').toLowerCase().trim();

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);

    React.useEffect(() => {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        if (path === '/signup' || params.get('register') === 'true') {
            setIsSignUp(true);
        }
    }, []);

    const handleAuth = async (authFunc: (auth: any, email: string, pass: string) => Promise<any>) => {
        setIsLoading(true);
        setError('');

        if (isSignUp) {
            const emailLower = email.toLowerCase().trim();
            const isSuperAdmin = SUPER_ADMIN_EMAIL && emailLower === SUPER_ADMIN_EMAIL;
            const urlParams = new URLSearchParams(window.location.search);
            const hasInvite = !!(urlParams.get('join') && urlParams.get('token'));
            if (!isSuperAdmin && !hasInvite) {
                try {
                    const ownerConfig = await getDoc(doc(db, 'config', 'owner'));
                    if (ownerConfig.exists()) {
                        setError('מערכת פרטית — ההרשמה סגורה. פנה לבעל המערכת להזמנה.');
                        setIsLoading(false);
                        return;
                    }
                } catch {
                    // Can't read config — assume no owner yet, allow registration
                }
            }
        }

        try {
            const result = await authFunc(auth, email, password);
            if (isSignUp && result.user) {
                const emailLower = (result.user.email || '').toLowerCase();
                const isSuperAdmin = SUPER_ADMIN_EMAIL && emailLower === SUPER_ADMIN_EMAIL;
                const urlParams2 = new URLSearchParams(window.location.search);
                const hasInvite2 = !!(urlParams2.get('join') && urlParams2.get('token'));

                if (!isSuperAdmin) {
                    if (fullName.trim()) {
                        await updateProfile(result.user, { displayName: fullName.trim() });
                    }
                    await setDoc(doc(db, 'users', result.user.uid), {
                        email: result.user.email || '',
                        displayName: fullName.trim() || '',
                    }, { merge: true });
                    // Only the first (non-invited) user becomes the owner
                    if (!hasInvite2) {
                        await setDoc(doc(db, 'config', 'owner'), { uid: result.user.uid });
                    }
                }
            }
        } catch (err) {
            const authError = err as AuthError;
            handleAuthError(authError);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError('');
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            if (user) {
                const emailLower = (user.email || '').toLowerCase();
                const isSuperAdmin = SUPER_ADMIN_EMAIL && emailLower === SUPER_ADMIN_EMAIL;
                const existingDoc = await getDoc(doc(db, 'users', user.uid));
                const isNewUser = !existingDoc.exists();

                if (!isSuperAdmin) {
                    if (isNewUser) {
                        const ownerConfig = await getDoc(doc(db, 'config', 'owner'));
                        if (ownerConfig.exists()) {
                            await user.delete();
                            setError('מערכת פרטית — ההרשמה סגורה. פנה לבעל המערכת להזמנה.');
                            return;
                        }
                    }
                    await setDoc(doc(db, 'users', user.uid), {
                        displayName: user.displayName || '',
                        email: user.email || '',
                        photoUrl: user.photoURL || '',
                    }, { merge: true });
                    if (isNewUser) {
                        await setDoc(doc(db, 'config', 'owner'), { uid: user.uid });
                    }
                }
            }
        } catch (err) {
            const authError = err as AuthError;
            handleAuthError(authError);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAuthError = (authError: AuthError) => {
        switch (authError.code) {
            case 'auth/invalid-email':
                setError('כתובת אימייל אינה תקינה.');
                break;
            case 'auth/user-not-found':
                setError('משתמש לא נמצא. נסה להירשם.');
                break;
            case 'auth/wrong-password':
                setError('סיסמה שגויה.');
                break;
            case 'auth/email-already-in-use':
                setError('האימייל כבר בשימוש. נסה להתחבר.');
                break;
            case 'auth/weak-password':
                setError('הסיסמה צריכה להכיל לפחות 6 תווים.');
                break;
            case 'auth/popup-closed-by-user':
                setError('התחברות בוטלה על ידי המשתמש.');
                break;
            default:
                setError('אירעה שגיאה. נסה שוב.');
                console.error("Authentication error:", authError);
                break;
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSignUp) {
            handleAuth(createUserWithEmailAndPassword);
        } else {
            handleAuth(signInWithEmailAndPassword);
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-base-200 to-white dark:from-base-950 dark:to-black px-4 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="relative p-8 px-10 bg-white/70 dark:bg-base-900/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-white/5 w-full max-w-sm flex flex-col items-center">
                <img src="/favicon.png" alt="Simpofy Logo" className="mb-6 w-14 h-14 rounded-2xl shadow-lg shadow-primary/30" />
                <h1 className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">ברוכים הבאים</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 text-center">
                    {isSignUp ? 'צור חשבון חדש כדי להתחיל' : 'התחבר לחשבון שלך'}
                </p>
                <form onSubmit={handleSubmit} className="space-y-4 w-full">
                    {isSignUp && (
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="שם מלא"
                            disabled={isLoading}
                            className="w-full px-4 py-3 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-base-950/50 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm placeholder-gray-400"
                            aria-label="Full Name"
                        />
                    )}
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="אימייל"
                        required
                        disabled={isLoading}
                        className="w-full px-4 py-3 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-base-950/50 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm placeholder-gray-400"
                        aria-label="Email"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="סיסמה"
                        required
                        minLength={6}
                        disabled={isLoading}
                        className="w-full px-4 py-3 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-base-950/50 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm placeholder-gray-400"
                        aria-label="Password"
                    />
                    {isSignUp && (
                        <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-300 mt-1">
                            <input
                                type="checkbox"
                                checked={agreeTerms}
                                onChange={(e) => setAgreeTerms(e.target.checked)}
                                disabled={isLoading}
                                className="checkbox checkbox-primary checkbox-sm mt-0.5 shrink-0"
                                required
                            />
                            <span>
                                אני מסכים/ה ל<a href="https://simpofy.com/terms-and-privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-accent underline transition-colors">תנאי שימוש ומדיניות פרטיות</a>
                            </span>
                        </label>
                    )}
                    <button
                        type="submit"
                        disabled={isLoading || !email || !password || (isSignUp && !agreeTerms)}
                        className="w-full bg-gradient-to-r from-primary to-accent text-white p-3 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isLoading ? (isSignUp ? 'יוצר חשבון...' : 'מתחבר...') : (isSignUp ? 'הרשמה' : 'כניסה')}
                    </button>
                </form>
                {error && <p className="text-red-500 text-sm mt-4 text-center bg-red-50 dark:bg-red-900/20 p-2 rounded-lg w-full">{error}</p>}

                <div className="relative my-8 w-full">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200 dark:border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-wide">
                        <span className="px-3 bg-white dark:bg-base-900 text-gray-400 font-medium">או המשך עם</span>
                    </div>
                </div>

                <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 p-3 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all disabled:opacity-50"
                >
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                        <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
                        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.222 0-9.657-3.356-11.303-7.918l-6.573 4.818C9.656 39.663 16.318 44 24 44z" />
                        <path fill="#1976D2" d="M43.611 20.083H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.032 44 24c0-1.341-.138-2.65-.389-3.917z" />
                    </svg>
                    Google
                </button>
                <div className="text-center mt-8">
                    <button
                        onClick={() => {
                            const next = !isSignUp;
                            setIsSignUp(next);
                            window.history.replaceState({}, '', next ? '/signup' : '/');
                        }}
                        className="text-sm font-medium text-primary hover:text-accent transition-colors underline decoration-transparent hover:decoration-current"
                    >
                        {isSignUp ? 'יש לך כבר חשבון? התחבר' : 'אין לך חשבון? הירשם כאן'}
                    </button>
                </div>
            </div>
        </div>
    );
};