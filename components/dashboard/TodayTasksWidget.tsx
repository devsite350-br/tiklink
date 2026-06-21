import React, { useState, useMemo } from 'react';
import { Client, Task, UNASSOCIATED_CLIENT_ID } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { ClipboardList, Check } from 'lucide-react';

interface TaskWithClient {
    task: Task;
    client: Client;
}

interface TodayTasksWidgetProps {
    tasks: TaskWithClient[];
    clients: Client[];
    onClientClick: (client: Client) => void;
}

export const TodayTasksWidget: React.FC<TodayTasksWidgetProps> = ({ tasks, clients, onClientClick }) => {
    const { entityLabels } = useAppContext();
    const [filterClientId, setFilterClientId] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'completed'>('all');

    const filteredTasks = useMemo(() => {
        let result = [...tasks];
        if (filterClientId) {
            result = result.filter(t => t.client.id === filterClientId);
        }
        if (filterStatus === 'open') {
            result = result.filter(t => !t.task.isCompleted);
        } else if (filterStatus === 'completed') {
            result = result.filter(t => t.task.isCompleted);
        }
        return result.sort((a, b) => Number(a.task.isCompleted) - Number(b.task.isCompleted));
    }, [tasks, filterClientId, filterStatus]);

    const clientsWithTasks = useMemo(() => {
        const ids = new Set(tasks.map(t => t.client.id));
        return clients.filter(c => ids.has(c.id) && c.id !== UNASSOCIATED_CLIENT_ID);
    }, [tasks, clients]);

    return (
        <div className="flex flex-col gap-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-md">
                    {([
                        { id: 'all' as const, label: 'הכל' },
                        { id: 'open' as const, label: 'פתוחות' },
                        { id: 'completed' as const, label: 'הושלמו' },
                    ]).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterStatus(tab.id)}
                            className={`px-2 py-1 text-xs rounded ${
                                filterStatus === tab.id
                                    ? 'bg-white dark:bg-gray-600 shadow-sm text-primary dark:text-white'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                {clientsWithTasks.length > 0 && (
                    <select
                        value={filterClientId}
                        onChange={e => setFilterClientId(e.target.value)}
                        className="h-7 text-xs rounded-md border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-300 focus:ring-0 focus:border-transparent pr-6 pl-2"
                    >
                        <option value="">{entityLabels.allEntities}</option>
                        {clientsWithTasks.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                )}
                <span className="text-xs text-gray-400 mr-auto">{filteredTasks.length} משימות</span>
            </div>

            {/* Task List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                        <ClipboardList className="w-10 h-10 mb-2" strokeWidth={1} />
                        <p className="text-sm">אין משימות להיום</p>
                    </div>
                ) : (
                    filteredTasks.map(({ task, client }) => (
                        <div
                            key={task.id}
                            className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
                                task.isCompleted
                                    ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-white/5 opacity-60'
                                    : 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-white/10'
                            }`}
                        >
                            <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 ${
                                task.isCompleted
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300 dark:border-gray-500'
                            }`}>
                                {task.isCompleted && (
                                    <Check className="w-full h-full text-white p-px" strokeWidth={3} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                    {task.text}
                                </p>
                                {client.id !== UNASSOCIATED_CLIENT_ID && (
                                    <button
                                        onClick={() => onClientClick(client)}
                                        className="text-xs text-primary hover:underline mt-0.5"
                                    >
                                        {client.name}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
