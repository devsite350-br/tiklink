
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from './Modal';
import { useAppContext } from '../context/AppContext';
import { Client, CustomFieldType, Task, ActivityEvent } from '../types';
import { BulkTaskModal } from './BulkTaskModal';
import { TaskDetailModal } from './TaskDetailModal';
import { StatusSelector } from './StatusSelector';
import { LabelSelector } from './LabelSelector';
import Comments from './Comments';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { UserAvatar } from './UserAvatar';
import { ClientMeetingsTab } from './ClientMeetingsTab';
import { ClientWhatsAppTab } from './ClientWhatsAppTab';
import { DocumentsList } from './DocumentsList';
import LinkifiedContent from './LinkifiedContent';

interface ClientFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientToEdit: Client | null;
}

import { TimeInput } from './TimeInput';
import { ChevronDown, X, Calendar as CalendarIcon, Minus, Plus, Check, Pencil, Trash2, User, ClipboardCheck, FileText, Sparkles, Copy, ExternalLink } from 'lucide-react';

const isColorLight = (hexColor: string) => {
    const color = (hexColor.charAt(0) === '#') ? hexColor.substring(1, 7) : hexColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186);
};

const getTaskCreationTime = (taskId: string) => {
    const parts = taskId.split('_');
    if (parts.length >= 2) {
        const timestamp = parseInt(parts[1], 10);
        return isNaN(timestamp) ? 0 : timestamp;
    }
    return 0;
};

const TaskManager: React.FC<{
    tasks: Task[];
    setTasks: (tasks: Task[]) => void;
    onActivityEvent: (event: ActivityEvent) => void;
    prefill?: { text: string; nonce: number } | null;
}> = ({ tasks, setTasks, onActivityEvent, prefill }) => {
    const { labelMap, visibilitySettings, effectiveUserId } = useAppContext();
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskLabelIds, setNewTaskLabelIds] = useState<string[]>([]);
    const [newTaskDueDate, setNewTaskDueDate] = useState<string>('');
    const [isBulkModalOpen, setBulkModalOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingTaskText, setEditingTaskText] = useState('');
    const [editingTaskLabelIds, setEditingTaskLabelIds] = useState<string[]>([]);
    const [editingTaskDueDate, setEditingTaskDueDate] = useState<string>('');
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
    const newTaskTextareaRef = useRef<HTMLTextAreaElement>(null);

    const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    };

    useEffect(() => {
        if (!prefill) return;
        setNewTaskText(prefill.text);
        if (newTaskTextareaRef.current) {
            newTaskTextareaRef.current.focus();
            autoResizeTextarea(newTaskTextareaRef.current);
        }
    }, [prefill?.nonce]);

    const sortedTasks = useMemo(() => {
        return [...tasks].sort((a, b) => {
            if (a.isCompleted !== b.isCompleted) {
                return Number(a.isCompleted) - Number(b.isCompleted);
            }
            const dateA = getTaskCreationTime(a.id);
            const dateB = getTaskCreationTime(b.id);
            return dateB - dateA;
        });
    }, [tasks]);

    const handleAddTask = () => {
        if (newTaskText.trim()) {
            const user = auth.currentUser;
            setTasks([...tasks, { id: `task_${Date.now()}`, text: newTaskText.trim(), isCompleted: false, labelIds: newTaskLabelIds, dueDate: newTaskDueDate || undefined, createdAt: Date.now(), authorId: user?.uid || '', authorName: user?.displayName || user?.email?.split('@')[0] || '', authorPhotoUrl: user?.photoURL || '' }]);
            setNewTaskText('');
            setNewTaskLabelIds([]);
            setNewTaskDueDate('');
            if (newTaskTextareaRef.current) {
                newTaskTextareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleBulkAddTasks = (title: string, itemsText: string) => {
        const user = auth.currentUser;
        const subtasks = itemsText.split('\n')
            .map(t => t.trim()).filter(t => t.length > 0)
            .map((text, i) => ({ id: `sub_${Date.now()}_${i}`, text, isCompleted: false }));

        const newTask: Task = {
            id: `task_${Date.now()}`,
            text: title,
            isCompleted: false,
            createdAt: Date.now(),
            authorId: user?.uid || '',
            authorName: user?.displayName || user?.email?.split('@')[0] || '',
            authorPhotoUrl: user?.photoURL || '',
            subtasks: subtasks.length > 0 ? subtasks : [],
        };
        setTasks([...tasks, newTask]);
        setBulkModalOpen(false);
    };

    const handleDetailSave = (updated: Task) => {
        setTasks(tasks.map(t => t.id === updated.id ? updated : t));
        // Modal closes itself via its own onClose flow — keep open if caller only persists
    };

    const handleToggleTask = (taskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (task && !task.isCompleted) {
            const user = auth.currentUser;
            onActivityEvent({
                id: Date.now().toString(),
                type: 'task_completed',
                timestamp: Date.now(),
                authorId: user?.uid || '',
                authorName: user?.displayName || user?.email?.split('@')[0] || '',
                authorPhotoUrl: user?.photoURL || '',
                title: `משימה הושלמה: "${task.text}"`,
                refId: task.id,
            });
        }
        setTasks(tasks.map(t => {
            if (t.id === taskId) {
                return { ...t, isCompleted: !t.isCompleted };
            }
            return t;
        }));
    };

    const handleEditStart = (e: React.MouseEvent, task: Task) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingTaskId(task.id);
        setEditingTaskText(task.text);
        setEditingTaskLabelIds(task.labelIds || []);
        setEditingTaskDueDate(task.dueDate || '');
    };

    const handleEditCancel = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setEditingTaskId(null);
        setEditingTaskText('');
        setEditingTaskLabelIds([]);
        setEditingTaskDueDate('');
    };

    const handleEditSave = (e?: React.FormEvent | React.KeyboardEvent | React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!editingTaskId) return;
        setTasks(tasks.map(t => t.id === editingTaskId ? { ...t, text: editingTaskText, labelIds: editingTaskLabelIds, dueDate: editingTaskDueDate || undefined } : t));
        setEditingTaskId(null);
        setEditingTaskText('');
        setEditingTaskLabelIds([]);
        setEditingTaskDueDate('');
    };

    const handleManualTimeChange = (taskId: string, newTotalTime: number) => {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, totalTime: newTotalTime } : t));
    };

    const handleTimeAdjustment = (taskId: string, adjustmentMs: number) => {
        setTasks(tasks.map(task => {
            if (task.id === taskId) {
                const currentTotal = Number(task.totalTime) || 0;
                let newTotalTime = currentTotal + adjustmentMs;
                if (newTotalTime < 0) newTotalTime = 0;
                return { ...task, totalTime: newTotalTime };
            }
            return task;
        }));
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2">
                <textarea
                    ref={newTaskTextareaRef}
                    value={newTaskText}
                    onChange={e => { setNewTaskText(e.target.value); autoResizeTextarea(e.target); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTask(); } }}
                    onFocus={e => autoResizeTextarea(e.target)}
                    placeholder="הוסף משימה חדשה..."
                    rows={1}
                    className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm resize-none overflow-hidden"
                />
                <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex-grow min-w-0">
                        <LabelSelector selectedLabelIds={newTaskLabelIds} onChange={setNewTaskLabelIds} module="task" />
                    </div>
                    <input
                        type="datetime-local"
                        value={newTaskDueDate}
                        onChange={e => setNewTaskDueDate(e.target.value)}
                        className="px-3 py-2.5 min-h-[46px] text-sm bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                        title="תאריך ושעה"
                    />
                    <button type="button" onClick={handleAddTask} className="px-4 py-2.5 min-h-[46px] rounded-xl bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">הוסף</button>
                    <button type="button" onClick={() => setBulkModalOpen(true)} className="px-4 py-2.5 min-h-[46px] rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all font-medium">רשימה</button>
                </div>
            </div>
            <ul className="space-y-2 pr-2">
                {sortedTasks.map(task => {
                    const isEditing = editingTaskId === task.id;
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOverdue = (() => {
                        if (!task.dueDate || task.isCompleted) return false;
                        if (task.dueDate.includes('T')) return new Date(task.dueDate) < new Date();
                        return task.dueDate < todayStr;
                    })();
                    const isExpanded = expandedTaskId === task.id || isEditing;
                    const isChecklistTask = Array.isArray(task.subtasks) && task.subtasks.length > 0;
                    const borderColor = !task.dueDate ? '#d1d5db' : isOverdue ? '#ef4444' : '#3b82f6';
                    return (
                        <li key={task.id} className={`p-3 bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 border-r-4 rounded-xl transition-all ${isEditing ? 'overflow-visible' : 'overflow-hidden'} ${isExpanded ? 'ring-2 ring-primary/20' : ''}`} style={{ borderRightColor: borderColor }}>
                            {/* Row 1: checkbox + full-width text/input */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={task.isCompleted}
                                    onChange={() => handleToggleTask(task.id)}
                                    onClick={e => e.stopPropagation()}
                                    className={`form-checkbox h-5 w-5 text-primary border-gray-300 dark:border-gray-600 bg-transparent flex-shrink-0 transition-all cursor-pointer ${isChecklistTask ? '' : 'rounded-lg'}`}
                                    style={isChecklistTask ? { borderRadius: '50%' } : undefined}
                                    title={isChecklistTask ? "סימון משימת צ'קליסט" : 'סימון משימה'}
                                />

                                {/* Checklist indicator + share link */}
                                {isChecklistTask && (
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span
                                            className="flex items-center text-blue-500 dark:text-blue-400"
                                            title={`משימת צ'קליסט (${(task.subtasks || []).filter(s => s.isCompleted).length}/${(task.subtasks || []).length})`}
                                        >
                                            <ClipboardCheck className="w-4 h-4" />
                                        </span>
                                        {task.shareToken && (
                                            <a
                                                href={`${window.location.origin}/task/${effectiveUserId}/${task.shareToken}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="hidden md:flex items-center text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                                title="פתח קישור שיתוף בלשונית חדשה"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                )}

                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editingTaskText}
                                        onChange={e => setEditingTaskText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleEditSave(e)}
                                        className="flex-grow px-3 py-1.5 bg-white dark:bg-base-950 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary/50 min-w-0"
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                    />
                                ) : (
                                    <div
                                        className={`flex-grow min-w-0 cursor-pointer ${isExpanded ? 'break-words' : 'truncate'}`}
                                        title={task.text}
                                        onClick={() => setDetailTaskId(task.id)}
                                    >
                                        <span className={`${task.isCompleted ? 'line-through text-gray-500' : ''}`}>
                                            <LinkifiedContent content={task.text} />
                                        </span>
                                        {isChecklistTask && (task.subtasks || []).length > 0 && (
                                            <span dir="ltr" className="ml-2 text-xs text-gray-500 dark:text-gray-400" style={{ unicodeBidi: 'isolate' }}>
                                                ({(task.subtasks || []).filter(s => s.isCompleted).length}/{(task.subtasks || []).length})
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Label badges row - shown below task title when not editing */}
                            {!isEditing && task.labelIds && task.labelIds.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5 mr-8">
                                    {task.labelIds.map(id => {
                                        const label = labelMap.get(id);
                                        if (!label) return null;
                                        return (
                                            <span key={id} className="text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm opacity-80"
                                                style={{ backgroundColor: label.color, color: isColorLight(label.color) ? '#000' : '#FFF' }}>
                                                {label.name}
                                            </span>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Bottom Row: Date/Tags & Controls */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-2 mr-8">
                                {/* Right Side (RTL): Tags / Due Date */}
                                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                                    {isEditing ? (
                                        <>
                                            <div className="flex-grow min-w-0">
                                                <LabelSelector selectedLabelIds={editingTaskLabelIds} onChange={setEditingTaskLabelIds} module="task" />
                                            </div>
                                            <input
                                                type="datetime-local"
                                                value={editingTaskDueDate}
                                                onChange={e => setEditingTaskDueDate(e.target.value)}
                                                className="px-3 py-2.5 text-sm bg-white dark:bg-base-950 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary/50"
                                                title="תאריך ושעה"
                                            />
                                        </>
                                    ) : (
                                        <div
                                            className="inline-flex items-center gap-1 cursor-pointer"
                                            onClick={() => {
                                                const input = document.getElementById(`date-modal-${task.id}`) as HTMLInputElement;
                                                if (input) { try { input.showPicker(); } catch { input.focus(); } }
                                            }}
                                        >
                                            <input
                                                id={`date-modal-${task.id}`}
                                                type="datetime-local"
                                                value={task.dueDate || ''}
                                                onChange={e => {
                                                    setTasks(tasks.map(t => t.id === task.id ? { ...t, dueDate: e.target.value || undefined } : t));
                                                }}
                                                className="sr-only"
                                            />
                                            {task.dueDate ? (
                                                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                    <CalendarIcon className="w-3 h-3" />
                                                    {task.dueDate.includes('T') ? (() => {
                                                        const d = new Date(task.dueDate);
                                                        return `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
                                                    })() : new Date(task.dueDate + 'T00:00:00').toLocaleDateString('he-IL')}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors">
                                                    <CalendarIcon className="w-3 h-3" />
                                                    הוסף תאריך
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Left Side (RTL): Timer & Action Buttons */}
                                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                                    {(visibilitySettings.tasks?.enableTimeTracking ?? true) && (
                                    <div className="flex items-center gap-2 bg-white dark:bg-base-950/50 px-2 py-1 rounded-full border border-gray-100 dark:border-white/10 shrink-0 group">
                                        <button type="button" onClick={() => handleTimeAdjustment(task.id, -5 * 60 * 1000)} className="text-gray-400 hover:text-red-500 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <TimeInput valueMs={Number(task.totalTime) || 0} onChange={(val) => handleManualTimeChange(task.id, val)} className="font-mono text-xs w-10 text-center bg-transparent outline-none focus:ring-1 focus:ring-primary/50 rounded" />
                                        <button type="button" onClick={() => handleTimeAdjustment(task.id, 5 * 60 * 1000)} className="text-gray-400 hover:text-green-500 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                    )}
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button type="button" onClick={handleEditSave} className="text-green-500 hover:text-green-600">
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <button type="button" onClick={handleEditCancel} className="text-red-500 hover:text-red-600">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button type="button" onClick={(e) => handleEditStart(e, task)} className="text-blue-500 hover:text-blue-600 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button type="button" onClick={() => setTasks(tasks.filter(t => t.id !== task.id))} className="text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
            {isBulkModalOpen && <BulkTaskModal onAdd={handleBulkAddTasks} onClose={() => setBulkModalOpen(false)} />}
            {detailTaskId && (() => {
                const t = tasks.find(t => t.id === detailTaskId);
                if (!t) return null;
                return (
                    <TaskDetailModal
                        isOpen={true}
                        onClose={() => setDetailTaskId(null)}
                        task={t}
                        onSave={handleDetailSave}
                        userId={effectiveUserId}
                    />
                );
            })()}
        </div>
    );
};

export const ClientFormModal: React.FC<ClientFormModalProps> = ({ isOpen, onClose, clientToEdit }) => {
    const { addClient, deleteClient, updateClient, triggerAutomations, customFields, statuses, userId, effectiveUserId, teamMembers, leadSources, visibilitySettings, entityLabels } = useAppContext();
    const [activeTab, setActiveTab] = useState<'details' | 'tasks' | 'ai' | 'meetings' | 'documents' | 'whatsapp'>('details');
    const [aiEnabled, setAiEnabled] = useState(false);
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const copyToClipboard = (value: string, fieldId: string) => {
        navigator.clipboard.writeText(value);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 1500);
    };
    const [taskPrefill, setTaskPrefill] = useState<{ text: string; nonce: number } | null>(null);
    const [meetingPrefill, setMeetingPrefill] = useState<{ text: string; nonce: number } | null>(null);
    const assigneeDropdownRef = useRef<HTMLDivElement>(null);

    const handleCopyToTask = (text: string) => {
        setTaskPrefill({ text, nonce: Date.now() });
        setActiveTab('tasks');
    };

    const handleCopyToMeeting = (text: string) => {
        setMeetingPrefill({ text, nonce: Date.now() });
        setActiveTab('meetings');
    };

    const visibleCustomFields = useMemo(() => customFields.filter(f => f.showInCard ?? true), [customFields]);

    const showStatuses = visibilitySettings.statuses.showInCard;
    const showLabels = visibilitySettings.labels.showInCard;
    const showUsers = visibilitySettings.users.showInCard;
    const showTasks = visibilitySettings.tasks.enabled !== false && visibilitySettings.tasks.showInCard;
    const showAiSummary = visibilitySettings.aiSummary.enabled !== false && visibilitySettings.aiSummary.showInCard;
    const showLeadSources = visibilitySettings.leadSources.enabled !== false && visibilitySettings.leadSources.showInCard;
    const showMeetings = visibilitySettings.meetings?.enabled !== false && visibilitySettings.meetings?.showInCard !== false;
    const showDocuments = visibilitySettings.documents?.enabled !== false && visibilitySettings.documents?.showInCard !== false;
    const showWhatsApp = visibilitySettings.whatsapp?.enabled !== false && visibilitySettings.whatsapp?.showInCard !== false;
    const showCreatedAt = visibleCustomFields.some(f => f.id === '__createdAt');
    const notesFieldDef = customFields.find(f => f.id === '__notes');
    const showNotes = notesFieldDef ? notesFieldDef.showInCard !== false : true;

    const [clientData, setClientData] = useState<Omit<Client, 'id'>>({
        name: '',
        status: 'חדש',
        notes: '',
        tasks: [],
        comments: [],
        customFields: {},
        labelIds: [],
        aiSummary: '',
        assignedTo: '',
        sourceId: '',
    });

    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
    const lastSavedClientData = useRef<Omit<Client, 'id'> | null>(null);
    const previousStatusRef = useRef<string>(clientToEdit?.status || '');

    const handleDelete = async () => {
        if (!clientToEdit) return;
        if (window.confirm(`האם אתה בטוח שברצונך למחוק את ${entityLabels.theSingular}?`)) {
            await deleteClient(clientToEdit.id);
            onClose();
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (clientToEdit) {
                const serverData = { ...clientToEdit };
                delete (serverData as any).id;
                
                if (!lastSavedClientData.current) {
                    lastSavedClientData.current = serverData;
                    setClientData(serverData);
                    setActiveTab('details');
                    previousStatusRef.current = serverData.status || 'חדש';
                } else {
                    setClientData(prev => {
                        const newData = { ...prev };
                        let changed = false;

                        (Object.keys(serverData) as (keyof typeof serverData)[]).forEach(key => {
                            if (JSON.stringify(prev[key]) === JSON.stringify(lastSavedClientData.current![key])) {
                                if (JSON.stringify(prev[key]) !== JSON.stringify(serverData[key])) {
                                    newData[key] = serverData[key] as any;
                                    lastSavedClientData.current![key] = serverData[key] as any;
                                    changed = true;
                                }
                            }
                        });

                        return changed ? newData : prev;
                    });
                }
            } else {
                if (!lastSavedClientData.current) {
                    const initData = {
                        name: '',
                        status: statuses[0]?.name || 'חדש',
                        notes: '',
                        tasks: [],
                        comments: [],
                        activityLog: [],
                        customFields: {},
                        labelIds: [],
                        aiSummary: '',
                        assignedTo: '',
                        sourceId: '',
                    };
                    lastSavedClientData.current = initData;
                    setClientData(initData);
                    setActiveTab('details');
                    previousStatusRef.current = initData.status;
                }
            }
        } else {
            lastSavedClientData.current = null;
        }
    }, [clientToEdit, isOpen, statuses]);

    // Fetch AI enabled setting
    useEffect(() => {
        if (!effectiveUserId) return;
        const fetchAiSetting = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', effectiveUserId));
                if (userDoc.exists()) {
                    setAiEnabled(userDoc.data().aiEnabled || false);
                }
            } catch (e) {
                console.error('Failed to fetch AI setting', e);
            }
        };
        fetchAiSetting();
    }, [effectiveUserId]);

    useEffect(() => {
        if (clientToEdit && isOpen && lastSavedClientData.current) {
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }

            debounceTimeout.current = setTimeout(async () => {
                if (clientData.name && clientData.name.trim()) {
                    const changes: any = {};
                    (Object.keys(clientData) as (keyof typeof clientData)[]).forEach(key => {
                        if (JSON.stringify(clientData[key]) !== JSON.stringify(lastSavedClientData.current![key])) {
                            changes[key] = clientData[key];
                        }
                    });

                    if (Object.keys(changes).length > 0) {
                        try {
                            const oldStatus = previousStatusRef.current;
                            
                            lastSavedClientData.current = { ...lastSavedClientData.current!, ...changes };
                            
                            if (changes.status) {
                                previousStatusRef.current = changes.status;
                            }

                            await updateClient({ id: clientToEdit.id, ...changes });

                            if (changes.status && changes.status !== oldStatus) {
                                const updatedClient = { ...clientToEdit, ...clientData };
                                triggerAutomations(updatedClient, changes.status, oldStatus);
                            }
                        } catch (err) {
                            console.error("Save failed", err);
                        }
                    }
                }
            }, 800);
        }

        return () => {
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
        };
    }, [clientData, clientToEdit, updateClient, triggerAutomations, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientData.name.trim()) return;
        try {
            if (clientToEdit) {
                const changes: any = {};
                if (lastSavedClientData.current) {
                    (Object.keys(clientData) as (keyof typeof clientData)[]).forEach(key => {
                        if (JSON.stringify(clientData[key]) !== JSON.stringify(lastSavedClientData.current![key])) {
                            changes[key] = clientData[key];
                        }
                    });
                }
                if (Object.keys(changes).length > 0) {
                    await updateClient({ id: clientToEdit.id, ...changes });
                }
            } else {
                await addClient(clientData);
            }
            onClose();
        } catch (err) {
            console.error("Failed to save client", err);
            alert(`שגיאה בשמירת ${entityLabels.theSingular}. נסה שוב.`);
        }
    };

    // Helper to determine AI status
    const getAIStatus = () => {
        if (clientData.aiSummary) return 'completed';
        const notes = clientData.notes || '';
        if (notes.includes('[System]: AI Processing Started')) return 'processing';
        if (notes.includes('[System]: AI Skipped')) return 'skipped';
        if (notes.includes('[System]: AI Error')) return 'error';
        if (notes.includes('[System]: AI Failed')) return 'error';
        return 'idle';
    };

    const aiStatus = getAIStatus();

    const handleAssigneeChange = (newAssigneeId: string) => {
        const user = auth.currentUser;
        const assignedMember = teamMembers.find(m => m.id === newAssigneeId);
        const title = newAssigneeId
            ? `שויך ל-"${assignedMember?.displayName || assignedMember?.email?.split('@')[0] || newAssigneeId}"`
            : 'שיוך משתמש הוסר';
        const event: ActivityEvent = {
            id: Date.now().toString(),
            type: 'user_assigned',
            timestamp: Date.now(),
            authorId: user?.uid || '',
            authorName: user?.displayName || user?.email?.split('@')[0] || '',
            authorPhotoUrl: user?.photoURL || '',
            title,
        };
        setClientData(p => ({
            ...p,
            assignedTo: newAssigneeId,
            activityLog: [...(p.activityLog || []), event],
        }));
        setShowAssigneeDropdown(false);
    };

    const handleStatusChange = (newStatus: string) => {
        const user = auth.currentUser;
        const event: ActivityEvent = {
            id: Date.now().toString(),
            type: 'status_change',
            timestamp: Date.now(),
            authorId: user?.uid || '',
            authorName: user?.displayName || user?.email?.split('@')[0] || '',
            authorPhotoUrl: user?.photoURL || '',
            title: `סטטוס שונה ל-"${newStatus}"`,
            fromStatus: clientData.status,
            toStatus: newStatus,
        };
        setClientData(p => ({
            ...p,
            status: newStatus,
            activityLog: [...(p.activityLog || []), event],
        }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={clientToEdit ? entityLabels.editEntity : entityLabels.addNewFull} mode="side">
            <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
                <div className="border-b border-gray-200 dark:border-white/10 mb-6 flex justify-between items-center overflow-x-auto">
                    <div className="flex gap-1 sm:gap-6 min-w-max">
                        <button type="button" onClick={() => setActiveTab('details')} className={`pb-2 sm:pb-3 px-2 sm:px-2 border-b-2 font-medium transition-all flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            <User className="w-5 h-5 sm:w-4 sm:h-4" />
                            <span className="text-[11px] sm:text-sm leading-none">פרטים</span>
                        </button>
                        {showTasks && (
                            <button type="button" onClick={() => setActiveTab('tasks')} className={`pb-2 sm:pb-3 px-2 sm:px-2 border-b-2 font-medium transition-all flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 ${activeTab === 'tasks' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                <ClipboardCheck className="w-5 h-5 sm:w-4 sm:h-4" />
                                <span className="text-[11px] sm:text-sm leading-none">משימות ({clientData.tasks.length})</span>
                            </button>
                        )}
                        {showMeetings && (
                            <button type="button" onClick={() => setActiveTab('meetings')} className={`pb-2 sm:pb-3 px-2 sm:px-2 border-b-2 font-medium transition-all flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 ${activeTab === 'meetings' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                <CalendarIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                                <span className="text-[11px] sm:text-sm leading-none">יומן</span>
                            </button>
                        )}
                        {showDocuments && clientToEdit && (
                            <button type="button" onClick={() => setActiveTab('documents')} className={`pb-2 sm:pb-3 px-2 sm:px-2 border-b-2 font-medium transition-all flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 ${activeTab === 'documents' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                <FileText className="w-5 h-5 sm:w-4 sm:h-4" />
                                <span className="text-[11px] sm:text-sm leading-none">מסמכים</span>
                            </button>
                        )}
                        {showWhatsApp && clientToEdit && (
                            <button type="button" onClick={() => setActiveTab('whatsapp')} className={`pb-2 sm:pb-3 px-2 sm:px-2 border-b-2 font-medium transition-all flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 ${activeTab === 'whatsapp' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                <svg className="w-5 h-5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                <span className="text-[11px] sm:text-sm leading-none">וואטסאפ</span>
                            </button>
                        )}
                        {aiEnabled && clientToEdit && showAiSummary && (
                            <button type="button" onClick={() => setActiveTab('ai')} className={`pb-2 sm:pb-3 px-2 sm:px-2 border-b-2 font-medium transition-all flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 ${activeTab === 'ai' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                <Sparkles className="w-5 h-5 sm:w-4 sm:h-4" />
                                <span className="text-[11px] sm:text-sm leading-none flex items-center">
                                    סיכום AI
                                    {aiStatus === 'processing' && <span className="mr-1 sm:mr-2 inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
                                    {aiStatus === 'completed' && <span className="mr-1 sm:mr-2 inline-block w-2 h-2 rounded-full bg-green-500" />}
                                </span>
                            </button>
                        )}
                    </div>
                    {/* ... (delete button) ... */}
                </div>

                {activeTab === 'details' && (
                    <div className="space-y-4">
                        {/* ... (details form inputs) ... */}
                        {/* REMOVED PREVIOUS AI SUMMARY BOX FROM HERE */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="group/field">
                            <label className="flex items-center gap-1.5 text-sm font-medium">
                                {entityLabels.nameOf}
                                {clientData.name && (
                                    <button type="button" onClick={() => copyToClipboard(clientData.name, 'name')} className="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10" title="העתק">
                                        {copiedField === 'name' ? (
                                            <Check className="w-3.5 h-3.5 text-green-400" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5 text-gray-400" />
                                        )}
                                    </button>
                                )}
                            </label>
                            <input type="text" value={clientData.name} onChange={e => setClientData(p => ({ ...p, name: e.target.value }))} required className="w-full mt-1 px-4 py-2.5 bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all shadow-sm" />
                        </div>
                        {showStatuses && (
                            <div>
                                <label className="block text-sm font-medium">סטטוס</label>
                                <StatusSelector value={clientData.status} onChange={handleStatusChange} />
                            </div>
                        )}
                        {showLabels && (
                            <div>
                                <label className="block text-sm font-medium">תגיות</label>
                                <div className="mt-1">
                                    <LabelSelector selectedLabelIds={clientData.labelIds || []} onChange={val => setClientData(p => ({ ...p, labelIds: val }))} module="client" />
                                </div>
                            </div>
                        )}
                        {/* Assignee Field */}
                        {showUsers && (
                            <div>
                                <label className="block text-sm font-medium mb-1">משתמש</label>
                                <div className="relative" ref={assigneeDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm text-right"
                                    >
                                        {clientData.assignedTo ? (
                                            (() => {
                                                const member = teamMembers.find(m => m.id === clientData.assignedTo);
                                                return member ? (
                                                    <>
                                                        <UserAvatar name={member.displayName || member.email} photoUrl={member.photoUrl} size="xs" showTooltip={false} />
                                                        <span className="text-sm text-gray-700 dark:text-gray-200">{member.displayName || member.email}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-sm text-gray-400">משתמש לא נמצא</span>
                                                );
                                            })()
                                        ) : (
                                            <>
                                                <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                                    <Plus className="w-3 h-3 text-gray-400" />
                                                </div>
                                                <span className="text-sm text-gray-400">הקצה למשתמש...</span>
                                            </>
                                        )}
                                        <ChevronDown className="w-4 h-4 text-gray-400 mr-auto" />
                                    </button>
                                    {showAssigneeDropdown && (
                                        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-base-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                            <button
                                                type="button"
                                                onClick={() => handleAssigneeChange('')}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-right border-b border-gray-100 dark:border-white/5"
                                            >
                                                <div className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                                    <X className="w-3 h-3 text-gray-400" />
                                                </div>
                                                <span className="text-sm text-gray-500">ללא הקצאה</span>
                                            </button>
                                            {teamMembers.map(member => (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    onClick={() => handleAssigneeChange(member.id)}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-right ${clientData.assignedTo === member.id ? 'bg-primary/5 dark:bg-primary/10' : ''
                                                        }`}
                                                >
                                                    <UserAvatar name={member.displayName || member.email} photoUrl={member.photoUrl} size="xs" showTooltip={false} />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{member.displayName || member.email?.split('@')[0]}</span>
                                                        <span className="text-[11px] text-gray-400">{member.email}</span>
                                                    </div>
                                                    {clientData.assignedTo === member.id && (
                                                        <Check className="w-4 h-4 text-primary mr-auto" />
                                                    )}
                                                </button>
                                            ))}
                                            {teamMembers.length === 0 && (
                                                <div className="px-4 py-6 text-center text-sm text-gray-400">
                                                    אין חברי צוות. הוסף חברי צוות בהגדרות.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {showLeadSources && (
                            <div>
                                <label className="block text-sm font-medium">מקור הגעה</label>
                                <select
                                    value={clientData.sourceId || ''}
                                    onChange={e => setClientData(p => ({ ...p, sourceId: e.target.value }))}
                                    className="w-full mt-1 px-4 py-2.5 bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
                                >
                                    <option value="">בחר מקור הגעה...</option>
                                    {leadSources.map(source => (
                                        <option key={source.id} value={source.id}>{source.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {visibleCustomFields.filter(f => f.id !== '__createdAt' && f.id !== '__notes').map(f => {
                            const fieldValue = clientData.customFields[f.id] || '';
                            const isCopyable = fieldValue && [CustomFieldType.TEXT, CustomFieldType.EMAIL, CustomFieldType.PHONE, CustomFieldType.URL, CustomFieldType.NUMBER].includes(f.type);
                            const isUrl = f.type === CustomFieldType.URL;
                            return (
                            <div key={f.id} className="group/field">
                                <label className="flex items-center gap-1.5 text-sm font-medium">
                                    {f.name}
                                    {isCopyable && (
                                        <button type="button" onClick={() => copyToClipboard(fieldValue, f.id)} className="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10" title="העתק">
                                            {copiedField === f.id ? (
                                                <Check className="w-3.5 h-3.5 text-green-400" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5 text-gray-400" />
                                            )}
                                        </button>
                                    )}
                                    {isUrl && fieldValue && (
                                        <a href={fieldValue.startsWith('http') ? fieldValue : `https://${fieldValue}`} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10" title="פתח קישור">
                                            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                                        </a>
                                    )}
                                </label>
                                <input
                                    type={f.type === CustomFieldType.DATE ? 'date' : f.type === CustomFieldType.NUMBER ? 'number' : 'text'}
                                    value={fieldValue}
                                    onChange={e => setClientData(p => ({ ...p, customFields: { ...p.customFields, [f.id]: e.target.value } }))}
                                    className="w-full mt-1 px-4 py-2.5 bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all shadow-sm"
                                />
                            </div>
                            );
                        })}
                        {showCreatedAt && clientToEdit && (
                            <div className="group/field">
                                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                                    תאריך יצירה
                                    {clientToEdit.createdAt && (
                                        <button type="button" onClick={() => copyToClipboard(new Date(clientToEdit.createdAt).toLocaleString('he-IL'), 'createdAt')} className="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10" title="העתק">
                                            {copiedField === 'createdAt' ? (
                                                <Check className="w-3.5 h-3.5 text-green-400" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5 text-gray-400" />
                                            )}
                                        </button>
                                    )}
                                </label>
                                <div className="mt-1 px-4 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-xl border border-transparent">
                                    {clientToEdit.createdAt ? new Date(clientToEdit.createdAt).toLocaleString('he-IL') : '-'}
                                </div>
                            </div>
                        )}
                        </div>
                        {showNotes && (
                        <div>
                            <label className="block text-sm font-medium">פרטים נוספים</label>
                            <textarea value={clientData.notes} onChange={e => setClientData(p => ({ ...p, notes: e.target.value }))} rows={3} className="w-full mt-1 px-4 py-2.5 bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all shadow-sm" />
                        </div>
                        )}
                        {clientToEdit && <Comments client={{ ...clientData, id: clientToEdit.id }} setClient={setClientData} />}
                    </div>
                )}

                {activeTab === 'tasks' && <TaskManager tasks={clientData.tasks} setTasks={val => setClientData(p => ({ ...p, tasks: val }))} onActivityEvent={event => setClientData(p => ({ ...p, activityLog: [...(p.activityLog || []), event] }))} prefill={taskPrefill} />}

                {activeTab === 'meetings' && <ClientMeetingsTab client={clientToEdit} prefill={meetingPrefill} />}

                {activeTab === 'documents' && clientToEdit && <DocumentsList client={clientToEdit} />}

                {activeTab === 'whatsapp' && clientToEdit && <ClientWhatsAppTab client={clientToEdit} onCopyToTask={handleCopyToTask} onCopyToMeeting={handleCopyToMeeting} />}

                {activeTab === 'ai' && (
                    <div className="space-y-6 p-1">
                        <div className={`p-6 rounded-2xl border ${aiStatus === 'completed' ? 'bg-purple-50 border-purple-100 dark:bg-purple-900/10 dark:border-purple-500/20' :
                            aiStatus === 'processing' ? 'bg-yellow-50 border-yellow-100 dark:bg-yellow-900/10 dark:border-yellow-500/20' :
                                aiStatus === 'error' ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-500/20' :
                                    'bg-gray-50 border-gray-100 dark:bg-base-900/50 dark:border-white/10'
                            }`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-lg text-2xl ${aiStatus === 'completed' ? 'bg-purple-100 dark:bg-purple-400/20' :
                                    aiStatus === 'processing' ? 'bg-yellow-100 dark:bg-yellow-400/20' :
                                        aiStatus === 'error' ? 'bg-red-100 dark:bg-red-400/20' :
                                            'bg-gray-200 dark:bg-white/10'
                                    }`}>
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {aiStatus === 'completed' ? 'סיכום AI' :
                                            aiStatus === 'processing' ? 'מעבד נתונים...' :
                                                aiStatus === 'error' ? 'שגיאה בעיבוד' :
                                                    aiStatus === 'skipped' ? 'עיבוד AI דלג' :
                                                        'לא קיים סיכום'}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {aiStatus === 'completed' ? 'סיכום ותובנות שנוצרו באמצעות AI' :
                                            aiStatus === 'processing' ? `המערכת מנתחת את פרטי ${entityLabels.theSingular} כעת` :
                                                aiStatus === 'skipped' ? 'הגדרות AI כבויות או חסר מפתח' :
                                                    'עיבוד AI פעיל רק עבור רשומות ממקור חיצוני'}
                                    </p>
                                </div>
                            </div>

                            {clientData.aiSummary ? (
                                <div className="prose dark:prose-invert max-w-none">
                                    <p className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">
                                        {clientData.aiSummary}
                                    </p>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 italic p-4 bg-white/50 dark:bg-black/20 rounded-lg border border-gray-100 dark:border-white/5">
                                    {aiStatus === 'processing' ? 'נא להמתין, המידע יתעדכן אוטומטית...' :
                                        'אין מידע להצגה.'}
                                </div>
                            )}
                        </div>

                        {/* Debug Logs Visibility */}
                        {(aiStatus === 'error' || aiStatus === 'skipped') && (
                            <div className="bg-gray-50 dark:bg-base-900/50 p-4 rounded-xl text-xs font-mono text-gray-500 overflow-x-auto">
                                <strong>System Logs:</strong>
                                <pre className="mt-2 whitespace-pre-wrap">{clientData.notes?.split('[System]:').slice(1).map(s => `[System]:${s}`).join('') || 'No system logs found.'}</pre>
                            </div>
                        )}
                    </div>
                )}

                {!clientToEdit && (
                    <div className="pt-6 mt-6 border-t border-gray-100 dark:border-white/10 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-medium">ביטול</button>
                        <button type="submit" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-95 transition-all font-medium">{entityLabels.saveEntity}</button>
                    </div>
                )}
            </form>
        </Modal>
    );
};
