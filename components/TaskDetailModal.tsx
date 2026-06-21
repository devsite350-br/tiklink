
import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Task, Subtask } from '../types';
import { LabelSelector } from './LabelSelector';
import { useAppContext } from '../context/AppContext';
import { X, ChevronDown, Link } from 'lucide-react';

const generateSubtaskId = () => `sub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
const generateShareToken = () => `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 10)}${Math.random().toString(36).substr(2, 10)}`;

interface TaskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Task;
    clients?: { id: string; name: string }[];
    clientId?: string;
    onClientChange?: (newClientId: string) => void;
    onSave: (updatedTask: Task) => void | Promise<void>;
    userId: string;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ isOpen, onClose, task, clients, clientId, onClientChange, onSave, userId }) => {
    const { entityLabels } = useAppContext();
    const [text, setText] = useState(task.text);
    const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks || []);
    const [labelIds, setLabelIds] = useState<string[]>(task.labelIds || []);
    const [dueDate, setDueDate] = useState<string>(task.dueDate || '');
    const [shareToken, setShareToken] = useState<string | undefined>(task.shareToken);
    const [newSubtaskText, setNewSubtaskText] = useState('');
    const [showShareCopied, setShowShareCopied] = useState(false);
    const [shareBusy, setShareBusy] = useState(false);
    const initialTaskIdRef = useRef(task.id);
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const clientDropdownRef = useRef<HTMLDivElement>(null);
    const clientChangedRef = useRef(false);

    useEffect(() => {
        if (task.id !== initialTaskIdRef.current) {
            initialTaskIdRef.current = task.id;
        }
        setText(task.text);
        setSubtasks(task.subtasks || []);
        setLabelIds(task.labelIds || []);
        setDueDate(task.dueDate || '');
        setShareToken(task.shareToken);
        clientChangedRef.current = false;
    }, [task.id]);

    // Real-time sync: when subtasks change upstream (e.g. external public link toggles V),
    // reflect them in the modal without losing the user's open session.
    const upstreamSubtasksKey = (task.subtasks || []).map(s => `${s.id}:${s.isCompleted ? 1 : 0}:${s.text}`).join('|');
    useEffect(() => {
        setSubtasks(task.subtasks || []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [upstreamSubtasksKey]);

    // Real-time sync: share token may be created/revoked from another tab.
    useEffect(() => {
        setShareToken(task.shareToken);
    }, [task.shareToken]);

    useEffect(() => {
        if (!isClientDropdownOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
                setIsClientDropdownOpen(false);
                setClientSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isClientDropdownOpen]);

    // Auto-save with debounce — use refs for task/onSave to avoid infinite loops
    // when Firestore realtime pushes back the saved data and recreates these props.
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const taskRef = useRef(task);
    taskRef.current = task;
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;

    const hasChanges = () => {
        const t = taskRef.current;
        if ((text.trim() || t.text) !== t.text) return true;
        if (JSON.stringify(labelIds) !== JSON.stringify(t.labelIds || [])) return true;
        if ((dueDate || '') !== (t.dueDate || '')) return true;
        if (shareToken !== t.shareToken) return true;
        const currentSubKey = subtasks.map(s => `${s.id}:${s.isCompleted ? 1 : 0}:${s.text}`).join('|');
        const taskSubKey = (t.subtasks || []).map(s => `${s.id}:${s.isCompleted ? 1 : 0}:${s.text}`).join('|');
        if (currentSubKey !== taskSubKey) return true;
        return false;
    };

    const flushSave = () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!hasChanges() && !clientChangedRef.current) return;
        const updated: Task = {
            ...taskRef.current,
            text: text.trim() || taskRef.current.text,
            subtasks: subtasks.length > 0 ? subtasks : undefined,
            labelIds,
            dueDate: dueDate || undefined,
            shareToken,
        };
        clientChangedRef.current = false;
        onSaveRef.current(updated);
    };

    useEffect(() => {
        if (!hasChanges()) return;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(flushSave, 400);
        return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    }, [text, subtasks, labelIds, dueDate, shareToken]);

    const isChecklist = subtasks.length > 0;

    const handleAddSubtask = () => {
        if (!newSubtaskText.trim()) return;
        setSubtasks([...subtasks, { id: generateSubtaskId(), text: newSubtaskText.trim(), isCompleted: false }]);
        setNewSubtaskText('');
    };

    const handleToggleSubtask = (id: string) => {
        setSubtasks(prev => prev.map(s => s.id === id ? { ...s, isCompleted: !s.isCompleted } : s));
    };

    const handleEditSubtask = (id: string, newText: string) => {
        setSubtasks(subtasks.map(s => s.id === id ? { ...s, text: newText } : s));
    };

    const handleDeleteSubtask = (id: string) => {
        setSubtasks(subtasks.filter(s => s.id !== id));
    };

    const buildUpdatedTask = (overrides?: Partial<Task>): Task => ({
        ...task,
        text: text.trim() || task.text,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
        labelIds,
        dueDate: dueDate || undefined,
        shareToken,
        ...overrides,
    });

    const handleCreateShareLink = async () => {
        if (shareToken || shareBusy) return;
        const newToken = generateShareToken();
        setShareToken(newToken);
        setShareBusy(true);
        try {
            await onSave(buildUpdatedTask({ shareToken: newToken }));
        } catch (err) {
            console.error('Failed to persist share token', err);
            setShareToken(undefined);
            alert('שגיאה ביצירת קישור השיתוף');
        } finally {
            setShareBusy(false);
        }
    };

    const handleRevokeShare = async () => {
        if (shareBusy) return;
        if (!window.confirm('האם לבטל את קישור השיתוף? הקישור יפסיק לעבוד.')) return;
        const prevToken = shareToken;
        setShareToken(undefined);
        setShareBusy(true);
        try {
            await onSave(buildUpdatedTask({ shareToken: undefined }));
        } catch (err) {
            console.error('Failed to revoke share token', err);
            setShareToken(prevToken);
            alert('שגיאה בביטול הקישור');
        } finally {
            setShareBusy(false);
        }
    };

    const buildShareUrl = () => {
        if (!shareToken) return '';
        return `${window.location.origin}/task/${userId}/${shareToken}`;
    };

    const handleCopyShareLink = async () => {
        const url = buildShareUrl();
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setShowShareCopied(true);
            setTimeout(() => setShowShareCopied(false), 2000);
        } catch {
            window.prompt('העתק את הקישור:', url);
        }
    };

    const completedCount = subtasks.filter(s => s.isCompleted).length;

    const handleClose = () => { flushSave(); onClose(); };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={isChecklist ? "עריכת משימת צ'קליסט" : 'עריכת משימה'}>
            <div className="space-y-5">
                {/* Task Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">כותרת המשימה</label>
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary dark:bg-base-800 dark:border-gray-600 outline-none"
                        placeholder="מה צריך לעשות?"
                    />
                </div>

                {/* Subtasks (Checklist) */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            תתי-משימות (צ'קליסט)
                            {isChecklist && (
                                <span className="mr-2 text-xs text-gray-500">
                                    {completedCount}/{subtasks.length}
                                </span>
                            )}
                        </label>
                        {isChecklist && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                צ'קליסט
                            </span>
                        )}
                    </div>

                    {subtasks.length > 0 && (
                        <ul className="space-y-1.5 mb-3">
                            {subtasks.map((sub) => (
                                <li key={sub.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-white/5 group">
                                    <input
                                        type="checkbox"
                                        checked={sub.isCompleted}
                                        onChange={() => handleToggleSubtask(sub.id)}
                                        className="form-checkbox h-4 w-4 rounded-full text-primary border-gray-300 dark:border-gray-600 cursor-pointer"
                                        style={{ borderRadius: '50%' }}
                                    />
                                    <input
                                        type="text"
                                        value={sub.text}
                                        onChange={(e) => handleEditSubtask(sub.id, e.target.value)}
                                        className={`flex-1 bg-transparent border-none outline-none text-sm ${sub.isCompleted ? 'line-through text-gray-500' : ''}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteSubtask(sub.id)}
                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="מחק פריט"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newSubtaskText}
                            onChange={(e) => setNewSubtaskText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                            placeholder={subtasks.length === 0 ? 'הוסף פריט צ\'קליסט (יהפוך את המשימה לצ\'קליסט)' : 'הוסף פריט חדש...'}
                            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary dark:bg-base-800 dark:border-gray-600 outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleAddSubtask}
                            disabled={!newSubtaskText.trim()}
                            className="px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                            הוסף
                        </button>
                    </div>
                </div>

                {/* Client (if applicable) */}
                {clients && clientId !== undefined && onClientChange && (
                    <div ref={clientDropdownRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{`שיוך ${entityLabels.toSingular}`}</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsClientDropdownOpen(o => !o)}
                                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary dark:bg-base-800 dark:border-gray-600 outline-none flex items-center"
                            >
                                <span className="flex-1 text-right truncate">{clients.find(c => c.id === clientId)?.name || ''}</span>
                                <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0 mr-2" />
                            </button>
                            {isClientDropdownOpen && (
                                <div className="absolute z-50 mt-1 right-0 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                    <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                        <input
                                            type="text"
                                            value={clientSearchTerm}
                                            onChange={(e) => setClientSearchTerm(e.target.value)}
                                            placeholder={`חיפוש ${entityLabels.singular}...`}
                                            autoFocus
                                            className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-primary focus:border-primary"
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto py-1">
                                        {(() => {
                                            const lower = clientSearchTerm.toLowerCase();
                                            const matched = clients.filter(c => !lower || c.name.toLowerCase().includes(lower));
                                            if (matched.length === 0) {
                                                return <div className="px-3 py-2 text-sm text-gray-500 text-center">{entityLabels.noEntities}</div>;
                                            }
                                            return matched.map(c => (
                                                <button key={c.id} type="button"
                                                    onClick={() => { onClientChange(c.id); clientChangedRef.current = true; setIsClientDropdownOpen(false); setClientSearchTerm(''); }}
                                                    className={`w-full text-right px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 truncate ${clientId === c.id ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                                                >{c.name}</button>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Due Date */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">תאריך ושעה</label>
                    <input
                        type="datetime-local"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary dark:bg-base-800 dark:border-gray-600 outline-none"
                    />
                </div>

                {/* Labels */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">תגיות</label>
                    <LabelSelector selectedLabelIds={labelIds} onChange={setLabelIds} module="task" />
                </div>

                {/* Share Link - only for checklist tasks */}
                {isChecklist && (
                    <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">שיתוף חיצוני</label>
                        {!shareToken ? (
                            <button
                                type="button"
                                onClick={handleCreateShareLink}
                                disabled={shareBusy}
                                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Link className="w-4 h-4" />
                                {shareBusy ? 'יוצר קישור...' : 'צור קישור שיתוף'}
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        readOnly
                                        value={buildShareUrl()}
                                        className="flex-1 px-3 py-2 text-xs border rounded-lg bg-gray-50 dark:bg-base-950 dark:border-gray-600 outline-none font-mono"
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCopyShareLink}
                                        className="px-3 py-2 text-sm rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 whitespace-nowrap transition-colors"
                                        title="העתק קישור"
                                    >
                                        {showShareCopied ? '✓ הועתק' : 'העתק'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRevokeShare}
                                        disabled={shareBusy}
                                        className="px-3 py-2 text-sm rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="ביטול שיתוף"
                                    >
                                        {shareBusy ? '...' : 'ביטול'}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    כל מי שיש לו את הקישור יוכל לראות ולסמן את פריטי הצ'קליסט (ללא גישה לפרטים אחרים).
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Close button */}
                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-white/10">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
                    >
                        סגור
                    </button>
                </div>
            </div>
        </Modal>
    );
};
