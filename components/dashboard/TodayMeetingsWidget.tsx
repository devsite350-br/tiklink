import React, { useState, useMemo } from 'react';
import { Client, Meeting, UNASSOCIATED_CLIENT_ID } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { CalendarDays } from 'lucide-react';

interface TodayMeetingsWidgetProps {
    meetings: Meeting[];
    clients: Client[];
    onClientClick: (client: Client) => void;
}

export const TodayMeetingsWidget: React.FC<TodayMeetingsWidgetProps> = ({ meetings, clients, onClientClick }) => {
    const { entityLabels } = useAppContext();
    const [filterClientId, setFilterClientId] = useState('');

    const filteredMeetings = useMemo(() => {
        let result = [...meetings];
        if (filterClientId) {
            result = result.filter(m => m.clientId === filterClientId);
        }
        return result;
    }, [meetings, filterClientId]);

    const clientsWithMeetings = useMemo(() => {
        const ids = new Set(meetings.map(m => m.clientId));
        return clients.filter(c => ids.has(c.id) && c.id !== UNASSOCIATED_CLIENT_ID);
    }, [meetings, clients]);

    const getClientName = (clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        return client ? client.name : entityLabels.notFound;
    };

    const now = new Date();

    return (
        <div className="flex flex-col gap-3">
            {/* Filters */}
            <div className="flex items-center gap-2">
                {clientsWithMeetings.length > 0 && (
                    <select
                        value={filterClientId}
                        onChange={e => setFilterClientId(e.target.value)}
                        className="h-7 text-xs rounded-md border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-300 focus:ring-0 focus:border-transparent pr-6 pl-2"
                    >
                        <option value="">{entityLabels.allEntities}</option>
                        {clientsWithMeetings.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                )}
                <span className="text-xs text-gray-400 mr-auto">{filteredMeetings.length} אירועים</span>
            </div>

            {/* Meeting List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredMeetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                        <CalendarDays className="w-10 h-10 mb-2" strokeWidth={1} />
                        <p className="text-sm">אין אירועים להיום</p>
                    </div>
                ) : (
                    filteredMeetings.map(meeting => {
                        const startTime = new Date(meeting.startTime);
                        const endTime = new Date(meeting.endTime);
                        const isPast = endTime < now;
                        const isNow = startTime <= now && endTime >= now;

                        return (
                            <div
                                key={meeting.id}
                                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
                                    isNow
                                        ? 'bg-primary/5 dark:bg-primary/10 border-primary/30'
                                        : isPast
                                            ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-white/5 opacity-60'
                                            : 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-white/10'
                                }`}
                            >
                                <div className={`w-1.5 h-full self-stretch rounded-full flex-shrink-0 min-h-[40px] ${
                                    isNow ? 'bg-primary' : isPast ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-400'
                                }`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span dir="ltr" className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                            {startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                            {' - '}
                                            {endTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {isNow && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-primary text-white rounded-full font-medium">עכשיו</span>
                                        )}
                                    </div>
                                    <p className={`text-sm font-medium ${isPast ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                        {meeting.title}
                                    </p>
                                    <button
                                        onClick={() => {
                                            const client = clients.find(c => c.id === meeting.clientId);
                                            if (client) onClientClick(client);
                                        }}
                                        className="text-xs text-primary hover:underline mt-0.5"
                                    >
                                        {getClientName(meeting.clientId)}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
