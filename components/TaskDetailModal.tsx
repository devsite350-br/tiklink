
import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Task, Subtask, CrmDocument, CustomFieldType, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, MAX_FILES_PER_SUBTASK } from '../types';
import { useAppContext } from '../context/AppContext';
import { uploadFile } from '../utils/apiClient';
import { X, ChevronDown, Link, Paperclip, Download, Mail } from 'lucide-react';

const generateSubtaskId = () => `sub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

const formatWhatsAppNumber = (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.startsWith('0')) {
        return '972' + cleanNumber.substring(1);
    }
    return cleanNumber;
};
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
    const { entityLabels, addDocument, documents, clients: allClients, customFields } = useAppContext();
    const [text, setText] = useState(task.text);
    const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks || []);
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
    }, [text, subtasks, dueDate, shareToken]);

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

    // ── Per-subtask file attachments ──
    const subtaskFileInputRef = useRef<HTMLInputElement>(null);
    const pendingSubtaskRef = useRef<Subtask | null>(null);
    const [uploadingSubtaskId, setUploadingSubtaskId] = useState<string | null>(null);

    const filesForSubtask = (subtaskId: string): CrmDocument[] =>
        documents.filter(d => d.kind === 'file' && d.clientId === clientId && d.sourceSubtaskId === subtaskId);

    const handleAttachClick = (sub: Subtask) => {
        if (!clientId) return;
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
        if (!file || !sub || !clientId) return;
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
            const fileUrl = await uploadFile(file, `documents/${clientId}`);
            const now = Date.now();
            await addDocument({
                clientId,
                title: file.name,
                status: 'sent',
                kind: 'file',
                fileUrl,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                uploadedBy: 'team',
                sourceSubtaskId: sub.id,
                sourceSubtaskText: sub.text,
                publicToken: '',
                createdAt: now,
                updatedAt: now,
            } as Omit<CrmDocument, 'id'>);
        } catch (err: any) {
            console.error('Subtask file upload failed', err);
            alert(`העלאת הקובץ נכשלה: ${err?.message || 'שגיאה'}`);
        } finally {
            setUploadingSubtaskId(null);
        }
    };

    const buildUpdatedTask = (overrides?: Partial<Task>): Task => ({
        ...task,
        text: text.trim() || task.text,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
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

    // Associated client + its phone/email, for sharing the link directly with them.
    const sharedClient = clientId ? allClients.find(c => c.id === clientId) : undefined;
    const phoneFieldId = customFields.find(f => f.type === CustomFieldType.PHONE)?.id;
    const emailFieldId = customFields.find(f => f.type === CustomFieldType.EMAIL)?.id;
    const clientPhone = sharedClient && phoneFieldId ? sharedClient.customFields[phoneFieldId] : null;
    const clientEmail = sharedClient && emailFieldId ? sharedClient.customFields[emailFieldId] : null;

    const buildShareMessage = () => {
        const url = buildShareUrl();
        const greeting = sharedClient?.name ? `שלום ${sharedClient.name},` : 'שלום,';
        return `${greeting}\nמצורף קישור לצ'קליסט "${text}":\n${url}`;
    };

    const buildWhatsAppUrl = () => {
        if (!clientPhone) return '';
        return `https://wa.me/${formatWhatsAppNumber(clientPhone)}?text=${encodeURIComponent(buildShareMessage())}`;
    };

    const buildMailtoUrl = () => {
        if (!clientEmail) return '';
        const subject = `צ'קליסט: ${text}`;
        return `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildShareMessage())}`;
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

                    {/* Hidden input shared by all subtask attach buttons */}
                    <input
                        ref={subtaskFileInputRef}
                        type="file"
                        className="hidden"
                        accept={ALLOWED_UPLOAD_TYPES.join(',')}
                        onChange={handleSubtaskFile}
                    />

                    {subtasks.length > 0 && (
                        <ul className="space-y-1.5 mb-3">
                            {subtasks.map((sub) => {
                                const attached = filesForSubtask(sub.id);
                                const isUploading = uploadingSubtaskId === sub.id;
                                const atLimit = attached.length >= MAX_FILES_PER_SUBTASK;
                                return (
                                <li key={sub.id} className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 group">
                                    <div className="flex items-center gap-2">
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
                                        {clientId && (
                                            <button
                                                type="button"
                                                onClick={() => handleAttachClick(sub)}
                                                disabled={isUploading || atLimit}
                                                className={`flex items-center gap-1 text-xs px-1.5 py-1 rounded transition-colors disabled:opacity-50 ${attached.length > 0 ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
                                                title={atLimit ? `הגעת למקסימום ${MAX_FILES_PER_SUBTASK} קבצים` : 'צרף קובץ'}
                                            >
                                                <Paperclip className="w-4 h-4" />
                                                {isUploading ? '...' : (attached.length > 0 ? `${attached.length}/${MAX_FILES_PER_SUBTASK}` : '')}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteSubtask(sub.id)}
                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="מחק פריט"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {attached.length > 0 && (
                                        <ul className="mt-1.5 mr-6 space-y-1">
                                            {attached.map(f => (
                                                <li key={f.id} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                                    <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary truncate">
                                                        <Download className="w-3 h-3 shrink-0" />
                                                        <span className="truncate">{f.fileName || f.title}</span>
                                                    </a>
                                                    {f.uploadedBy === 'client' && <span className="text-green-600 dark:text-green-400">· מהלקוח</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                                );
                            })}
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
                                {(clientPhone || clientEmail) && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">שתף עם {sharedClient?.name || 'הלקוח'}:</span>
                                        {clientPhone && (
                                            <a
                                                href={buildWhatsAppUrl()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="שתף בוואטסאפ"
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 transition-colors shadow-sm"
                                            >
                                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                </svg>
                                            </a>
                                        )}
                                        {clientEmail && (
                                            <a
                                                href={buildMailtoUrl()}
                                                title="שתף במייל"
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors shadow-sm"
                                            >
                                                <Mail className="h-4 w-4" />
                                            </a>
                                        )}
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    כל מי שיש לו את הקישור יוכל לראות את פריטי הצ'קליסט ולצרף קבצים לכל פריט, ללא התחברות (ללא גישה לפרטים אחרים).
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
