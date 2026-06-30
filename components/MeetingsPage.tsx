import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Client, Meeting } from '../types';
import { ChevronRight, X, Search, Calendar, Check, Clock, Pencil, Trash2, List, Columns3 } from 'lucide-react';
import { MeetingKanbanBoard } from './MeetingKanbanBoard';
import { useConfirm } from './ConfirmDialog';

export const MeetingsPage: React.FC<{ onClientClick: (client: Client) => void }> = ({ onClientClick }) => {
    const { meetings, clients, updateMeeting, deleteMeeting, entityLabels } = useAppContext();
    const confirm = useConfirm();

    const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
        const saved = localStorage.getItem('meetingsViewMode');
        return saved === 'kanban' ? 'kanban' : 'list';
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [filterTab, setFilterTab] = useState<'all' | 'upcoming' | 'past'>('upcoming');
    const [filterDate, setFilterDate] = useState<string>('');

    const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
    const [editClientId, setEditClientId] = useState<string>('');
    const [editTitle, setEditTitle] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editStartTime, setEditStartTime] = useState('');
    const [editEndTime, setEditEndTime] = useState('');
    const [editDescription, setEditDescription] = useState('');

    const getClientName = (clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        return client ? client.name : entityLabels.notFound;
    };

    const handleEditStart = (meeting: Meeting) => {
        setEditingMeetingId(meeting.id);
        setEditTitle(meeting.title);
        setEditClientId(meeting.clientId);
        setEditDescription(meeting.description || '');

        const start = new Date(meeting.startTime);
        const yyyy = start.getFullYear();
        const mm = String(start.getMonth() + 1).padStart(2, '0');
        const dd = String(start.getDate()).padStart(2, '0');
        setEditDate(`${yyyy}-${mm}-${dd}`);

        setEditStartTime(start.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));

        const end = new Date(meeting.endTime);
        setEditEndTime(end.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    };

    const handleEditSave = async (meetingId: string) => {
        if (!editTitle || !editDate || !editStartTime) return;

        const startDateTime = new Date(`${editDate}T${editStartTime}`).toISOString();
        let endDateTime;
        if (editEndTime) {
            endDateTime = new Date(`${editDate}T${editEndTime}`).toISOString();
        } else {
            endDateTime = new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString();
        }

        try {
            await updateMeeting({
                id: meetingId,
                title: editTitle,
                clientId: editClientId,
                startTime: startDateTime,
                endTime: endDateTime,
                description: editDescription
            } as Meeting);
            setEditingMeetingId(null);
        } catch (error) {
            console.error("Error updating meeting", error);
            alert("אירעה שגיאה בעדכון הפגישה");
        }
    };

    const handleEditCancel = () => {
        setEditingMeetingId(null);
    };

    const handleMeetingDateChange = async (meetingId: string, newDate: Date) => {
        const meeting = meetings.find(m => m.id === meetingId);
        if (!meeting) return;

        const oldStart = new Date(meeting.startTime);
        const oldEnd = new Date(meeting.endTime);

        // Keep the same time, change the date
        const newStart = new Date(newDate);
        newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds());

        const newEnd = new Date(newDate);
        newEnd.setHours(oldEnd.getHours(), oldEnd.getMinutes(), oldEnd.getSeconds());

        try {
            await updateMeeting({
                ...meeting,
                startTime: newStart.toISOString(),
                endTime: newEnd.toISOString(),
            });
        } catch (error) {
            console.error("Error updating meeting date", error);
        }
    };

    const sortedAndFilteredMeetings = useMemo(() => {
        let result = [...meetings];

        // 1. Search Filter
        if (searchTerm.trim()) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(meeting => {
                const title = meeting.title.toLowerCase();
                const desc = (meeting.description || '').toLowerCase();
                const clientName = getClientName(meeting.clientId).toLowerCase();
                return title.includes(lowerTerm) || desc.includes(lowerTerm) || clientName.includes(lowerTerm);
            });
        }

        // 2. Tab Filter
        const now = new Date();
        if (filterTab === 'upcoming') {
            result = result.filter(m => new Date(m.startTime) >= now);
        } else if (filterTab === 'past') {
            result = result.filter(m => new Date(m.startTime) < now);
        }

        // 3. Date Filter
        if (filterDate) {
            result = result.filter(m => {
                const meetDate = new Date(m.startTime);
                const meetDateStr = `${meetDate.getFullYear()}-${String(meetDate.getMonth() + 1).padStart(2, '0')}-${String(meetDate.getDate()).padStart(2, '0')}`;
                return meetDateStr === filterDate;
            });
        }

        // 4. Sort (Earliest to Latest for upcoming, Latest to earliest for past?)
        // Standard sort: Earliest to Latest
        result.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        if (filterTab === 'past') {
            result.reverse(); // Newest past meetings first
        }

        return result;
    }, [meetings, searchTerm, filterTab, filterDate, clients]);


    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden h-full flex flex-col">
            <header className="px-2 sm:px-4 py-3 sm:py-4 border-b dark:border-gray-700 flex-shrink-0 flex items-center min-h-[64px] transition-all gap-2 sm:gap-3">
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
                            placeholder={`חיפוש משימה, ${entityLabels.singular} או תגית...`}
                            autoFocus
                            className="flex-1 bg-gray-100 dark:bg-gray-700 border-transparent focus:border-transparent focus:ring-0 rounded-lg px-4 py-2 text-base w-full min-w-[150px]"
                        />
                    </div>
                ) : (
                    <>
                        <div className="hidden sm:block flex-1 min-w-0">
                            <h1 className="text-lg sm:text-2xl font-bold whitespace-nowrap truncate">יומן</h1>
                            <p className="hidden sm:block text-gray-600 dark:text-gray-400 mt-1 text-sm">רשימה מרוכזת של כל האירועים ביומן.</p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-center w-full sm:w-auto gap-1.5 sm:gap-3 flex-nowrap min-w-0">

                            {/* View Mode Toggle (desktop only) */}
                            <div className="hidden sm:flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                                <button
                                    onClick={() => { setViewMode('list'); localStorage.setItem('meetingsViewMode', 'list'); }}
                                    className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 transition-colors ${viewMode === 'list' ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    title="תצוגת רשימה"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => { setViewMode('kanban'); localStorage.setItem('meetingsViewMode', 'kanban'); }}
                                    className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 transition-colors ${viewMode === 'kanban' ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    title="תצוגת שבועית"
                                >
                                    <Columns3 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Tabs: All, Upcoming, Past (hidden in kanban mode on desktop, always visible on mobile) */}
                            <div className={`bg-gray-100 dark:bg-gray-700 p-1 rounded-lg shrink-0 h-10 items-center flex ${viewMode === 'kanban' ? 'sm:hidden' : ''}`}>
                                <button
                                    onClick={() => setFilterTab('upcoming')}
                                    className={`px-2 sm:px-3 h-full text-xs sm:text-sm font-medium rounded-md transition-shadow whitespace-nowrap ${filterTab === 'upcoming' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-200'}`}
                                >
                                    עתידי
                                </button>
                                <button
                                    onClick={() => setFilterTab('past')}
                                    className={`px-2 sm:px-3 h-full text-xs sm:text-sm font-medium rounded-md transition-shadow whitespace-nowrap ${filterTab === 'past' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-200'}`}
                                >
                                    עבר
                                </button>
                                <button
                                    onClick={() => setFilterTab('all')}
                                    className={`px-2 sm:px-3 h-full text-xs sm:text-sm font-medium rounded-md transition-shadow whitespace-nowrap ${filterTab === 'all' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-200'}`}
                                >
                                    הכל
                                </button>
                            </div>

                            {/* Dropdown for Date filter (hidden in kanban mode on desktop, always visible on mobile) */}
                            <div className={`relative flex-1 sm:flex-none shrink-0 items-center bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 hover:dark:bg-gray-600 transition-colors flex ${viewMode === 'kanban' ? 'sm:hidden' : ''}`}>
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={e => setFilterDate(e.target.value)}
                                    className="block w-full h-10 px-2 sm:px-3 bg-transparent border-transparent focus:border-transparent focus:ring-0 text-gray-500 dark:text-gray-300 text-sm cursor-pointer"
                                />
                                {filterDate && (
                                    <button
                                        onClick={() => setFilterDate('')}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md flex items-center justify-center h-5 w-5 hover:bg-red-600 transition-colors tooltip tooltip-right"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>


                            {/* Mobile Search Open */}
                            <button
                                onClick={() => setIsMobileSearchOpen(true)}
                                className="sm:hidden flex items-center justify-center w-10 h-10 shrink-0 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500"
                            >
                                <Search className="w-5 h-5" />
                            </button>

                            {/* Desktop Search Input */}
                            <div className="hidden sm:block relative sm:w-48 shrink-0">
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

                        </div>
                    </>
                )}
            </header>

            {/* Kanban view - desktop only */}
            {viewMode === 'kanban' && (
                <div className="hidden sm:flex sm:flex-col flex-1 min-h-0 p-4 overflow-hidden">
                    <MeetingKanbanBoard
                        meetings={meetings}
                        onClientClick={onClientClick}
                        onEditClick={handleEditStart}
                        onMeetingDateChange={handleMeetingDateChange}
                    />
                </div>
            )}

            {/* List view - always on mobile, or when list mode selected on desktop */}
            <div className={`overflow-auto flex flex-col flex-1 min-h-0 p-4 gap-3 ${viewMode === 'kanban' ? 'sm:hidden' : ''}`}>
                {sortedAndFilteredMeetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-gray-50 dark:bg-base-900 rounded-2xl border border-dashed border-gray-300 dark:border-white/10 mt-4">
                        <Calendar className="w-16 h-16 text-gray-400 mb-4" strokeWidth={1} />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">אין אירועים להצגה</h3>
                        <p className="text-gray-500 mt-2 text-center max-w-md">נסה לשנות את מסנני החיפוש או הטאבים.</p>
                    </div>
                ) : (
                    sortedAndFilteredMeetings.map(meeting => {
                        const isEditing = editingMeetingId === meeting.id;
                        const isPast = new Date(meeting.startTime) < new Date();
                        const borderColor = isPast ? '#d1d5db' : '#3b82f6';

                        return (
                            <div key={meeting.id}
                                className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl shadow-sm border-r-4 overflow-hidden transition-all hover:shadow-md flex-shrink-0 ${isEditing ? 'ring-2 ring-primary/30' : ''}`}
                                style={{ borderRightColor: borderColor }}
                            >
                                <div className="flex flex-col md:flex-row gap-4 p-4 md:items-center">
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <div className="space-y-3 pb-2">
                                                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="form-input w-full rounded-md border-gray-300 dark:bg-gray-600 dark:text-white" placeholder="כותרת הפגישה" />

                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                    <select value={editClientId} onChange={e => setEditClientId(e.target.value)} className="form-select text-sm p-2 rounded border-gray-300 dark:bg-gray-600 dark:text-white">
                                                        {clients.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="form-input text-sm p-2 rounded border-gray-300 dark:bg-gray-600 dark:text-white" />
                                                    <input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className="form-input text-sm p-2 rounded border-gray-300 dark:bg-gray-600 dark:text-white" title="שעת התחלה" />
                                                    <input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} className="form-input text-sm p-2 rounded border-gray-300 dark:bg-gray-600 dark:text-white" title="שעת סיום" />
                                                </div>

                                                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="תיאור" className="form-input w-full rounded-md border-gray-300 dark:bg-gray-600 dark:text-white text-sm" rows={2}></textarea>
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate mb-1">
                                                    <span className={isPast ? 'text-gray-500' : ''}>{meeting.title}</span>
                                                </h3>
                                                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 cursor-pointer hover:underline inline-block" onClick={() => {
                                                    const client = clients.find(c => c.id === meeting.clientId);
                                                    if (client) onClientClick(client);
                                                }}>
                                                    {entityLabels.singular}: <span className="font-semibold text-primary">{getClientName(meeting.clientId)}</span>
                                                </div>

                                                {meeting.description && (
                                                    <p className={`text-sm ${isPast ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'} bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-600 mt-2`}>{meeting.description}</p>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Action and Time Container */}
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 justify-end self-end md:self-stretch">
                                            <button onClick={() => handleEditSave(meeting.id)} className="text-green-500 hover:text-green-600 p-2"><Check className="w-5 h-5" /></button>
                                            <button onClick={handleEditCancel} className="text-red-500 hover:text-red-600 p-2"><X className="w-5 h-5" /></button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-row items-center justify-between w-full md:w-auto gap-4 border-t md:border-t-0 border-gray-200 dark:border-gray-600 pt-3 md:pt-0 pl-1">
                                            <div className="flex items-center gap-3 md:gap-4 text-[11px] sm:text-xs md:text-sm whitespace-nowrap overflow-x-auto">
                                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                                    <span dir="ltr">{new Date(meeting.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(meeting.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                </div>
                                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                                    <span>{new Date(meeting.startTime).toLocaleDateString('he-IL')}</span>
                                                    <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleEditStart(meeting)} className="text-blue-500 hover:text-blue-600 p-1.5"><Pencil className="w-5 h-5" /></button>
                                                <button onClick={async () => {
                                                    if (await confirm({ title: 'מחיקת פגישה', message: 'האם אתה בטוח שברצונך למחוק פגישה זו? יוביל למחיקתה גם ביומן גוגל אם מקושר.' })) {
                                                        deleteMeeting(meeting.id);
                                                    }
                                                }} className="text-red-500 hover:text-red-700 p-1.5" title="מחק פגישה">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    );
};
