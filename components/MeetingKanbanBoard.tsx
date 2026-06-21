
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Client, Meeting } from '../types';
import { useAppContext } from '../context/AppContext';
import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface DayColumnDef {
    id: DayOfWeek;
    name: string;
    color: string;
}

const DAY_COLUMNS: DayColumnDef[] = [
    { id: 0, name: 'יום ראשון', color: '#3b82f6' },
    { id: 1, name: 'יום שני', color: '#8b5cf6' },
    { id: 2, name: 'יום שלישי', color: '#ec4899' },
    { id: 3, name: 'יום רביעי', color: '#f59e0b' },
    { id: 4, name: 'יום חמישי', color: '#10b981' },
    { id: 5, name: 'יום שישי', color: '#6366f1' },
    { id: 6, name: 'יום שבת', color: '#64748b' },
];

const isColorLight = (hexColor: string) => {
    const color = (hexColor.charAt(0) === '#') ? hexColor.substring(1, 7) : hexColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186);
};

const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sunday
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getWeekEnd = (weekStart: Date): Date => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
};

const formatHebrewDate = (date: Date): string => {
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
};

// ─── Meeting Card ──────────────────────────────────────
const MeetingKanbanCard: React.FC<{
    meeting: Meeting;
    client?: Client;
    isPast: boolean;
    onClientClick: (client: Client) => void;
    onEditClick: (meeting: Meeting) => void;
}> = ({ meeting, client, isPast, onClientClick, onEditClick }) => {
    const { entityLabels } = useAppContext();
    const borderColor = isPast ? '#d1d5db' : '#3b82f6';

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('meetingId', meeting.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onClick={() => onEditClick(meeting)}
            className={`group bg-white dark:bg-base-900 p-3 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border border-gray-100 dark:border-white/5 cursor-grab active:cursor-grabbing border-r-4 ${isPast ? 'opacity-70' : ''}`}
            style={{ borderRightColor: borderColor }}
        >
            {/* Title */}
            <div className={`text-sm font-bold mb-1.5 line-clamp-2 ${isPast ? 'text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                {meeting.title}
            </div>

            {/* Time */}
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <Clock className="w-3 h-3" />
                <span dir="ltr">
                    {new Date(meeting.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(meeting.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            {/* Client */}
            {client && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClientClick(client);
                    }}
                    className="text-xs text-blue-500 hover:underline truncate block max-w-full"
                >
                    {client.name}
                </button>
            )}

            {/* Description preview */}
            {meeting.description && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 line-clamp-2">{meeting.description}</p>
            )}
        </div>
    );
};

// ─── Day Column ────────────────────────────────────────
const DayColumn: React.FC<{
    column: DayColumnDef;
    date: Date;
    isToday: boolean;
    meetings: { meeting: Meeting; client?: Client }[];
    onClientClick: (client: Client) => void;
    onEditClick: (meeting: Meeting) => void;
    columnStyle: React.CSSProperties;
    onDrop: (meetingId: string, targetDate: Date) => void;
}> = ({ column, date, isToday, meetings, onClientClick, onEditClick, columnStyle, onDrop }) => {
    const [isOver, setIsOver] = useState(false);
    const now = new Date();

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(true);
    };
    const handleDragLeave = () => setIsOver(false);
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const meetingId = e.dataTransfer.getData('meetingId');
        if (meetingId) {
            onDrop(meetingId, date);
        }
        setIsOver(false);
    };

    // Sort meetings by start time
    const sortedMeetings = useMemo(() => {
        return [...meetings].sort((a, b) => new Date(a.meeting.startTime).getTime() - new Date(b.meeting.startTime).getTime());
    }, [meetings]);

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col snap-center py-2 px-[5px] rounded-xl transition-all duration-300 overflow-hidden ${isOver ? 'ring-2 ring-primary/30 bg-primary/5' : ''} ${isToday ? 'ring-2 ring-green-400/50 bg-green-50/30 dark:bg-green-900/10' : ''}`}
            style={columnStyle}
        >
            {/* Column Header */}
            <div className="flex flex-col items-center gap-1 mb-3 px-0.5">
                <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold shadow-sm ${isColorLight(column.color) ? 'text-gray-800' : 'text-white'}`}
                    style={{ backgroundColor: column.color }}
                >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${isColorLight(column.color) ? 'bg-gray-800/70' : 'bg-white/90'}`} />
                    <span className="tracking-tight">{column.name}</span>
                </div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {formatHebrewDate(date)}
                </span>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{sortedMeetings.length > 0 ? sortedMeetings.length : ''}</span>
            </div>

            {/* Meeting Cards */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pb-3 hide-scrollbar px-0">
                {sortedMeetings.length === 0 ? (
                    <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
                        אין אירועים
                    </div>
                ) : (
                    sortedMeetings.map(({ meeting, client }) => {
                        const isPast = new Date(meeting.startTime) < now;
                        return (
                            <MeetingKanbanCard
                                key={meeting.id}
                                meeting={meeting}
                                client={client}
                                isPast={isPast}
                                onClientClick={onClientClick}
                                onEditClick={onEditClick}
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
};

// ─── Board ─────────────────────────────────────────────
export const MeetingKanbanBoard: React.FC<{
    meetings: Meeting[];
    onClientClick: (client: Client) => void;
    onEditClick: (meeting: Meeting) => void;
    onMeetingDateChange: (meetingId: string, newDate: Date) => void;
}> = ({ meetings, onClientClick, onEditClick, onMeetingDateChange }) => {
    const { clients } = useAppContext();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const columnStyle: React.CSSProperties = isMobile
        ? { flex: '0 0 100%' }
        : { flex: '1 0 0%', minWidth: 0 };

    const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    // Group meetings by day of week for current week
    const meetingsByDay = useMemo(() => {
        const result: Record<number, { meeting: Meeting; client?: Client }[]> = {};
        for (let i = 0; i < 7; i++) result[i] = [];

        meetings.forEach(meeting => {
            const meetingDate = new Date(meeting.startTime);
            if (meetingDate >= weekStart && meetingDate <= weekEnd) {
                const dayOfWeek = meetingDate.getDay();
                const client = clients.find(c => c.id === meeting.clientId);
                result[dayOfWeek].push({ meeting, client });
            }
        });
        return result;
    }, [meetings, weekStart, weekEnd, clients]);

    const navigateWeek = (direction: 'prev' | 'next') => {
        setWeekStart(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
            return d;
        });
    };

    const goToThisWeek = () => {
        setWeekStart(getWeekStart(new Date()));
    };

    const handleDrop = (meetingId: string, targetDate: Date) => {
        onMeetingDateChange(meetingId, targetDate);
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

    const weekLabel = useMemo(() => {
        const monthYear = weekStart.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
        return monthYear;
    }, [weekStart]);

    const isCurrentWeek = useMemo(() => {
        const currentWeekStart = getWeekStart(new Date());
        return weekStart.getTime() === currentWeekStart.getTime();
    }, [weekStart]);

    return (
        <div className="h-full flex flex-col">
            {/* Week Navigation */}
            <div className="flex items-center justify-center gap-3 mb-3 flex-shrink-0">
                <button
                    onClick={() => navigateWeek('next')}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
                <div className="text-center min-w-[140px]">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{weekLabel}</span>
                </div>
                <button
                    onClick={() => navigateWeek('prev')}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                {!isCurrentWeek && (
                    <button
                        onClick={goToThisWeek}
                        className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                    >
                        השבוע
                    </button>
                )}
            </div>

            {/* Board */}
            <div className="flex-1 min-h-0 relative">
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
                    {DAY_COLUMNS.map(column => {
                        const columnDate = new Date(weekStart);
                        columnDate.setDate(columnDate.getDate() + column.id);
                        const isToday = columnDate.getTime() === today.getTime();

                        return (
                            <DayColumn
                                key={column.id}
                                column={column}
                                date={columnDate}
                                isToday={isToday}
                                meetings={meetingsByDay[column.id]}
                                onClientClick={onClientClick}
                                onEditClick={onEditClick}
                                columnStyle={columnStyle}
                                onDrop={handleDrop}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
