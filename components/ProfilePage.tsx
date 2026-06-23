import React, { useState, useRef, useEffect } from 'react';
import { updateProfile, updatePassword, reauthenticateWithPopup, reauthenticateWithCredential, GoogleAuthProvider, EmailAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { uploadFile } from '../utils/apiClient';
import { UserAvatar } from './UserAvatar';
import { Check, AlertCircle, Image, Camera, User, Lock, Download, Smartphone, CheckCircle } from 'lucide-react';

// PWA install prompt event type
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface ProfilePageProps {
    onProfileUpdate?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onProfileUpdate }) => {
    const user = auth.currentUser;
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [photoUrl, setPhotoUrl] = useState<string>(user?.photoURL || '');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [requiresReauth, setRequiresReauth] = useState(false);
    const [reauthPassword, setReauthPassword] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // PWA install state
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [installDone, setInstallDone] = useState(false);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

    useEffect(() => {
        // Already running as installed PWA?
        if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
            setIsInstalled(true);
            return;
        }
        // Use prompt captured early in index.tsx (before React mounted)
        if ((window as any).__pwaInstallPrompt) {
            setInstallPrompt((window as any).__pwaInstallPrompt);
        }
        // Also listen for future prompt (e.g. if page is refreshed)
        const handler = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
        };
        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', () => setIsInstalled(true));
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) return;
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setInstallDone(true);
            setInstallPrompt(null);
        }
    };

    // Load custom photo from Firestore profile (may be different from auth photoURL)
    useEffect(() => {
        if (!user) return;
        const loadProfile = async () => {
            try {
                const profileDoc = await getDoc(doc(db, 'users', user.uid));
                if (profileDoc.exists()) {
                    const data = profileDoc.data();
                    if (data.photoUrl) {
                        setPhotoUrl(data.photoUrl);
                    } else if (user.photoURL) {
                        // Google sign-in photo
                        setPhotoUrl(user.photoURL);
                        // Persist Google photo to Firestore
                        await setDoc(doc(db, 'users', user.uid), {
                            photoUrl: user.photoURL,
                            displayName: user.displayName || '',
                            email: user.email || '',
                        }, { merge: true });
                    }
                    if (data.displayName) {
                        setDisplayName(data.displayName);
                    }
                } else if (user.photoURL) {
                    setPhotoUrl(user.photoURL);
                    await setDoc(doc(db, 'users', user.uid), {
                        photoUrl: user.photoURL,
                        displayName: user.displayName || '',
                        email: user.email || '',
                    }, { merge: true });
                }
            } catch (e) {
                console.error('Error loading profile:', e);
            }
        };
        loadProfile();
    }, [user]);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'ניתן להעלות קובצי תמונה בלבד' });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'גודל הקובץ חייב להיות עד 5MB' });
            return;
        }

        setIsUploadingPhoto(true);
        setMessage(null);

        try {
            const downloadUrl = await uploadFile(file, `profile_photos/${user.uid}`);

            // Update Firebase Auth profile
            await updateProfile(user, { photoURL: downloadUrl });

            // Save to Firestore for team member access
            await setDoc(doc(db, 'users', user.uid), {
                photoUrl: downloadUrl,
            }, { merge: true });

            setPhotoUrl(downloadUrl);
            setMessage({ type: 'success', text: 'תמונת הפרופיל עודכנה בהצלחה' });
            if (onProfileUpdate) onProfileUpdate();
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            setMessage({ type: 'error', text: 'שגיאה בהעלאת תמונה: ' + error.message });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleRemovePhoto = async () => {
        if (!user) return;
        setIsUploadingPhoto(true);
        try {
            await updateProfile(user, { photoURL: '' });
            await setDoc(doc(db, 'users', user.uid), {
                photoUrl: '',
            }, { merge: true });
            setPhotoUrl('');
            setMessage({ type: 'success', text: 'תמונת הפרופיל הוסרה' });
            if (onProfileUpdate) onProfileUpdate();
        } catch (error: any) {
            setMessage({ type: 'error', text: 'שגיאה בהסרת תמונה: ' + error.message });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsLoading(true);
        setMessage(null);

        try {
            await updateProfile(user, { displayName });
            // Also save to Firestore
            await setDoc(doc(db, 'users', user.uid), {
                displayName,
                email: user.email || '',
            }, { merge: true });
            setMessage({ type: 'success', text: 'הפרופיל עודכן בהצלחה' });
            if (onProfileUpdate) onProfileUpdate();
        } catch (error: any) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'שגיאה בעדכון הפרופיל: ' + error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'הסיסמאות אינן תואמות' });
            return;
        }
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'הסיסמא חייבת להכיל לפחות 6 תווים' });
            return;
        }

        setIsLoading(true);
        setMessage(null);

        try {
            await updatePassword(user, newPassword);
            setMessage({ type: 'success', text: 'הסיסמא עודכנה בהצלחה' });
            setNewPassword('');
            setConfirmPassword('');
            setRequiresReauth(false);
        } catch (error: any) {
            console.error('Error updating password:', error);
            if (error.code === 'auth/requires-recent-login') {
                setRequiresReauth(true);
                setMessage({ type: 'error', text: 'לצורך אבטחה מוגברת, יש לאמת את זהותך מחדש כדי לשנות את הסיסמא.' });
            } else {
                setMessage({ type: 'error', text: 'שגיאה בעדכון הסיסמא: ' + error.message });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleReauthenticateGoogle = async () => {
        if (!user) return;
        setIsLoading(true);
        setMessage(null);
        try {
            const provider = new GoogleAuthProvider();
            await reauthenticateWithPopup(user, provider);
            setRequiresReauth(false);
            setMessage({ type: 'success', text: 'האימות עבר בהצלחה. כעת ניתן ללחוץ על "עדכן סיסמא".' });
        } catch (error: any) {
            console.error('Error reauthenticating with Google:', error);
            setMessage({ type: 'error', text: 'שגיאה באימות מחדש: ' + (error.message || 'נסה שוב') });
        } finally {
            setIsLoading(false);
        }
    };

    const handleReauthenticatePassword = async () => {
        if (!user || (!user.email && !user.phoneNumber)) return;
        setIsLoading(true);
        setMessage(null);
        try {
            const credential = EmailAuthProvider.credential(user.email!, reauthPassword);
            await reauthenticateWithCredential(user, credential);
            setRequiresReauth(false);
            setReauthPassword('');
            setMessage({ type: 'success', text: 'האימות עבר בהצלחה. כעת ניתן ללחוץ על "עדכן סיסמא".' });
        } catch (error: any) {
            console.error('Error reauthenticating with password:', error);
            setMessage({ type: 'error', text: 'שגיאה באימות: סיסמא שגויה.' });
        } finally {
            setIsLoading(false);
        }
    };

    const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com');
    const hasPasswordProvider = user?.providerData?.some(p => p.providerId === 'password');

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 animate-fade-in-up">
            <header className="mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    איזור אישי
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    ניהול פרטים אישיים והגדרות אבטחה
                </p>
            </header>

            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/30'
                    : 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:border-red-900/30'
                    }`}>
                    {message.type === 'success' ? (
                        <Check className="w-5 h-5 flex-shrink-0" />
                    ) : (
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Profile Photo Section */}
            <section className="bg-white dark:bg-base-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                        <Image className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">תמונת פרופיל</h2>
                </div>

                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <UserAvatar
                            name={displayName || user?.email?.split('@')[0] || ''}
                            photoUrl={photoUrl}
                            size="lg"
                            showTooltip={false}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingPhoto}
                            className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                        >
                            <Camera className="w-6 h-6 text-white" />
                        </button>
                        {isUploadingPhoto && (
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handlePhotoUpload}
                            accept="image/*"
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingPhoto}
                            className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-medium text-sm transition-all disabled:opacity-50"
                        >
                            {isUploadingPhoto ? 'מעלה...' : 'העלה תמונה'}
                        </button>
                        {photoUrl && (
                            <button
                                type="button"
                                onClick={handleRemovePhoto}
                                disabled={isUploadingPhoto}
                                className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 font-medium text-sm transition-all disabled:opacity-50"
                            >
                                הסר תמונה
                            </button>
                        )}
                        {isGoogleUser && !photoUrl && (
                            <p className="text-xs text-gray-400">התמונה נלקחה אוטומטית מחשבון Google</p>
                        )}
                        <p className="text-xs text-gray-400">JPG, PNG. מקסימום 5MB</p>
                    </div>
                </div>
            </section>

            <div className="grid gap-8 md:grid-cols-2">
                {/* Profile Details Section */}
                <section className="bg-white dark:bg-base-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                            <User className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">פרטים אישיים</h2>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                אימייל (לקריאה בלבד)
                            </label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-base-900/50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                שם מלא
                            </label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-base-900 focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white"
                                placeholder="הזן שם מלא"
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-primary hover:bg-primary-focus text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'שומר...' : 'שמור שינויים'}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Security Section */}
                <section className="bg-white dark:bg-base-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg text-teal-600 dark:text-teal-400">
                            <Lock className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">אבטחה</h2>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                סיסמא חדשה
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-base-900 focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white"
                                placeholder="לפחות 6 תווים"
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                אימות סיסמא חדשה
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-base-900 focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white"
                                placeholder="הזן שוב את הסיסמא החדשה"
                                minLength={6}
                            />
                        </div>

                        {requiresReauth ? (
                            <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-base-900/50 space-y-4">
                                <div>
                                    <h3 className="font-medium text-gray-800 dark:text-gray-200">אימות מחדש נדרש</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">אנא אמת את חשבונך כדי להמשיך בשינוי הסיסמא.</p>
                                </div>

                                {isGoogleUser && (
                                    <button
                                        type="button"
                                        onClick={handleReauthenticateGoogle}
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center gap-2 bg-white dark:bg-base-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-white/20 hover:bg-gray-50 dark:hover:bg-base-700 font-medium py-2.5 px-4 rounded-xl transition-all disabled:opacity-50"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        אימות באמצעות Google
                                    </button>
                                )}

                                {hasPasswordProvider && (
                                    <div className="space-y-3 pt-2">
                                        {isGoogleUser && <div className="text-xs text-center text-gray-500 my-2">- או -</div>}
                                        <input
                                            type="password"
                                            value={reauthPassword}
                                            onChange={(e) => setReauthPassword(e.target.value)}
                                            placeholder="הזן את סיסמתך הנוכחית"
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-base-900 focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleReauthenticatePassword}
                                            disabled={isLoading || !reauthPassword}
                                            className="w-full bg-gray-900 dark:bg-white dark:text-black text-white hover:bg-gray-800 dark:hover:bg-gray-200 font-medium py-2.5 px-4 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            אמת סיסמא
                                        </button>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setRequiresReauth(false)}
                                    className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mt-2"
                                >
                                    ביטול
                                </button>
                            </div>
                        ) : (
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isLoading || !newPassword || !confirmPassword}
                                    className="w-full bg-gray-900 dark:bg-white dark:text-black text-white hover:bg-gray-800 dark:hover:bg-gray-200 font-medium py-2.5 px-4 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'מעדכן...' : 'עדכן סיסמא'}
                                </button>
                            </div>
                        )}
                    </form>
                </section>
            </div>

            {/* PWA Install Section — mobile only, Android needs active prompt, iOS always shows instructions */}
            {isMobile && !isInstalled && !installDone && (installPrompt || isIOS) && (
                <section className="bg-white dark:bg-base-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-sky-50 dark:bg-sky-900/20 rounded-lg text-sky-600 dark:text-sky-400">
                            <Download className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">התקנת אפליקציה</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">גישה מהירה מהמסך הראשי</p>
                        </div>
                    </div>

                    {installPrompt ? (
                        <button
                            onClick={handleInstall}
                            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-focus text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95"
                        >
                            <Smartphone className="w-5 h-5" />
                            התקן אפליקציה על המכשיר
                        </button>
                    ) : (
                        <div className="bg-gray-50 dark:bg-base-900/50 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-300 space-y-2">
                            <p className="font-medium">להתקנה ב-iOS Safari:</p>
                            <ol className="list-decimal list-inside space-y-1 text-gray-500 dark:text-gray-400">
                                <li>לחץ על כפתור השיתוף <span className="font-bold">⬆</span> בתחתית הדפדפן</li>
                                <li>בחר <span className="font-bold">"הוסף למסך הבית"</span></li>
                            </ol>
                        </div>
                    )}
                </section>
            )}

            {installDone && (
                <section className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="w-6 h-6 flex-shrink-0" />
                        <div>
                            <p className="font-bold">האפליקציה הותקנה בהצלחה!</p>
                            <p className="text-sm opacity-80">תמצא אותה על המסך הראשי שלך</p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};
