
import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, getDocs, getDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Client, Task, Subtask, CrmDocument, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, MAX_FILES_PER_SUBTASK } from '../types';
import { uploadPublicFile, togglePublicSubtask } from '../utils/apiClient';
import { DefaultLogo } from './DefaultLogo';
import LinkifiedContent from './LinkifiedContent';
import { Sun, Moon, CheckCircle2, Paperclip, Download } from 'lucide-react';

interface PublicChecklistPageProps {
    userId: string;
    token: string;
}

export const PublicChecklistPage: React.FC<PublicChecklistPageProps> = ({ userId, token }) => {
    const [task, setTask] = useState<Task | null>(null);
    const [clientId, setClientId] = useState<string>('');
    const [allClientTasks, setAllClientTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [clientFiles, setClientFiles] = useState<CrmDocument[]>([]);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [uploadingSubtaskId, setUploadingSubtaskId] = useState<string | null>(null);
    const subtaskFileInputRef = useRef<HTMLInputElement>(null);
    const pendingSubtaskRef = useRef<Subtask | null>(null);

    // Initialize theme — follow system-wide preference (same key/logic as the app)
    useEffect(() => {
        const storedTheme = localStorage.getItem('theme');
        const shouldBeDark = storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (shouldBeDark) {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        } else {
            document.documentElement.classList.remove('dark');
            setIsDark(false);
        }
    }, []);

    const toggleTheme = () => {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setIsDark(false);
        } else {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDark(true);
        }
    };

    // Load the configurable system logo from the public branding config so the
    // shared link carries the same logo shown inside the app. Falls back to the
    // bundled default when none is set.
    useEffect(() => {
        getDoc(doc(db, 'config', 'owner'))
            .then(snap => {
                const url = snap.exists() ? (snap.data().logoUrl as string | undefined) : undefined;
                if (url) setLogoUrl(url);
            })
            .catch(() => { /* keep default logo on error */ });
    }, []);

    // Subscribe to auth state
    useEffect(() => {
        return onAuthStateChanged(auth, (u) => {
            setAuthUser(u);
            setAuthReady(true);
        });
    }, []);

    // Override global overflow:hidden so the public page can scroll
    useEffect(() => {
        const root = window.document.getElementById('root');
        const html = window.document.documentElement;
        const body = window.document.body;
        html.style.overflow = 'auto';
        html.style.height = 'auto';
        body.style.overflow = 'auto';
        body.style.height = 'auto';
        if (root) { root.style.overflow = 'auto'; root.style.height = 'auto'; }
        return () => {
            html.style.overflow = '';
            html.style.height = '';
            body.style.overflow = '';
            body.style.height = '';
            if (root) { root.style.overflow = ''; root.style.height = ''; }
        };
    }, []);

    // Initial discovery (which client owns this token) + real-time subscription
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        let cancelled = false;

        const init = async () => {
            try {
                const clientsCol = collection(db, 'users', userId, 'clients');
                const querySnapshot = await getDocs(clientsCol);
                if (cancelled) return;

                let foundClientId = '';
                for (const docSnap of querySnapshot.docs) {
                    const clientData = { id: docSnap.id, ...docSnap.data() } as Client;
                    if ((clientData.tasks || []).some((t: Task) => t.shareToken === token)) {
                        foundClientId = clientData.id;
                        break;
                    }
                }

                if (!foundClientId) {
                    setError('הצ\'קליסט לא נמצא או שהקישור אינו תקין');
                    setLoading(false);
                    return;
                }

                setClientId(foundClientId);

                // Subscribe to real-time updates on this specific client doc
                const clientRef = doc(db, 'users', userId, 'clients', foundClientId);
                unsubscribe = onSnapshot(
                    clientRef,
                    (snap) => {
                        if (cancelled) return;
                        if (!snap.exists()) {
                            setError('הצ\'קליסט הוסר');
                            setLoading(false);
                            return;
                        }
                        const clientData = { id: snap.id, ...snap.data() } as Client;
                        const tasksArr = clientData.tasks || [];
                        const matchingTask = tasksArr.find((t: Task) => t.shareToken === token);
                        if (!matchingTask) {
                            setError('הקישור בוטל או שאינו תקין');
                            setLoading(false);
                            return;
                        }
                        setTask(matchingTask);
                        setAllClientTasks(tasksArr);
                        setError(null);
                        setLoading(false);
                    },
                    (err) => {
                        console.error('Snapshot subscription error', err);
                        if (!cancelled) {
                            setError('שגיאה בטעינת הצ\'קליסט');
                            setLoading(false);
                        }
                    }
                );
            } catch (err) {
                console.error('Error initializing checklist', err);
                if (!cancelled) {
                    setError('שגיאה בטעינת הצ\'קליסט');
                    setLoading(false);
                }
            }
        };

        init();

        return () => {
            cancelled = true;
            if (unsubscribe) unsubscribe();
        };
    }, [userId, token]);

    // Subscribe to this client's uploaded files (public read) so we can show
    // attachments + per-item counts. Anyone with the link may upload, no login.
    useEffect(() => {
        if (!clientId) return;
        const docsQuery = query(
            collection(db, 'users', userId, 'documents'),
            where('clientId', '==', clientId),
        );
        const unsub = onSnapshot(docsQuery, (snap) => {
            setClientFiles(
                snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as CrmDocument))
                    .filter(d => d.kind === 'file')
            );
        }, (err) => console.error('Files subscription error', err));
        return unsub;
    }, [userId, clientId]);

    const filesForSubtask = (subtaskId: string): CrmDocument[] =>
        clientFiles.filter(f => f.sourceSubtaskId === subtaskId);

    const handleAttachClick = (sub: Subtask) => {
        if (filesForSubtask(sub.id).length >= MAX_FILES_PER_SUBTASK) {
            alert(`ניתן לצרף עד ${MAX_FILES_PER_SUBTASK} קבצים לכל פריט.`);
            return;
        }
        pendingSubtaskRef.current = sub;
        subtaskFileInputRef.current?.click();
    };

    const handleSubtaskFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        const sub = pendingSubtaskRef.current;
        pendingSubtaskRef.current = null;
        if (!file || !sub) return;
        if (file.size > MAX_UPLOAD_BYTES) { alert('הקובץ גדול מדי. הגודל המרבי הוא 10MB.'); return; }
        if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
            alert('סוג קובץ לא נתמך. ניתן להעלות תמונות, PDF, Word ו-Excel.');
            return;
        }
        if (filesForSubtask(sub.id).length >= MAX_FILES_PER_SUBTASK) {
            alert(`ניתן לצרף עד ${MAX_FILES_PER_SUBTASK} קבצים לכל פריט.`);
            return;
        }
        setUploadingSubtaskId(sub.id);
        try {
            await uploadPublicFile(file, { userId, shareToken: token, subtaskId: sub.id });
        } catch (err: any) {
            console.error('Public upload failed', err);
            alert(`העלאת הקובץ נכשלה: ${err?.message || 'שגיאה'}`);
        } finally {
            setUploadingSubtaskId(null);
        }
    };

    // Anyone with the link may mark items — the write goes through the server
    // (Admin SDK), authorized by the share token, so no login is required.
    const canEdit = true;

    const handleToggleSubtask = async (subtaskId: string) => {
        if (!task || updating) return;
        setUpdating(true);

        const prevTask = task;
        const prevTasksArr = allClientTasks;

        const current = (task.subtasks || []).find(s => s.id === subtaskId);
        const newValue = !current?.isCompleted;

        const updatedSubtasks = (task.subtasks || []).map(s =>
            s.id === subtaskId ? { ...s, isCompleted: newValue } : s
        );
        const updatedTask: Task = { ...task, subtasks: updatedSubtasks };
        const updatedTasksArr = allClientTasks.map(t => t.id === task.id ? updatedTask : t);

        // Optimistic UI update
        setTask(updatedTask);
        setAllClientTasks(updatedTasksArr);

        try {
            await togglePublicSubtask(userId, token, subtaskId, newValue);
        } catch (err) {
            console.error('Failed to update subtask', err);
            // Revert on failure
            setTask(prevTask);
            setAllClientTasks(prevTasksArr);
            alert('שגיאה בשמירת השינוי. נסה שוב.');
        } finally {
            setUpdating(false);
        }
    };

    const ThemeToggle = (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-colors"
            title={isDark ? 'מצב יום' : 'מצב לילה'}
            aria-label="החלפת מצב תצוגה"
        >
            {isDark ? (
                <Sun className="w-5 h-5" />
            ) : (
                <Moon className="w-5 h-5" />
            )}
        </button>
    );

    if (loading || !authReady) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center" dir="rtl">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400" />
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4" dir="rtl">
                <div className="absolute top-4 left-4">{ThemeToggle}</div>
                <div className="text-center">
                    <div className="mb-4"><CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" /></div>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{error || 'הצ\'קליסט לא נמצא'}</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">ייתכן שהקישור אינו תקין או שהשיתוף בוטל.</p>
                </div>
            </div>
        );
    }

    const subtasks: Subtask[] = task.subtasks || [];
    const completedCount = subtasks.filter(s => s.isCompleted).length;
    const totalCount = subtasks.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 overflow-y-auto" dir="rtl">
            <div className="max-w-[1600px] mx-auto p-4 sm:p-8 pb-12">
                {/* Brand logo */}
                <div className="flex justify-center mb-6">
                    {logoUrl
                        ? <img src={logoUrl} alt="לוגו" className="h-12 sm:h-14 w-auto max-w-[260px] object-contain" />
                        : <DefaultLogo className="h-14 sm:h-16 w-auto" />}
                </div>

                {/* Top bar — title + theme toggle */}
                <div className="flex items-center justify-between mb-6 gap-4">
                    <div className="flex-1 text-center">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">{task.text}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">צ'קליסט משותף</p>
                    </div>
                    <div className="flex-shrink-0">{ThemeToggle}</div>
                </div>

                {/* Checklist Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Progress bar */}
                    {totalCount > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">התקדמות</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {completedCount} / {totalCount} ({progress}%)
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full transition-all duration-500"
                                    style={{ width: `${progress}%`, backgroundColor: '#00A876' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Hidden input shared by all attach buttons */}
                    <input
                        ref={subtaskFileInputRef}
                        type="file"
                        className="hidden"
                        accept={ALLOWED_UPLOAD_TYPES.join(',')}
                        onChange={handleSubtaskFile}
                    />

                    {/* Subtasks */}
                    <div className="p-6">
                        {subtasks.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">אין פריטים בצ'קליסט</p>
                        ) : (
                            <ul className="space-y-2">
                                {subtasks.map((sub) => {
                                    const attached = filesForSubtask(sub.id);
                                    const isUploading = uploadingSubtaskId === sub.id;
                                    const atLimit = attached.length >= MAX_FILES_PER_SUBTASK;
                                    return (
                                    <li
                                        key={sub.id}
                                        className={`p-3 rounded-xl border transition-all ${
                                            sub.isCompleted
                                                ? 'bg-green-50/40 dark:bg-emerald-900/10 border-green-100 dark:border-emerald-900/30'
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={sub.isCompleted}
                                                onChange={() => handleToggleSubtask(sub.id)}
                                                disabled={!canEdit || updating}
                                                className={`form-checkbox h-5 w-5 text-green-600 dark:bg-gray-700 dark:border-gray-600 ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                                                style={{ borderRadius: '50%' }}
                                                title={canEdit ? '' : 'התחבר כדי לסמן פריטים'}
                                            />
                                            <span className={`flex-1 text-base break-words min-w-0 ${sub.isCompleted ? 'line-through text-gray-500 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
                                                <LinkifiedContent content={sub.text} />
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleAttachClick(sub)}
                                                disabled={isUploading || atLimit}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                                                title={atLimit ? `הגעת למקסימום ${MAX_FILES_PER_SUBTASK} קבצים` : 'צרף קובץ'}
                                            >
                                                <Paperclip className="w-4 h-4" />
                                                {isUploading ? 'מעלה...' : (attached.length > 0 ? `צרף קובץ נוסף (${attached.length})` : 'צרף קובץ')}
                                            </button>
                                        </div>
                                        {attached.length > 0 && (
                                            <ul className="mt-2 mr-8 space-y-1">
                                                {attached.map(f => (
                                                    <li key={f.id} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                                        <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 truncate">
                                                            <Download className="w-3.5 h-3.5 shrink-0" />
                                                            <span className="truncate">{f.fileName || f.title}</span>
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Footer note */}
                <div className="text-center mt-6 text-xs text-gray-400 dark:text-gray-500">
                    ניתן לסמן פריטים שהושלמו ולצרף קבצים לכל פריט
                </div>
            </div>
        </div>
    );
};
