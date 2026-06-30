import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { UserAvatar } from './UserAvatar';
import { useConfirm } from './ConfirmDialog';

interface TeamMemberLocal {
    id: string;
    email: string;
    joinedAt: number;
    displayName?: string;
    photoUrl?: string;
}

export const TeamSettings: React.FC = () => {
    const { userId, isOwner, organizationId } = useAppContext();
    const confirm = useConfirm();
    const [members, setMembers] = useState<TeamMemberLocal[]>([]);
    const [loading, setLoading] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [loadingToken, setLoadingToken] = useState(false);

    useEffect(() => {
        if (!isOwner) return;

        setLoading(true);
        const membersRef = collection(db, 'users', userId, 'team_members');
        const unsubscribe = onSnapshot(membersRef, async (snapshot) => {
            const loadedMembers: TeamMemberLocal[] = [];
            for (const d of snapshot.docs) {
                const data = d.data();
                let displayName = data.displayName || data.email?.split('@')[0] || '';
                let photoUrl = data.photoUrl || '';
                try {
                    const memberProfile = await getDoc(doc(db, 'users', d.id));
                    if (memberProfile.exists()) {
                        const profile = memberProfile.data();
                        displayName = profile.displayName || displayName;
                        photoUrl = profile.photoUrl || photoUrl;
                    }
                } catch { /* ignore */ }
                loadedMembers.push({ id: d.id, email: data.email, joinedAt: data.joinedAt, displayName, photoUrl });
            }
            setMembers(loadedMembers);
            setLoading(false);
        });

        // Fetch Invite Token
        const fetchToken = async () => {
            setLoadingToken(true);
            try {
                const userDoc = await import('firebase/firestore').then(mod => mod.getDoc(mod.doc(db, 'users', userId)));
                if (userDoc.exists()) {
                    setInviteToken(userDoc.data().inviteToken || null);
                }
            } catch (err) {
                console.error("Error fetching token", err);
            }
            setLoadingToken(false);
        };
        fetchToken();

        return () => unsubscribe();
    }, [userId, isOwner]);

    const generateNewToken = async () => {
        if (!await confirm({ title: 'יצירת קישור חדש', message: 'האם אתה בטוח? יצירת קישור חדש תבטל את הקישור הישן ואנשים לא יוכלו להצטרף איתו.', confirmText: 'צור קישור חדש' })) return;
        setLoadingToken(true);
        const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        try {
            await setDoc(doc(db, 'users', userId), { inviteToken: newToken }, { merge: true });
            setInviteToken(newToken);
        } catch (err) {
            console.error("Error updating token", err);
            alert("שגיאה ביצירת קישור חדש");
        }
        setLoadingToken(false);
    };

    const removeMember = async (memberId: string) => {
        if (!await confirm({ title: 'הסרת משתמש', message: 'האם אתה בטוח שברצונך להסיר משתמש זה מהצוות?', confirmText: 'הסר' })) return;
        try {
            // 1. Remove from owner's team_members
            await deleteDoc(doc(db, 'users', userId, 'team_members', memberId));

            // 2. Ideally, we should also update the member's profile to remove organizationId.
            // However, we can't write to other users' profiles with current rules (only own profile).
            // So the member will lose access (rule check fails), but their profile might still say they are in org.
            // They will effectively be locked out or fall back to their own empty data? 
            // Actually, AppContext reads organizationId. If they can't read the owner's data, AppContext might error.
            // We should probably rely on the member "leaving" or better, use a Cloud Function for this.
            // For MVP: We just remove access. The member will get "Permission Denied" and should "Leave Team" manually or we handle the error.
            // BETTER: The AppContext check for `organizationId` is on `users/{currentUserId}`. 
            // If we can't write to that, we have a consistency issue.
            // BUT current rules: `match /users/{userId}/{allPaths=**} { allow write: if request.auth.uid == userId }`.
            // So the Owner CANNOT update the Member's profile.

            // Implication: Owner removes Member from list. Member tries to load Owner's data. 
            // Firestore Rules fail (check `exists(.../team_members/uid)`).
            // Member gets "Permission Denied" error in AppContext.
            // We should handle that error in AppContext to allow "Reset/Leave Team".

        } catch (error) {
            console.error("Error removing member:", error);
            alert("שגיאה בהסרת משתמש");
        }
    };

    const leaveTeam = async () => {
        if (!await confirm({ title: 'עזיבת צוות', message: 'האם אתה בטוח שברצונך לעזוב את הצוות?', confirmText: 'עזוב' })) return;
        try {
            await updateDoc(doc(db, 'users', userId), {
                organizationId: null
            });
            window.location.reload();
        } catch (error) {
            console.error("Error leaving team:", error);
            alert("שגיאה בעזיבת הצוות");
        }
    };

    const inviteLink = inviteToken ? `${window.location.origin}?register=true&join=${userId}&token=${inviteToken}` : '';

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopySuccess('הקישור הועתק!');
            setTimeout(() => setCopySuccess(''), 2000);
        } catch (err) {
            setCopySuccess('שגיאה בהעתקה');
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8" dir="rtl">
            <div>
                <h2 className="text-2xl font-bold mb-2">ניהול צוות</h2>
                <p className="text-gray-500">
                    {isOwner
                        ? "אתה מנהל הצוות. הזמן משתמשים נוספים לעבוד על המידע שלך."
                        : "אתה חבר בצוות."
                    }
                </p>
            </div>

            {isOwner ? (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-base-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-white/5">
                        <h3 className="text-lg font-semibold mb-4">הזמנת משתמשים</h3>

                        {!inviteToken ? (
                            <div className="text-center py-6">
                                <p className="mb-4 text-gray-500">טרם נוצר קישור הזמנה לצוות שלך.</p>
                                <button
                                    onClick={() => generateNewToken().then(() => { })} // Quick fix to bypass confirm for first time if needed, but here we reuse the function
                                    className="bg-primary text-white px-4 py-2 rounded-lg"
                                >
                                    צור קישור הזמנה
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col sm:flex-row gap-4 items-center">
                                    <input
                                        type="text"
                                        readOnly
                                        value={inviteLink}
                                        className="flex-1 w-full bg-gray-50 dark:bg-base-900 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 select-all"
                                    />
                                    <button
                                        onClick={copyLink}
                                        className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
                                    >
                                        העתק קישור
                                    </button>
                                </div>
                                <div className="flex justify-between items-start mt-2">
                                    <p className="text-xs text-gray-400">שלח קישור זה לאנשים שברצונך לצרף לצוות.</p>
                                    {copySuccess && <p className="text-green-500 text-sm font-medium">{copySuccess}</p>}
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5">
                                    <button
                                        onClick={generateNewToken}
                                        className="text-red-500 text-xs hover:underline"
                                    >
                                        אפס קישור הזמנה (יבטל את הקישור הנוכחי)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="bg-white dark:bg-base-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-white/5">
                        <h3 className="text-lg font-semibold mb-4">חברי צוות ({members.length})</h3>

                        {loading ? (
                            <div className="text-center py-4 text-gray-400">טוען...</div>
                        ) : members.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 dark:bg-base-900/50 rounded-lg border border-dashed border-gray-200 dark:border-white/10 text-gray-400">
                                אין עדיין חברי צוות נוספים.
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-white/5">
                                {members.map(member => (
                                    <div key={member.id} className="py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <UserAvatar
                                                name={member.displayName || member.email || ''}
                                                photoUrl={member.photoUrl}
                                                size="md"
                                            />
                                            <div>
                                                <p className="font-medium">{member.displayName || member.email || "משתמש ללא שם"}</p>
                                                {member.displayName && member.email && (
                                                    <p className="text-xs text-gray-400">{member.email}</p>
                                                )}
                                                <p className="text-[10px] text-gray-400">הצטרף: {new Date(member.joinedAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeMember(member.id)}
                                            className="text-red-500 hover:text-red-600 text-sm px-3 py-1 bg-red-50 dark:bg-red-900/10 rounded hover:bg-red-100 transition-colors"
                                        >
                                            הסר גישה
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-base-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">פרטי התחברות לצוות</h3>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">אתה מחובר כרגע לארגון עם מזהה: <span className="font-mono bg-gray-100 dark:bg-black/20 px-1 rounded">{organizationId}</span></p>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                        <button
                            onClick={leaveTeam}
                            className="text-red-500 hover:text-white border border-red-200 hover:bg-red-500 px-4 py-2 rounded-lg transition-all text-sm font-medium"
                        >
                            עזוב את הצוות וחזור לחשבון האישי שלך
                        </button>
                        <p className="text-xs text-gray-400 mt-2">פעולה זו תנתק אותך מהמידע המשותף ותחזיר אותך למידע הפרטי שלך.</p>
                    </div>
                </div>
            )}
        </div>
    );
};
