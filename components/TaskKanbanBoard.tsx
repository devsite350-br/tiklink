
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Client, Task, TaskPriority, UNASSOCIATED_CLIENT_ID } from '../types';
import { useAppContext } from '../context/AppContext';
import LinkifiedContent from './LinkifiedContent';
import { Calendar, ListChecks, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

const isColorLight = (hexColor: string) => {
    const color = (hexColor.charAt(0) === '#') ? hexColor.substring(1, 7) : hexColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186);
};

type KanbanColumn = 'none' | 'medium' | 'high' | 'done';

interface KanbanColumnDef {
    id: KanbanColumn;
    name: string;
    color: string;
}

const KANBAN_COLUMNS: KanbanColumnDef[] = [
    { id: 'medium', name: 'עדיפות רגילה', color: '#7E58DD' },
    { id: 'high', name: 'עדיפות גבוהה', color: '#4382DF' },
    { id: 'none', name: 'ללא עדיפות', color: '#9ca3af' },
    { id: 'done', name: 'הושלם', color: '#22c55e' },
];

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

const getTaskColumn = (task: Task): KanbanColumn => {
    if (task.isCompleted) return 'done';
    return (task.priority as KanbanColumn) || 'medium';
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

// ─── Task Card ──────────────────────────────────────────
const TaskKanbanCard: React.FC<{
    task: Task;
    client: Client;
    onCardClick: () => void;
    onClientClick: (client: Client) => void;
}> = ({ task, client, onCardClick, onClientClick }) => {
    const { effectiveUserId } = useAppContext();
    const isChecklistTask = Array.isArray(task.subtasks) && task.subtasks.length > 0;
    const subtasksDone = isChecklistTask ? (task.subtasks || []).filter(s => s.isCompleted).length : 0;
    const subtasksTotal = isChecklistTask ? (task.subtasks || []).length : 0;
    const overdue = isTaskOverdue(task);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.setData('clientId', client.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    // Same border logic as list view: gray=no date, red=overdue, blue=has date
    const borderColor = !task.dueDate ? '#d1d5db' : overdue ? '#ef4444' : '#3b82f6';

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onClick={onCardClick}
            className="group bg-white dark:bg-base-900 p-3 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border border-gray-100 dark:border-white/5 cursor-grab active:cursor-grabbing border-r-4"
            style={{ borderRightColor: borderColor }}
        >
            {/* Task text */}
            <div className="text-sm text-gray-800 dark:text-gray-200 mb-2 line-clamp-3">
                <span className={task.isCompleted ? 'line-through text-gray-400' : ''}>
                    <LinkifiedContent content={task.text} />
                </span>
                {isChecklistTask && (
                    <span dir="ltr" className="mr-1 text-xs text-gray-500 dark:text-gray-400" style={{ unicodeBidi: 'isolate' }}>
                        ({subtasksDone}/{subtasksTotal})
                    </span>
                )}
            </div>

            {/* Footer: client + date + icons */}
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (client.id !== UNASSOCIATED_CLIENT_ID) onClientClick(client);
                    }}
                    className={`truncate min-w-0 ${client.id === UNASSOCIATED_CLIENT_ID ? 'text-gray-400 cursor-default' : 'text-blue-500 hover:underline'}`}
                >
                    {client.id === UNASSOCIATED_CLIENT_ID ? 'ללא שיוך' : client.name}
                </button>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {isChecklistTask && (
                        <span className="flex items-center text-blue-500 dark:text-blue-400">
                            <ListChecks className="w-3.5 h-3.5" />
                        </span>
                    )}
                    {isChecklistTask && task.shareToken && (
                        <a
                            href={`${window.location.origin}/task/${effectiveUserId}/${task.shareToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-gray-400 hover:text-blue-500 transition-colors"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )}
                    {task.dueDate && (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                            <Calendar className="w-3 h-3" />
                            {formatDueDate(task.dueDate)}
                        </span>
                    )}
                </div>
            </div>

            {/* Checklist progress bar */}
            {isChecklistTask && subtasksTotal > 0 && (
                <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${(subtasksDone / subtasksTotal) * 100}%` }}
                    />
                </div>
            )}
        </div>
    );
};

// ─── Column ─────────────────────────────────────────────
const KanbanStatusColumn: React.FC<{
    column: KanbanColumnDef;
    tasks: { task: Task; client: Client }[];
    onCardClick: (taskId: string, clientId: string) => void;
    onClientClick: (client: Client) => void;
    onDrop: (taskId: string, clientId: string, targetColumn: KanbanColumn) => void;
    columnStyle: React.CSSProperties;
}> = ({ column, tasks, onCardClick, onClientClick, onDrop, columnStyle }) => {
    const [isOver, setIsOver] = useState(false);
    const textColor = isColorLight(column.color) ? 'text-gray-800' : 'text-white';
    const dotBg = isColorLight(column.color) ? 'bg-gray-800/70' : 'bg-white/90';

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(true);
    };
    const handleDragLeave = () => setIsOver(false);
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        const clientId = e.dataTransfer.getData('clientId');
        if (taskId && clientId) {
            onDrop(taskId, clientId, column.id);
        }
        setIsOver(false);
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col snap-center py-2 px-[5px] rounded-xl transition-all duration-300 overflow-hidden ${isOver ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
            style={columnStyle}
        >
            <div className="flex items-center gap-2 mb-3 px-0.5">
                <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold shadow-sm ${textColor}`}
                    style={{ backgroundColor: column.color }}
                >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotBg}`} />
                    <span className="tracking-tight">{column.name}</span>
                </div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{tasks.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pb-3 hide-scrollbar px-0">
                {tasks.map(({ task, client }) => (
                    <TaskKanbanCard
                        key={`${client.id}-${task.id}`}
                        task={task}
                        client={client}
                        onCardClick={() => onCardClick(task.id, client.id)}
                        onClientClick={onClientClick}
                    />
                ))}
            </div>
        </div>
    );
};

// ─── Board ──────────────────────────────────────────────
export const TaskKanbanBoard: React.FC<{
    filteredTasks: { task: Task; client: Client }[];
    onCardClick: (taskId: string, clientId: string) => void;
    onClientClick: (client: Client) => void;
    onDropToColumn: (clientId: string, taskId: string, targetColumn: KanbanColumn) => void;
}> = ({ filteredTasks, onCardClick, onClientClick, onDropToColumn }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const columnStyle: React.CSSProperties = isMobile
        ? { flex: '0 0 100%' }
        : { flex: '1 0 0%', minWidth: 0 };

    const tasksByColumn = useMemo(() => {
        const result: Record<KanbanColumn, { task: Task; client: Client }[]> = {
            none: [],
            medium: [],
            high: [],
            done: [],
        };
        filteredTasks.forEach(item => {
            const col = getTaskColumn(item.task);
            result[col].push(item);
        });
        return result;
    }, [filteredTasks]);

    const handleDrop = (taskId: string, clientId: string, targetColumn: KanbanColumn) => {
        const item = filteredTasks.find(i => i.task.id === taskId && i.client.id === clientId);
        if (!item) return;

        const currentColumn = getTaskColumn(item.task);
        if (currentColumn === targetColumn) return;

        onDropToColumn(clientId, taskId, targetColumn);
    };

    const updateScrollButtons = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const isRtl = getComputedStyle(el).direction === 'rtl';
        if (isRtl) {
            setCanScrollRight(Math.abs(el.scrollLeft) > 5);
            setCanScrollLeft(el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft) > 5);
        } else {
            setCanScrollLeft(el.scrollLeft > 5);
            setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 5);
        }
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !isMobile) {
            setCanScrollLeft(false);
            setCanScrollRight(false);
            return;
        }
        updateScrollButtons();
        el.addEventListener('scroll', updateScrollButtons, { passive: true });
        const observer = new ResizeObserver(updateScrollButtons);
        observer.observe(el);
        return () => {
            el.removeEventListener('scroll', updateScrollButtons);
            observer.disconnect();
        };
    }, [isMobile, updateScrollButtons]);

    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const scrollAmount = el.clientWidth;
        const amount = direction === 'left' ? -scrollAmount : scrollAmount;
        el.scrollBy({ left: amount, behavior: 'smooth' });
    };

    return (
        <div className="h-full relative">
            {isMobile && canScrollRight && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute -right-1 top-2 -translate-y-1/2 z-30 flex items-center justify-center w-4 h-4 rounded-full bg-white/80 dark:bg-base-800/90 shadow border border-gray-200/40 dark:border-white/10 text-gray-400 hover:text-primary transition-all cursor-pointer"
                    aria-label="גלול ימינה"
                >
                    <ChevronRight className="w-2 h-2" />
                </button>
            )}
            {isMobile && canScrollLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute -left-1 top-2 -translate-y-1/2 z-30 flex items-center justify-center w-4 h-4 rounded-full bg-white/80 dark:bg-base-800/90 shadow border border-gray-200/40 dark:border-white/10 text-gray-400 hover:text-primary transition-all cursor-pointer"
                    aria-label="גלול שמאלה"
                >
                    <ChevronLeft className="w-2 h-2" />
                </button>
            )}
            <div
                ref={scrollRef}
                className="h-full flex flex-row gap-0 overflow-x-auto pb-4 hide-scrollbar snap-x snap-mandatory"
            >
                {KANBAN_COLUMNS.map(column => (
                    <KanbanStatusColumn
                        key={column.id}
                        column={column}
                        tasks={tasksByColumn[column.id]}
                        onCardClick={onCardClick}
                        onClientClick={onClientClick}
                        onDrop={handleDrop}
                        columnStyle={columnStyle}
                    />
                ))}
            </div>
        </div>
    );
};
