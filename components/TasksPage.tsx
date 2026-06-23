
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Client, Task, TaskPriority, UNASSOCIATED_CLIENT_ID } from '../types';
import LinkifiedContent from './LinkifiedContent';
import { Modal } from './Modal';
import { TaskDetailModal } from './TaskDetailModal';
import { BulkTaskModal } from './BulkTaskModal';
import { ChevronRight, ArrowDownNarrowWide, ArrowUpNarrowWide, Calendar, ChevronDown, ChevronUp, ClipboardCheck, Filter, Search, Plus, ListChecks, ExternalLink, Check, X, Pencil, Trash2, List, Columns3, SortDesc, SortAsc } from 'lucide-react';
import { TaskKanbanBoard } from './TaskKanbanBoard';

interface TasksPageProps {
    onClientClick: (client: Client) => void;
    isMobileSidebarOpen?: boolean;
    onCloseMobileSidebar?: () => void;
}

const generateId = () => {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const TasksPage: React.FC<TasksPageProps> = ({ onClientClick, isMobileSidebarOpen, onCloseMobileSidebar }) => {
    const { clients, updateClient, effectiveUserId, entityLabels } = useAppContext();
    const clientsRef = useRef<Client[]>(clients);

    useEffect(() => {
        clientsRef.current = clients;
    }, [clients]);

    const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
        const saved = localStorage.getItem('tasksViewMode');
        return saved === 'kanban' ? 'kanban' : 'list';
    });
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const [clientFilterSearch, setClientFilterSearch] = useState('');
    const clientDropdownRef = useRef<HTMLDivElement>(null);
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
    const [sortField, setSortField] = useState<'creation' | 'dueDate'>('creation');
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingTaskText, setEditingTaskText] = useState('');
    const [editingTaskClientId, setEditingTaskClientId] = useState<string>('');
    const [editingTaskDueDate, setEditingTaskDueDate] = useState<string>('');

    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskClientId, setNewTaskClientId] = useState<string>('');
    const [newTaskDueDate, setNewTaskDueDate] = useState<string>('');
    const [detailTask, setDetailTask] = useState<{ taskId: string; originalClientId: string; currentClientId: string } | null>(null);

    // Live lookup: always reflects the latest task from the realtime clients context
    const liveDetailTask = useMemo(() => {
        if (!detailTask) return null;
        const client = clients.find(c => c.id === detailTask.originalClientId);
        return client?.tasks.find(t => t.id === detailTask.taskId) || null;
    }, [detailTask, clients]);
    const [isBulkModalOpen, setBulkModalOpen] = useState(false);
    const [isNewTaskClientDropdownOpen, setIsNewTaskClientDropdownOpen] = useState(false);
    const [newTaskClientSearch, setNewTaskClientSearch] = useState('');
    const newTaskClientDropdownRef = useRef<HTMLDivElement>(null);
    const [isEditingClientDropdownOpen, setIsEditingClientDropdownOpen] = useState(false);
    const [editingClientSearch, setEditingClientSearch] = useState('');
    const editingClientDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isClientDropdownOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
                setIsClientDropdownOpen(false);
                setClientFilterSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isClientDropdownOpen]);

    useEffect(() => {
        if (!isNewTaskClientDropdownOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (newTaskClientDropdownRef.current && !newTaskClientDropdownRef.current.contains(e.target as Node)) {
                setIsNewTaskClientDropdownOpen(false);
                setNewTaskClientSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isNewTaskClientDropdownOpen]);

    useEffect(() => {
        if (!isEditingClientDropdownOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (editingClientDropdownRef.current && !editingClientDropdownRef.current.contains(e.target as Node)) {
                setIsEditingClientDropdownOpen(false);
                setEditingClientSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditingClientDropdownOpen]);


    // Deduplicate Task IDs
    useEffect(() => {
        let foundDuplicates = false;

        clients.forEach(client => {
            const seenIds = new Set<string>();
            let clientHasDupes = false;

            const newTasks = client.tasks.map(t => {
                if (seenIds.has(t.id)) {
                    clientHasDupes = true;
                    return { ...t, id: generateId() };
                }
                seenIds.add(t.id);
                return t;
            });

            if (clientHasDupes) {
                foundDuplicates = true;
                updateClient({ ...client, tasks: newTasks });
            }
        });
    }, [clients, updateClient]);

    const getTaskCreationTime = (taskId: string) => {
        const parts = taskId.split('_');
        if (parts.length >= 2) {
            const timestamp = parseInt(parts[1], 10);
            return isNaN(timestamp) ? 0 : timestamp;
        }
        return 0;
    };

    const allTasks = useMemo(() => {
        const tasksWithClientInfo: { task: Task, client: Client }[] = [];
        clients.forEach(client => {
            client.tasks.forEach(task => {
                tasksWithClientInfo.push({ task, client });
            });
        });
        return tasksWithClientInfo;
    }, [clients]);

    const getTaskDateStr = (dueDate: string | undefined) => {
        if (!dueDate) return '';
        return dueDate.includes('T') ? dueDate.split('T')[0] : dueDate;
    };

    const formatDueDate = (dueDate: string) => {
        if (dueDate.includes('T')) {
            const d = new Date(dueDate);
            const dateStr = d.toLocaleDateString('he-IL');
            const timeStr = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            return `${dateStr} ${timeStr}`;
        }
        return new Date(dueDate + 'T00:00:00').toLocaleDateString('he-IL');
    };

    const isTaskOverdue = (task: Task) => {
        if (!task.dueDate || task.isCompleted) return false;
        const now = new Date();
        if (task.dueDate.includes('T')) {
            return new Date(task.dueDate) < now;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return task.dueDate < today.toISOString().split('T')[0];
    };

    const filteredTasks = useMemo(() => {
        let tasks = [...allTasks];

        // 1. Filter by Client
        if (selectedClientId) {
            tasks = tasks.filter(({ client }) => client.id === selectedClientId);
        }

        // 2. Filter by Search
        if (searchTerm.trim()) {
            const lowerTerm = searchTerm.toLowerCase();
            tasks = tasks.filter(({ task, client }) => {
                const taskText = task.text.toLowerCase();
                const clientName = client.name.toLowerCase();

                return taskText.includes(lowerTerm) ||
                    clientName.includes(lowerTerm);
            });
        }

        // 3. Sort
        return tasks.sort((a, b) => {
            // Always show completed tasks at the bottom
            if (a.task.isCompleted !== b.task.isCompleted) {
                return Number(a.task.isCompleted) - Number(b.task.isCompleted);
            }

            if (sortField === 'dueDate') {
                // Sort by due date — tasks without dates go to the end
                const dateA = a.task.dueDate || '';
                const dateB = b.task.dueDate || '';
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return sortDirection === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
            }

            // Sort by creation date
            const dateA = getTaskCreationTime(a.task.id);
            const dateB = getTaskCreationTime(b.task.id);

            return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }, [allTasks, selectedClientId, searchTerm, sortDirection, sortField]);

    const handleTaskToggle = async (clientId: string, taskId: string) => {
        const client = clientsRef.current.find(c => c.id === clientId);
        if (!client) return;
        const updatedTasks = client.tasks.map(task => {
            if (task.id === taskId) {
                return { ...task, isCompleted: !task.isCompleted };
            }
            return task;
        });

        const updatedClient = { ...client, tasks: updatedTasks };
        clientsRef.current = clientsRef.current.map(c => c.id === clientId ? updatedClient : c);
        await updateClient(updatedClient);
    };

    const handleEditStart = (task: Task, clientId: string) => {
        setEditingTaskId(task.id);
        setEditingTaskText(task.text);
        setEditingTaskClientId(clientId);
        setEditingTaskDueDate(task.dueDate || '');
    };

    const handleEditCancel = () => {
        setEditingTaskId(null);
        setEditingTaskText('');
        setIsEditingClientDropdownOpen(false);
        setEditingClientSearch('');
    };

    const handleEditSave = async (originalClientId: string, taskId: string) => {
        try {
            if (editingTaskText.trim() === '') return;

            // If client didn't change
            if (originalClientId === editingTaskClientId) {
                const client = clientsRef.current.find(c => c.id === originalClientId);
                if (!client) return;
                const updatedTasks = client.tasks.map(t => t.id === taskId ? { ...t, text: editingTaskText.trim(), dueDate: editingTaskDueDate || undefined } : t);
                const updatedClient = { ...client, tasks: updatedTasks };
                clientsRef.current = clientsRef.current.map(c => c.id === originalClientId ? updatedClient : c);
                await updateClient(updatedClient);
            } else {
                // Move task to new client
                const originalClient = clientsRef.current.find(c => c.id === originalClientId);
                let newClient = clientsRef.current.find(c => c.id === editingTaskClientId);

                if (!newClient && editingTaskClientId === UNASSOCIATED_CLIENT_ID) {
                    newClient = {
                        id: UNASSOCIATED_CLIENT_ID,
                        name: 'משימות כלליות',
                        status: 'חדש',
                        tasks: [],
                        comments: [],
                        customFields: {},
                        labelIds: []
                    } as any;
                }

                if (originalClient && newClient) {
                    // Remove from original
                    const taskToMove = originalClient.tasks.find(t => t.id === taskId);
                    if (taskToMove) {
                        const updatedOriginalTasks = originalClient.tasks.filter(t => t.id !== taskId);
                        const updatedOriginalClient = { ...originalClient, tasks: updatedOriginalTasks };

                        // Add to new
                        const updatedTask = { ...taskToMove, text: editingTaskText.trim(), dueDate: editingTaskDueDate || undefined };
                        const newTasksArray = newClient.tasks || [];
                        const updatedNewClient = { ...newClient, tasks: [...newTasksArray, updatedTask] };

                        if (clientsRef.current.some(c => c.id === editingTaskClientId)) {
                            clientsRef.current = clientsRef.current.map(c => {
                                if (c.id === originalClientId) return updatedOriginalClient;
                                if (c.id === editingTaskClientId) return updatedNewClient;
                                return c;
                            });
                        } else {
                            clientsRef.current = clientsRef.current.map(c => c.id === originalClientId ? updatedOriginalClient : c);
                            clientsRef.current.push(updatedNewClient);
                        }

                        await updateClient(updatedOriginalClient);
                        await updateClient(updatedNewClient);
                    }
                }
            }
            handleEditCancel();
        } catch (error: any) {
            console.error("Error in handleEditSave", error);
            alert("שגיאה בעדכון המשימה: " + error.message);
        }
    };

    const handleAddTask = async () => {
        try {
            console.log("handleAddTask start");
            if (!newTaskText.trim()) return;

            const targetClientId = newTaskClientId || UNASSOCIATED_CLIENT_ID;
            let client = clientsRef.current.find(c => c.id === targetClientId);

            if (!client && targetClientId === UNASSOCIATED_CLIENT_ID) {
                console.log("No unassociated client found, creating temporary one");
                client = {
                    id: UNASSOCIATED_CLIENT_ID,
                    name: 'משימות כלליות',
                    status: 'חדש',
                    tasks: [],
                    comments: [],
                    customFields: {},
                    labelIds: []
                } as any;
            }

            if (client) {
                console.log("Found client, creating task...");
                const newTask: Task = {
                    id: generateId(),
                    text: newTaskText.trim(),
                    isCompleted: false,
                    priority: 'medium',
                    dueDate: newTaskDueDate || undefined,
                    createdAt: Date.now()
                };

                const tasksArray = client.tasks || [];
                const updatedClient = { ...client, tasks: [...tasksArray, newTask] };

                if (clientsRef.current.some(c => c.id === targetClientId)) {
                    clientsRef.current = clientsRef.current.map(c => c.id === targetClientId ? updatedClient : c);
                } else {
                    clientsRef.current = [...clientsRef.current, updatedClient];
                }

                console.log("Updating client in Firebase...");
                await updateClient(updatedClient);
                console.log("Client updated successfully.");
                setNewTaskText('');
                setNewTaskDueDate('');
                setAddModalOpen(false);
            } else {
                console.warn("Could not find client to add task to");
                alert(`לא נמצא ${entityLabels.card} מתאים לשיוך המשימה.`);
            }
        } catch (error: any) {
            console.error("Error in handleAddTask", error);
            alert("שגיאה בשמירת משימה: " + error.message);
        }
    };

    const handleBulkAddTasks = async (title: string, itemsText: string) => {
        try {
            const targetClientId = newTaskClientId || selectedClientId || UNASSOCIATED_CLIENT_ID;
            let client = clientsRef.current.find(c => c.id === targetClientId);

            if (!client && targetClientId === UNASSOCIATED_CLIENT_ID) {
                client = {
                    id: UNASSOCIATED_CLIENT_ID,
                    name: 'משימות כלליות',
                    status: 'חדש',
                    tasks: [],
                    comments: [],
                    customFields: {},
                    labelIds: []
                } as any;
            }

            if (!client) {
                alert(`לא נמצא ${entityLabels.card} מתאים לשיוך המשימה.`);
                return;
            }

            const subtasks = itemsText.split('\n')
                .map(t => t.trim()).filter(t => t.length > 0)
                .map((text, i) => ({ id: `sub_${Date.now()}_${i}`, text, isCompleted: false }));

            const newTask: Task = {
                id: generateId(),
                text: title,
                isCompleted: false,
                priority: 'medium',
                createdAt: Date.now(),
                subtasks: subtasks.length > 0 ? subtasks : [],
            };

            const tasksArray = client.tasks || [];
            const updatedClient = { ...client, tasks: [...tasksArray, newTask] };

            if (clientsRef.current.some(c => c.id === targetClientId)) {
                clientsRef.current = clientsRef.current.map(c => c.id === targetClientId ? updatedClient : c);
            } else {
                clientsRef.current = [...clientsRef.current, updatedClient];
            }

            await updateClient(updatedClient);
            setBulkModalOpen(false);
        } catch (error: any) {
            console.error('Error in handleBulkAddTasks', error);
            alert('שגיאה ביצירת צ\'קליסט: ' + error.message);
        }
    };

    const handleDeleteTask = async (clientId: string, taskId: string) => {
        const client = clientsRef.current.find(c => c.id === clientId);
        if (!client) return;
        const updatedTasks = client.tasks.filter(t => t.id !== taskId);
        const updatedClient = { ...client, tasks: updatedTasks };
        clientsRef.current = clientsRef.current.map(c => c.id === clientId ? updatedClient : c);
        await updateClient(updatedClient);
    };

    const handleInlineDateChange = async (clientId: string, taskId: string, newDueDate: string) => {
        const client = clientsRef.current.find(c => c.id === clientId);
        if (!client) return;

        const updatedTasks = client.tasks.map(task =>
            task.id === taskId ? { ...task, dueDate: newDueDate || undefined } : task
        );

        const updatedClient = { ...client, tasks: updatedTasks };
        clientsRef.current = clientsRef.current.map(c => c.id === clientId ? updatedClient : c);
        await updateClient(updatedClient);
    };

    const handleDetailSave = async (updated: Task) => {
        if (!detailTask) return;
        const { originalClientId, currentClientId } = detailTask;

        if (originalClientId === currentClientId) {
            const client = clientsRef.current.find(c => c.id === originalClientId);
            if (!client) return;
            const updatedTasks = client.tasks.map(t => t.id === updated.id ? updated : t);
            const updatedClient = { ...client, tasks: updatedTasks };
            clientsRef.current = clientsRef.current.map(c => c.id === originalClientId ? updatedClient : c);
            await updateClient(updatedClient);
        } else {
            // Move task between clients
            const origClient = clientsRef.current.find(c => c.id === originalClientId);
            let destClient = clientsRef.current.find(c => c.id === currentClientId);

            if (!destClient && currentClientId === UNASSOCIATED_CLIENT_ID) {
                destClient = {
                    id: UNASSOCIATED_CLIENT_ID,
                    name: 'משימות כלליות',
                    status: 'חדש',
                    tasks: [],
                    comments: [],
                    customFields: {},
                    labelIds: []
                } as any;
            }

            if (origClient && destClient) {
                const updatedOrig = { ...origClient, tasks: origClient.tasks.filter(t => t.id !== updated.id) };
                const updatedDest = { ...destClient, tasks: [...(destClient.tasks || []), updated] };

                if (clientsRef.current.some(c => c.id === currentClientId)) {
                    clientsRef.current = clientsRef.current.map(c => {
                        if (c.id === originalClientId) return updatedOrig;
                        if (c.id === currentClientId) return updatedDest;
                        return c;
                    });
                } else {
                    clientsRef.current = clientsRef.current.map(c => c.id === originalClientId ? updatedOrig : c);
                    clientsRef.current.push(updatedDest);
                }

                await updateClient(updatedOrig);
                await updateClient(updatedDest);
                // Reflect the move in local detail state so subsequent saves use the new client
                setDetailTask(prev => prev ? { ...prev, originalClientId: currentClientId } : null);
                return;
            }
        }
        // Modal stays open; live data flows from the realtime clients context
    };

    const handleKanbanDrop = async (clientId: string, taskId: string, targetColumn: string) => {
        const client = clientsRef.current.find(c => c.id === clientId);
        if (!client) return;

        const updatedTasks = client.tasks.map(task => {
            if (task.id !== taskId) return task;
            if (targetColumn === 'done') {
                return { ...task, isCompleted: true };
            }
            return { ...task, isCompleted: false, priority: targetColumn as TaskPriority };
        });

        const updatedClient = { ...client, tasks: updatedTasks };
        clientsRef.current = clientsRef.current.map(c => c.id === clientId ? updatedClient : c);
        await updateClient(updatedClient);
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden h-full flex flex-col">
            {/* Mobile search bar — always visible (filters live in the drawer, opened from the header button) */}
            <div className="sm:hidden px-3 py-2 border-b dark:border-gray-700 flex-shrink-0 flex items-center gap-2">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-gray-400">
                        <Search className="w-4 h-4" />
                    </div>
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={`חיפוש משימה או ${entityLabels.singular}...`}
                        className={`w-full pr-9 ${searchTerm ? 'pl-8' : 'pl-3'} py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-transparent rounded-lg focus:bg-white dark:focus:bg-gray-800 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 text-gray-900 dark:text-white placeholder-gray-400 transition-all duration-200`}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 hover:text-red-500"
                            title="איפוס חיפוש"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                {/* View switcher */}
                <div className="flex p-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
                    <button
                        onClick={() => { setViewMode('list'); localStorage.setItem('tasksViewMode', 'list'); }}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-base-800 shadow-sm text-primary' : 'text-gray-400'}`}
                        title="תצוגת רשימה"
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setViewMode('kanban'); localStorage.setItem('tasksViewMode', 'kanban'); }}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white dark:bg-base-800 shadow-sm text-primary' : 'text-gray-400'}`}
                        title="תצוגת קנבן"
                    >
                        <Columns3 className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <header className="hidden sm:flex p-3 sm:p-4 border-b dark:border-gray-700 flex-shrink-0 items-center min-h-[64px] transition-all gap-3">
                {isMobileSearchOpen ? (
                    <div className="flex-1 flex items-center gap-2 animate-fadeIn w-full">
                        <button
                            onClick={() => { setIsMobileSearchOpen(false); setSearchTerm(''); }}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={`חיפוש משימה או ${entityLabels.singular}...`}
                            autoFocus
                            className="flex-1 bg-gray-100 dark:bg-gray-700 border-transparent focus:border-transparent focus:ring-0 rounded-lg px-4 py-2 text-base w-full"
                        />
                    </div>
                ) : (
                    <>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg sm:text-2xl font-bold whitespace-nowrap truncate">כל המשימות</h1>
                            <p className="hidden sm:block text-gray-600 dark:text-gray-400 mt-1 text-sm">רשימה מרוכזת של כל המשימות.</p>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">

                            {/* View Mode Toggle */}
                            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                                <button
                                    onClick={() => { setViewMode('list'); localStorage.setItem('tasksViewMode', 'list'); }}
                                    className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 transition-colors ${viewMode === 'list' ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    title="תצוגת רשימה"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => { setViewMode('kanban'); localStorage.setItem('tasksViewMode', 'kanban'); }}
                                    className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 transition-colors ${viewMode === 'kanban' ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    title="תצוגת קנבן"
                                >
                                    <Columns3 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Sort by Creation Date Button */}
                            <button
                                onClick={() => {
                                    if (sortField === 'creation') {
                                        setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                                    } else {
                                        setSortField('creation');
                                    }
                                }}
                                className={`hidden sm:flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 w-10 sm:w-auto h-10 sm:h-10 px-0 sm:px-3 rounded-lg transition-colors border ${sortField === 'creation' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border-transparent text-gray-500'}`}
                                title={sortField === 'creation' ? (sortDirection === 'desc' ? 'מיון לפי יצירה: מחדש לישן' : 'מיון לפי יצירה: מישן לחדש') : 'מיון לפי תאריך יצירה'}
                            >
                                <span className="hidden sm:inline text-sm font-medium">
                                    יצירה
                                </span>
                                {/* Desktop: sort direction icon */}
                                {sortDirection === 'desc' ? (
                                    <ArrowDownNarrowWide className="hidden sm:block w-4 h-4" />
                                ) : (
                                    <ArrowUpNarrowWide className="hidden sm:block w-4 h-4" />
                                )}
                                {/* Mobile: Calendar icon */}
                                <Calendar className="sm:hidden w-4 h-4" />
                                {/* Mobile: label + sort arrow */}
                                <span className="sm:hidden flex items-center gap-0.5 text-[9px] leading-none">
                                    <span>יצירה</span>
                                    {sortDirection === 'desc' ? (
                                        <ChevronDown className="w-2 h-2" strokeWidth={3} />
                                    ) : (
                                        <ChevronUp className="w-2 h-2" strokeWidth={3} />
                                    )}
                                </span>
                            </button>

                            {/* Sort by Due Date Button */}
                            <button
                                onClick={() => {
                                    if (sortField === 'dueDate') {
                                        setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                                    } else {
                                        setSortField('dueDate');
                                    }
                                }}
                                className={`hidden sm:flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 w-10 sm:w-auto h-10 sm:h-10 px-0 sm:px-3 rounded-lg transition-colors border ${sortField === 'dueDate' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border-transparent text-gray-500'}`}
                                title={sortField === 'dueDate' ? (sortDirection === 'desc' ? 'מיון לפי תאריך יעד: מחדש לישן' : 'מיון לפי תאריך יעד: מישן לחדש') : 'מיון לפי תאריך יעד'}
                            >
                                <span className="hidden sm:inline text-sm font-medium">
                                    תאריך יעד
                                </span>
                                {/* Desktop: sort direction icon */}
                                {sortDirection === 'desc' ? (
                                    <ArrowDownNarrowWide className="hidden sm:block w-4 h-4" />
                                ) : (
                                    <ArrowUpNarrowWide className="hidden sm:block w-4 h-4" />
                                )}
                                {/* Mobile: Calendar with checkmark icon */}
                                <ClipboardCheck className="sm:hidden w-4 h-4" />
                                {/* Mobile: label + sort arrow */}
                                <span className="sm:hidden flex items-center gap-0.5 text-[9px] leading-none">
                                    <span>יעד</span>
                                    {sortDirection === 'desc' ? (
                                        <ChevronDown className="w-2 h-2" strokeWidth={3} />
                                    ) : (
                                        <ChevronUp className="w-2 h-2" strokeWidth={3} />
                                    )}
                                </span>
                            </button>

                            {/* Client Filter */}
                            <div ref={clientDropdownRef} className="relative hidden sm:block sm:w-auto sm:h-auto sm:min-w-[150px]">
                                <button
                                    type="button"
                                    onClick={() => setIsClientDropdownOpen(o => !o)}
                                    aria-label={`סינון לפי ${entityLabels.singular}`}
                                    className={`w-full h-full sm:h-10 flex items-center justify-center sm:justify-start gap-2 ${selectedClientId !== '' ? 'sm:pl-8' : 'sm:pl-3'} sm:pr-3 sm:py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors`}
                                >
                                    {/* Mobile icon view */}
                                    <span className="flex sm:hidden flex-col items-center justify-center gap-0.5">
                                        <Filter className="w-4 h-4 text-gray-500" />
                                        <span className="text-[9px] leading-none text-gray-500">סינון</span>
                                    </span>
                                    {/* Desktop view */}
                                    <Filter className="hidden sm:block w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span className="hidden sm:block flex-1 text-right truncate">
                                        {selectedClientId === '' ? 'הכל'
                                            : selectedClientId === UNASSOCIATED_CLIENT_ID ? 'ללא שיוך'
                                            : (clients.find(c => c.id === selectedClientId)?.name || 'הכל')}
                                    </span>
                                    {selectedClientId === '' && (
                                        <ChevronDown className="hidden sm:block w-3 h-3 text-gray-400 flex-shrink-0" strokeWidth={3} />
                                    )}
                                </button>

                                {/* Reset button overlay (sibling to avoid nested buttons) */}
                                {selectedClientId !== '' && (
                                    <>
                                        {/* Mobile reset button overlay */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedClientId('');
                                            }}
                                            className="absolute inset-0 sm:hidden flex flex-col items-center justify-center gap-0.5 bg-red-500/10 dark:bg-red-500/20 text-red-500 rounded-lg z-20 cursor-pointer"
                                            title="איפוס סינון"
                                        >
                                            <X className="w-4 h-4" />
                                            <span className="text-[9px] leading-none">אפס</span>
                                        </button>

                                        {/* Desktop reset button on the left (replacing ChevronDown position) */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedClientId('');
                                            }}
                                            className="hidden sm:flex absolute inset-y-0 left-2 items-center justify-center text-gray-400 hover:text-red-500 z-20 cursor-pointer w-6 h-full"
                                            title="איפוס סינון"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                )}

                                {isClientDropdownOpen && (
                                    <div className="fixed sm:absolute z-50 inset-x-3 top-[70px] sm:inset-x-auto sm:top-auto sm:mt-1 sm:right-auto sm:left-0 sm:w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                            <input
                                                type="text"
                                                value={clientFilterSearch}
                                                onChange={(e) => setClientFilterSearch(e.target.value)}
                                                placeholder={entityLabels.searchEntity}
                                                autoFocus
                                                className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-primary focus:border-primary"
                                            />
                                        </div>
                                        <div className="max-h-64 overflow-y-auto py-1">
                                            {(() => {
                                                const lower = clientFilterSearch.toLowerCase();
                                                const matchedClients = clients
                                                    .filter(c => c.id !== UNASSOCIATED_CLIENT_ID)
                                                    .filter(c => !lower || c.name.toLowerCase().includes(lower));
                                                const showAll = !lower || 'הכל'.includes(clientFilterSearch);
                                                const showUnassoc = !lower || 'ללא שיוך'.includes(clientFilterSearch);
                                                const items: React.ReactNode[] = [];
                                                if (showAll) {
                                                    items.push(
                                                        <button key="__all" type="button"
                                                            onClick={() => { setSelectedClientId(''); setIsClientDropdownOpen(false); setClientFilterSearch(''); }}
                                                            className={`w-full text-right px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedClientId === '' ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                                                        >הכל</button>
                                                    );
                                                }
                                                matchedClients.forEach(c => {
                                                    items.push(
                                                        <button key={c.id} type="button"
                                                            onClick={() => { setSelectedClientId(c.id); setIsClientDropdownOpen(false); setClientFilterSearch(''); }}
                                                            className={`w-full text-right px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 truncate ${selectedClientId === c.id ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                                                        >{c.name}</button>
                                                    );
                                                });
                                                if (showUnassoc) {
                                                    items.push(
                                                        <button key="__unassoc" type="button"
                                                            onClick={() => { setSelectedClientId(UNASSOCIATED_CLIENT_ID); setIsClientDropdownOpen(false); setClientFilterSearch(''); }}
                                                            className={`w-full text-right px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedClientId === UNASSOCIATED_CLIENT_ID ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                                                        >ללא שיוך</button>
                                                    );
                                                }
                                                if (items.length === 0) {
                                                    return <div className="px-3 py-2 text-sm text-gray-500 text-center">{entityLabels.noEntities}</div>;
                                                }
                                                return items;
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setIsMobileSearchOpen(true)}
                                className="hidden flex-col items-center justify-center gap-0.5 w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500"
                            >
                                <Search className="w-4 h-4" />
                                <span className="text-[9px] leading-none">חיפוש</span>
                            </button>

                            {/* Desktop Search Input */}
                            <div className="hidden sm:block relative sm:max-w-xs">
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <Search className="w-4 h-4 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="חיפוש..."
                                    className="w-full pl-4 pr-9 py-2 text-sm rounded-lg border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-300 focus:ring-0 focus:border-transparent"
                                />
                            </div>

                            <button
                                onClick={() => {
                                    setNewTaskClientId(selectedClientId || UNASSOCIATED_CLIENT_ID);
                                    setBulkModalOpen(true);
                                }}
                                className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
                                title="צור צ'קליסט מרשימה"
                            >
                                <ClipboardCheck className="w-5 h-5" />
                                <span>רשימה</span>
                            </button>

                            <button
                                onClick={() => {
                                    setNewTaskClientId(selectedClientId || UNASSOCIATED_CLIENT_ID);
                                    setAddModalOpen(true);
                                }}
                                className="hidden sm:flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
                            >
                                <Plus className="w-5 h-5" />
                                <span>הוסף משימה</span>
                            </button>
                        </div>
                    </>
                )}
            </header>

            <button
                onClick={() => {
                    setNewTaskClientId(selectedClientId || UNASSOCIATED_CLIENT_ID);
                    setAddModalOpen(true);
                }}
                className="sm:hidden fixed bottom-6 left-6 z-40 w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                aria-label="הוסף משימה"
            >
                <Plus className="w-8 h-8" />
            </button>

            {viewMode === 'kanban' ? (
                <div className="flex-1 min-h-0 p-4 overflow-hidden">
                    <TaskKanbanBoard
                        filteredTasks={filteredTasks}
                        onCardClick={(taskId, clientId) => setDetailTask({ taskId, originalClientId: clientId, currentClientId: clientId })}
                        onClientClick={onClientClick}
                        onDropToColumn={(clientId, taskId, targetColumn) => handleKanbanDrop(clientId, taskId, targetColumn)}
                    />
                </div>
            ) : (
            <>
            <div className="overflow-auto hidden md:flex flex-col flex-1 min-h-0 p-4 gap-3">
                {filteredTasks.map(({ task, client }) => {
                    const isEditing = editingTaskId === task.id;
                    const isOverdue = isTaskOverdue(task);
                    const isChecklistTask = Array.isArray(task.subtasks) && task.subtasks.length > 0;
                    const subtasksDone = isChecklistTask ? (task.subtasks || []).filter(s => s.isCompleted).length : 0;
                    const subtasksTotal = isChecklistTask ? (task.subtasks || []).length : 0;
                    const borderColor = !task.dueDate ? '#d1d5db' : isOverdue ? '#ef4444' : '#3b82f6';

                    return (
                        <div key={`${client.id}-${task.id}`}
                            className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl shadow-sm border-r-4 transition-all hover:shadow-md flex-shrink-0 ${isEditing ? 'ring-2 ring-primary/30' : ''}`}
                            style={{ borderRightColor: borderColor }}
                        >
                            {/* Top row: checkbox + text + labels */}
                            <div className="flex items-start gap-3 px-5 pt-4 pb-2">
                                <input
                                    type="checkbox"
                                    checked={task.isCompleted}
                                    onChange={() => handleTaskToggle(client.id, task.id)}
                                    onClick={e => e.stopPropagation()}
                                    className={`form-checkbox h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0 ${isChecklistTask ? '' : 'rounded'}`}
                                    style={isChecklistTask ? { borderRadius: '50%' } : undefined}
                                    title={isChecklistTask ? "סימון משימת צ'קליסט" : 'סימון משימה'}
                                />
                                {isChecklistTask && (
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-shrink-0">
                                        <span
                                            className="flex items-center text-blue-500 dark:text-blue-400"
                                            title={`משימת צ'קליסט (${subtasksDone}/${subtasksTotal})`}
                                        >
                                            <ListChecks className="w-4 h-4" />
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
                                <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <input type="text" value={editingTaskText} onChange={e => setEditingTaskText(e.target.value)} className="form-input flex-1 rounded-md dark:bg-gray-800 dark:border-gray-600" autoFocus onKeyDown={e => e.key === 'Enter' && handleEditSave(client.id, task.id)} />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex-1 min-w-0 whitespace-pre-wrap cursor-pointer"
                                                title={task.text}
                                                onClick={() => setDetailTask({ taskId: task.id, originalClientId: client.id, currentClientId: client.id })}
                                            >
                                                <span className={`${task.isCompleted ? 'line-through text-gray-500' : ''}`}>
                                                    <LinkifiedContent content={task.text} />
                                                </span>
                                                {isChecklistTask && (
                                                    <span dir="ltr" className="mr-2 text-xs text-gray-500 dark:text-gray-400" style={{ unicodeBidi: 'isolate' }}>
                                                        ({subtasksDone}/{subtasksTotal})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom row: actions + client + time + date */}
                            <div className="flex items-center justify-between px-5 pb-3 pt-1">
                                <div className="flex items-center gap-4 text-sm">
                                    {/* Client */}
                                    {isEditing ? (
                                        <div ref={editingClientDropdownRef} className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingClientDropdownOpen(o => !o)}
                                                className="form-select text-sm p-1 pr-7 rounded border-gray-300 dark:bg-gray-800 dark:border-gray-600 flex items-center gap-1 min-w-[120px]"
                                            >
                                                <span className="flex-1 text-right truncate">
                                                    {editingTaskClientId === UNASSOCIATED_CLIENT_ID || !editingTaskClientId ? 'ללא שיוך'
                                                        : (clients.find(c => c.id === editingTaskClientId)?.name || 'ללא שיוך')}
                                                </span>
                                                <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" strokeWidth={3} />
                                            </button>
                                            {isEditingClientDropdownOpen && (
                                                <div className="absolute z-50 mt-1 right-0 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                                    <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                                        <input
                                                            type="text"
                                                            value={editingClientSearch}
                                                            onChange={(e) => setEditingClientSearch(e.target.value)}
                                                            placeholder={entityLabels.searchEntity}
                                                            autoFocus
                                                            className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-primary focus:border-primary"
                                                        />
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto py-1">
                                                        {(() => {
                                                            const lower = editingClientSearch.toLowerCase();
                                                            const matchedClients = clients
                                                                .filter(c => c.id !== UNASSOCIATED_CLIENT_ID)
                                                                .filter(c => !lower || c.name.toLowerCase().includes(lower));
                                                            const showUnassoc = !lower || 'ללא שיוך'.includes(editingClientSearch);
                                                            const items: React.ReactNode[] = [];
                                                            if (showUnassoc) {
                                                                items.push(
                                                                    <button key="__unassoc" type="button"
                                                                        onClick={() => { setEditingTaskClientId(UNASSOCIATED_CLIENT_ID); setIsEditingClientDropdownOpen(false); setEditingClientSearch(''); }}
                                                                        className={`w-full text-right px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${editingTaskClientId === UNASSOCIATED_CLIENT_ID || !editingTaskClientId ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                                                                    >ללא שיוך</button>
                                                                );
                                                            }
                                                            matchedClients.forEach(c => {
                                                                items.push(
                                                                    <button key={c.id} type="button"
                                                                        onClick={() => { setEditingTaskClientId(c.id); setIsEditingClientDropdownOpen(false); setEditingClientSearch(''); }}
                                                                        className={`w-full text-right px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 truncate ${editingTaskClientId === c.id ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                                                                    >{c.name}</button>
                                                                );
                                                            });
                                                            if (items.length === 0) {
                                                                return <div className="px-3 py-2 text-sm text-gray-500 text-center">{entityLabels.noEntities}</div>;
                                                            }
                                                            return items;
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        client.id === UNASSOCIATED_CLIENT_ID ? (
                                            <span className="text-gray-400 italic">ללא שיוך</span>
                                        ) : (
                                            <button onClick={() => onClientClick(client)} className="text-blue-500 hover:underline font-medium">{client.name}</button>
                                        )
                                    )}

                                    {/* Due date */}
                                    <div
                                        className="inline-flex items-center gap-1 cursor-pointer group"
                                        onClick={() => {
                                            const input = document.getElementById(`date-desktop-${client.id}-${task.id}`) as HTMLInputElement;
                                            if (input) { try { input.showPicker(); } catch { input.focus(); } }
                                        }}
                                    >
                                        <input
                                            id={`date-desktop-${client.id}-${task.id}`}
                                            type="datetime-local"
                                            value={task.dueDate || ''}
                                            onChange={e => handleInlineDateChange(client.id, task.id, e.target.value)}
                                            className="sr-only"
                                        />
                                        {task.dueDate ? (
                                            <span className="text-xs flex items-center gap-1 text-gray-500 dark:text-gray-400 group-hover:underline">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {formatDueDate(task.dueDate)}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400 flex items-center gap-1 group-hover:text-primary transition-colors">
                                                <Calendar className="w-3.5 h-3.5" />
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {isEditing ? (
                                            <>
                                                <button onClick={() => handleEditSave(client.id, task.id)} className="text-green-500 hover:text-green-600"><Check className="w-5 h-5" /></button>
                                                <button onClick={handleEditCancel} className="text-red-500 hover:text-red-600"><X className="w-5 h-5" /></button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleEditStart(task, client.id)} className="text-blue-500 hover:text-blue-600"><Pencil className="w-5 h-5" /></button>
                                                <button onClick={() => handleDeleteTask(client.id, task.id)} className="text-red-500 hover:text-red-600"><Trash2 className="w-5 h-5" /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
                {filteredTasks.length === 0 && <div className="text-center p-6 text-gray-500">אין משימות להצגה.</div>}
            </div>

            <div className="md:hidden overflow-y-auto flex-1 min-h-0 p-4 space-y-4">
                {filteredTasks.length > 0 ? filteredTasks.map(({ task, client }) => {
                    const isEditing = editingTaskId === task.id;
                    const isOverdue = isTaskOverdue(task);
                    const isChecklistTask = Array.isArray(task.subtasks) && task.subtasks.length > 0;
                    const subtasksDone = isChecklistTask ? (task.subtasks || []).filter(s => s.isCompleted).length : 0;
                    const subtasksTotal = isChecklistTask ? (task.subtasks || []).length : 0;
                    const borderColor = !task.dueDate ? '#d1d5db' : isOverdue ? '#ef4444' : '#3b82f6';

                    return (
                        <div key={`${client.id}-${task.id}`} className={`bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg shadow border-r-4`} style={{ borderRightColor: borderColor }}>
                            {/* Row 1: Client name + Due date (top) */}
                            <div className="flex justify-between items-center gap-2 text-sm mb-3">
                                <button onClick={() => {
                                    if (client.id !== UNASSOCIATED_CLIENT_ID) onClientClick(client);
                                }} className={`font-medium truncate min-w-0 ${client.id === UNASSOCIATED_CLIENT_ID ? 'text-gray-500 cursor-default' : 'text-blue-500 hover:underline'}`}>
                                    {client.id === UNASSOCIATED_CLIENT_ID ? 'ללא שיוך' : client.name}
                                </button>
                                <div
                                    className="inline-flex items-center gap-1 cursor-pointer flex-shrink-0 whitespace-nowrap"
                                    onClick={() => {
                                        const input = document.getElementById(`date-mobile-${client.id}-${task.id}`) as HTMLInputElement;
                                        if (input) { try { input.showPicker(); } catch { input.focus(); } }
                                    }}
                                >
                                    <input
                                        id={`date-mobile-${client.id}-${task.id}`}
                                        type="datetime-local"
                                        value={task.dueDate || ''}
                                        onChange={e => handleInlineDateChange(client.id, task.id, e.target.value)}
                                        className="sr-only"
                                    />
                                    {task.dueDate ? (
                                        <span className="text-xs flex items-center gap-1 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                            {formatDueDate(task.dueDate)}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Row 2: Checkbox + Task text + labels */}
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={task.isCompleted}
                                    onChange={() => handleTaskToggle(client.id, task.id)}
                                    onClick={e => e.stopPropagation()}
                                    className={`form-checkbox h-5 w-5 text-blue-600 mt-1 flex-shrink-0 ${isChecklistTask ? '' : 'rounded'}`}
                                    style={isChecklistTask ? { borderRadius: '50%' } : undefined}
                                    title={isChecklistTask ? "סימון משימת צ'קליסט" : 'סימון משימה'}
                                />
                                {isChecklistTask && (
                                    <div className="flex items-center gap-1.5 mt-1 flex-shrink-0">
                                        <span
                                            className="flex items-center text-blue-500 dark:text-blue-400"
                                            title={`משימת צ'קליסט (${subtasksDone}/${subtasksTotal})`}
                                        >
                                            <ListChecks className="w-4 h-4" />
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
                                <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <input type="text" value={editingTaskText} onChange={e => setEditingTaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave(client.id, task.id)} className="form-input w-full rounded-md border-gray-300 dark:bg-gray-600" autoFocus />
                                            <div className="flex gap-2">
                                                <div ref={editingClientDropdownRef} className="relative flex-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditingClientDropdownOpen(o => !o)}
                                                        className="w-full text-sm p-2 rounded border border-gray-300 dark:bg-gray-600 dark:border-gray-500 flex items-center gap-1"
                                                    >
                                                        <span className="flex-1 text-right truncate">
                                                            {editingTaskClientId === UNASSOCIATED_CLIENT_ID || !editingTaskClientId ? 'ללא שיוך'
                                                                : (clients.find(c => c.id === editingTaskClientId)?.name || 'ללא שיוך')}
                                                        </span>
                                                        <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" strokeWidth={3} />
                                                    </button>
                                                    {isEditingClientDropdownOpen && (
                                                        <div className="absolute z-50 mt-1 right-0 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                                            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                                                <input
                                                                    type="text"
                                                                    value={editingClientSearch}
                                                                    onChange={(e) => setEditingClientSearch(e.target.value)}
                                                                    placeholder={entityLabels.searchEntity}
                                                                    autoFocus
                                                                    className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-primary focus:border-primary"
                                                                />
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto py-1">
                                                                {(() => {
                                                                    const lower = editingClientSearch.toLowerCase();
                                                                    const matchedClients = clients
                                                                        .filter(c => c.id !== UNASSOCIATED_CLIENT_ID)
                                                                        .filter(c => !lower || c.name.toLowerCase().includes(lower));
                                                                    const showUnassoc = !lower || 'ללא שיוך'.includes(editingClientSearch);
                                                                    const items: React.ReactNode[] = [];
                                                                    if (showUnassoc) {
                                                                        items.push(
                                                                            <button key="__unassoc" type="button"
                                                                                onClick={() => { setEditingTaskClientId(UNASSOCIATED_CLIENT_ID); setIsEditingClientDropdownOpen(false); setEditingClientSearch(''); }}
                                                                                className={`w-full text-right px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${editingTaskClientId === UNASSOCIATED_CLIENT_ID || !editingTaskClientId ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                                                                            >ללא שיוך</button>
                                                                        );
                                                                    }
                                                                    matchedClients.forEach(c => {
                                                                        items.push(
                                                                            <button key={c.id} type="button"
                                                                                onClick={() => { setEditingTaskClientId(c.id); setIsEditingClientDropdownOpen(false); setEditingClientSearch(''); }}
                                                                                className={`w-full text-right px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 truncate ${editingTaskClientId === c.id ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                                                                            >{c.name}</button>
                                                                        );
                                                                    });
                                                                    if (items.length === 0) {
                                                                        return <div className="px-3 py-2 text-sm text-gray-500 text-center">{entityLabels.noEntities}</div>;
                                                                    }
                                                                    return items;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <input type="datetime-local" value={editingTaskDueDate} onChange={e => setEditingTaskDueDate(e.target.value)} className="text-sm p-2 rounded border border-gray-300 dark:bg-gray-600 dark:border-gray-500" />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className="min-w-0 break-words whitespace-pre-wrap overflow-hidden cursor-pointer"
                                                title={task.text}
                                                onClick={() => setDetailTask({ taskId: task.id, originalClientId: client.id, currentClientId: client.id })}
                                            >
                                                <span className={`${task.isCompleted ? 'line-through text-gray-500' : ''}`}>
                                                    <LinkifiedContent content={task.text} />
                                                </span>
                                                {isChecklistTask && (
                                                    <span dir="ltr" className="mr-2 text-xs text-gray-500 dark:text-gray-400" style={{ unicodeBidi: 'isolate' }}>
                                                        ({subtasksDone}/{subtasksTotal})
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            {/* Row 3: Actions + Time (bottom) */}
                            <div className="flex justify-between items-center mt-3">
                                <div className="flex items-center gap-3">
                                    {isEditing ? (
                                        <>
                                            <button onClick={() => handleEditSave(client.id, task.id)} className="text-green-500"><Check className="w-5 h-5" /></button>
                                            <button onClick={handleEditCancel} className="text-red-500"><X className="w-5 h-5" /></button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleDeleteTask(client.id, task.id)} className="text-red-500"><Trash2 className="w-5 h-5" /></button>
                                            <button onClick={() => handleEditStart(task, client.id)} className="text-blue-500"><Pencil className="w-5 h-5" /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }) : <p className="text-center p-6 text-gray-500">אין משימות להצגה.</p>}
            </div >
            </>
            )}
            {isBulkModalOpen && (
                <BulkTaskModal
                    onAdd={handleBulkAddTasks}
                    onClose={() => setBulkModalOpen(false)}
                />
            )}
            {detailTask && liveDetailTask && (
                <TaskDetailModal
                    isOpen={true}
                    onClose={() => setDetailTask(null)}
                    task={liveDetailTask}
                    clients={[
                        { id: UNASSOCIATED_CLIENT_ID, name: 'ללא שיוך' },
                        ...clients.filter(c => c.id !== UNASSOCIATED_CLIENT_ID).map(c => ({ id: c.id, name: c.name })),
                    ]}
                    clientId={detailTask.currentClientId}
                    onClientChange={(newClientId) => {
                        setDetailTask(prev => prev ? { ...prev, currentClientId: newClientId } : null);
                    }}
                    onSave={handleDetailSave}
                    userId={effectiveUserId}
                />
            )}
            <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="הוספת משימה חדשה">
                <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">תיאור המשימה</label>
                        <input
                            type="text"
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary dark:bg-base-800 dark:border-gray-600"
                            placeholder="מה צריך לעשות?"
                            autoFocus
                        />
                    </div>
                    <div ref={newTaskClientDropdownRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{entityLabels.assignTo}</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsNewTaskClientDropdownOpen(o => !o)}
                                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary dark:bg-base-800 dark:border-gray-600 flex items-center"
                            >
                                <span className="flex-1 text-right truncate">
                                    {newTaskClientId === UNASSOCIATED_CLIENT_ID || !newTaskClientId ? 'ללא שיוך'
                                        : (clients.find(c => c.id === newTaskClientId)?.name || 'ללא שיוך')}
                                </span>
                                <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0 mr-2" strokeWidth={3} />
                            </button>
                            {isNewTaskClientDropdownOpen && (
                                <div className="absolute z-50 mt-1 right-0 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                    <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                        <input
                                            type="text"
                                            value={newTaskClientSearch}
                                            onChange={(e) => setNewTaskClientSearch(e.target.value)}
                                            placeholder={entityLabels.searchEntity}
                                            autoFocus
                                            className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-primary focus:border-primary"
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto py-1">
                                        {(() => {
                                            const lower = newTaskClientSearch.toLowerCase();
                                            const matchedClients = clients
                                                .filter(c => c.id !== UNASSOCIATED_CLIENT_ID)
                                                .filter(c => !lower || c.name.toLowerCase().includes(lower));
                                            const showUnassoc = !lower || 'ללא שיוך'.includes(newTaskClientSearch);
                                            const items: React.ReactNode[] = [];
                                            if (showUnassoc) {
                                                items.push(
                                                    <button key="__unassoc" type="button"
                                                        onClick={() => { setNewTaskClientId(UNASSOCIATED_CLIENT_ID); setIsNewTaskClientDropdownOpen(false); setNewTaskClientSearch(''); }}
                                                        className={`w-full text-right px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${newTaskClientId === UNASSOCIATED_CLIENT_ID || !newTaskClientId ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                                                    >ללא שיוך</button>
                                                );
                                            }
                                            matchedClients.forEach(c => {
                                                items.push(
                                                    <button key={c.id} type="button"
                                                        onClick={() => { setNewTaskClientId(c.id); setIsNewTaskClientDropdownOpen(false); setNewTaskClientSearch(''); }}
                                                        className={`w-full text-right px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 truncate ${newTaskClientId === c.id ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                                                    >{c.name}</button>
                                                );
                                            });
                                            if (items.length === 0) {
                                                return <div className="px-3 py-2 text-sm text-gray-500 text-center">{entityLabels.noEntities}</div>;
                                            }
                                            return items;
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">תאריך ושעה</label>
                        <input
                            type="datetime-local"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary dark:bg-base-800 dark:border-gray-600"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg">ביטול</button>
                        <button type="submit" disabled={!newTaskText.trim()} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">שמור משימה</button>
                    </div>
                </form>
            </Modal>
            {/* Mobile Sidebar (Drawer) */}
            {isMobileSidebarOpen && (
                <div className="relative z-50 md:hidden animate-in fade-in duration-200" role="dialog" aria-modal="true">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-base-950/40 backdrop-blur-sm transition-opacity"
                        onClick={onCloseMobileSidebar}
                    />

                    {/* Drawer Panel */}
                    <div
                        className="fixed inset-y-0 right-0 w-80 max-w-full bg-white dark:bg-base-900 shadow-2xl flex flex-col p-5 border-l border-gray-100 dark:border-white/5 animate-in slide-in-from-right duration-300"
                        dir="rtl"
                    >
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4 mb-4">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">סינון משימות</h2>
                            <button
                                onClick={onCloseMobileSidebar}
                                className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                aria-label="סגור תפריט"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="flex-1 overflow-y-auto space-y-6 pr-1 pl-1">
                            {/* View Toggle */}
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">תצוגה</span>
                                <div className="flex p-1 bg-gray-100/50 dark:bg-base-950/50 rounded-xl w-full">
                                    <button
                                        type="button"
                                        onClick={() => { setViewMode('list'); localStorage.setItem('tasksViewMode', 'list'); }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-base-800 shadow text-primary font-medium' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                    >
                                        <List className="w-5 h-5" />
                                        <span className="text-xs">רשימה</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setViewMode('kanban'); localStorage.setItem('tasksViewMode', 'kanban'); }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${viewMode === 'kanban' ? 'bg-white dark:bg-base-800 shadow text-primary font-medium' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                    >
                                        <Columns3 className="w-5 h-5" />
                                        <span className="text-xs">קנבן</span>
                                    </button>
                                </div>
                            </div>

                            {/* Sort Field */}
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">מיון לפי</span>
                                <div className="flex p-1 bg-gray-100/50 dark:bg-base-950/50 rounded-xl w-full">
                                    <button
                                        type="button"
                                        onClick={() => setSortField('creation')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${sortField === 'creation' ? 'bg-white dark:bg-base-800 shadow text-primary font-medium' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                    >
                                        <Calendar className="w-4 h-4" />
                                        <span className="text-xs">יצירה</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSortField('dueDate')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${sortField === 'dueDate' ? 'bg-white dark:bg-base-800 shadow text-primary font-medium' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                    >
                                        <ClipboardCheck className="w-4 h-4" />
                                        <span className="text-xs">תאריך יעד</span>
                                    </button>
                                </div>
                            </div>

                            {/* Sort Direction */}
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">סדר מיון</span>
                                <button
                                    onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                                    className="flex items-center justify-between w-full py-2.5 px-4 bg-gray-100/50 dark:bg-base-950/50 hover:bg-gray-200/50 dark:hover:bg-white/5 rounded-xl transition-colors text-right cursor-pointer"
                                >
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {sortDirection === 'desc' ? 'מהחדש לישן' : 'מהישן לחדש'}
                                    </span>
                                    {sortDirection === 'desc' ? (
                                        <SortDesc className="w-5 h-5 text-primary" />
                                    ) : (
                                        <SortAsc className="w-5 h-5 text-primary" />
                                    )}
                                </button>
                            </div>

                            {/* Client Filter */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">סינון לפי {entityLabels.singular}</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                        <Filter className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className={`block w-full pr-10 ${selectedClientId ? 'pl-10' : 'pl-3'} py-2.5 text-sm rounded-xl border-transparent bg-gray-100/50 dark:bg-base-950/50 dark:text-gray-300 appearance-none focus:ring-0 focus:border-transparent cursor-pointer`}
                                    >
                                        <option value="">הכל</option>
                                        {clients.filter(c => c.id !== UNASSOCIATED_CLIENT_ID).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                        <option value={UNASSOCIATED_CLIENT_ID}>ללא שיוך</option>
                                    </select>
                                    {selectedClientId && (
                                        <button
                                            onClick={() => setSelectedClientId('')}
                                            className="absolute inset-y-0 left-3 flex items-center justify-center text-gray-400 hover:text-red-500 z-20 cursor-pointer"
                                            title="איפוס סינון"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
