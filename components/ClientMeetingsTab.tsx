import React, { useEffect, useState } from 'react';
import { Plus, Check, X, Calendar, Clock, Pencil, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Client, Meeting } from '../types';
import { auth } from '../firebaseConfig';
import { useConfirm } from './ConfirmDialog';

interface ClientMeetingsTabProps {
    client: Client | null;
    prefill?: { text: string; nonce: number } | null;
}

export const ClientMeetingsTab: React.FC<ClientMeetingsTabProps> = ({ client, prefill }) => {
    const { meetings, addMeeting, updateMeeting, deleteMeeting, entityLabels } = useAppContext();
    const confirm = useConfirm();
    const [isAdding, setIsAdding] = useState(false);

    // Add form state
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (!prefill) return;
        const text = prefill.text;
        const firstLine = text.split('\n')[0].trim();
        const draftTitle = firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
        setIsAdding(true);
        setTitle(draftTitle);
        setDescription(text);
    }, [prefill?.nonce]);

    // Edit form state
    const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editStartTime, setEditStartTime] = useState('');
    const [editEndTime, setEditEndTime] = useState('');
    const [editDescription, setEditDescription] = useState('');


    if (!client) {
        return <div className="p-4 text-center text-gray-500">{`יש לשמור את ${entityLabels.theSingular} לפני הוספת אירועים ליומן.`}</div>;
    }

    const clientMeetings = meetings.filter(m => m.clientId === client.id).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!date || !startTime || !title) return;

        const startDateTime = new Date(`${date}T${startTime}`);
        let endDateTime;
        if (endTime) {
            endDateTime = new Date(`${date}T${endTime}`);
        } else {
            // Default to 1 hour after start
            endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
        }

        try {
            const user = auth.currentUser;
            await addMeeting({
                clientId: client.id,
                title,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                description,
                createdAt: Date.now(),
                authorId: user?.uid || '',
                authorName: user?.displayName || user?.email?.split('@')[0] || '',
                authorPhotoUrl: user?.photoURL || '',
            });
            setIsAdding(false);
            setTitle('');
            setDate('');
            setStartTime('');
            setEndTime('');
            setDescription('');
        } catch (error) {
            console.error("Error adding meeting", error);
            alert("אירעה שגיאה בהוספת הפגישה");
        }
    };

    const handleEditStart = (meeting: Meeting) => {
        setEditingMeetingId(meeting.id);
        setEditTitle(meeting.title);
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
        if (!editDate || !editStartTime || !editTitle) return;

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
                clientId: client.id,
                title: editTitle,
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


    return (
        <div className="space-y-4 pt-2">
            {!isAdding && (
                <div className="flex justify-between items-center gap-3 bg-gray-50 dark:bg-base-950 p-4 rounded-xl border border-gray-100 dark:border-white/10">
                    <div className="min-w-0">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base">יומן</h3>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">אירועים אלו יסתנכרנו עם יומני גוגל המחוברים למערכת</p>
                    </div>
                    <button onClick={() => setIsAdding(true)} className="shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary text-white rounded-xl shadow hover:bg-opacity-90 transition-all font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        הוסף פגישה
                    </button>
                </div>
            )}

            {isAdding && (
                <div className="bg-gray-50 dark:bg-base-900/50 p-5 rounded-xl border border-gray-200 dark:border-white/10 space-y-4">
                    <h3 className="font-bold border-b border-gray-200 dark:border-white/10 pb-2 mb-4">פגישה חדשה</h3>
                    <div>
                        <label className="block text-sm font-medium mb-1">כותרת הפגישה *</label>
                        <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="לדוגמה: פגישת היכרות" className="w-full px-4 py-2.5 bg-white dark:bg-base-950 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">תאריך *</label>
                            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-base-950 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">שעת התחלה *</label>
                            <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-base-950 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">שעת סיום (אופציונלי)</label>
                            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-base-950 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">תיאור (אופציונלי)</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="פרטים נוספים, קישור לזום, וכו'..." className="w-full px-4 py-2.5 bg-white dark:bg-base-950 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm resize-none"></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-white/20 transition-all font-medium text-sm">ביטול</button>
                        <button type="button" onClick={handleAddSubmit as any} className="px-4 py-2 bg-primary text-white rounded-xl shadow hover:bg-opacity-90 transition-all font-medium text-sm">שמור פגישה</button>
                    </div>
                </div>
            )}

            <div className="space-y-3 mt-4">
                {clientMeetings.length === 0 && !isAdding && (
                    <div className="text-center py-8 text-gray-500 bg-gray-50/50 dark:bg-base-900/30 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                        {`אין אירועים קרובים ${entityLabels.toSingular} זה.`}
                    </div>
                )}
                {clientMeetings.map(meeting => {
                    const isEditing = editingMeetingId === meeting.id;

                    return (
                        <div key={meeting.id} className={`p-3 bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 border-r-4 rounded-xl transition-all ${isEditing ? 'overflow-visible' : 'overflow-hidden'}`} style={{ borderRightColor: '#3b82f6' }}>
                            {isEditing ? (
                                <div className="flex-1 space-y-4 p-2">
                                    <div>
                                        <input type="text" required value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="כותרת הפגישה" className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 text-sm bg-white dark:bg-base-950" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <input type="date" required value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 text-sm bg-white dark:bg-base-950" />
                                        <input type="time" required value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 text-sm bg-white dark:bg-base-950" />
                                        <input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 text-sm bg-white dark:bg-base-950" />
                                    </div>
                                    <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} placeholder="תיאור..." className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 resize-none text-sm bg-white dark:bg-base-950"></textarea>
                                    <div className="flex justify-end gap-2 pt-1 mt-1">
                                        <button onClick={() => setEditingMeetingId(null)} className="text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleEditSave(meeting.id)} className="text-green-500 hover:text-green-600 p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                            <Check className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1.5 p-1">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-grow min-w-0" title={meeting.title}>
                                            <span className="font-medium">{meeting.title}</span>
                                        </div>
                                    </div>

                                    {meeting.description && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            {meeting.description.split('\n').map((line, i) => (
                                                <React.Fragment key={i}>{line}<br /></React.Fragment>
                                            ))}
                                        </div>
                                    )}

                                    {/* Bottom Row */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-3">
                                        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>{new Date(meeting.startTime).toLocaleDateString('he-IL')}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span dir="ltr">{new Date(meeting.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(meeting.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                                            <button type="button" onClick={() => handleEditStart(meeting)} className="text-blue-500 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="ערוך פגישה">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button type="button" onClick={async () => {
                                                if (await confirm({ title: 'מחיקת פגישה', message: 'האם אתה בטוח שברצונך למחוק פגישה זו? יוביל למחיקתה גם ביומן גוגל אם מקושר.' })) {
                                                    deleteMeeting(meeting.id);
                                                }
                                            }} className="text-red-500 hover:text-red-600 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="מחק פגישה">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
