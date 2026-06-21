import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Settings, LayoutDashboard } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Client, Task, UNASSOCIATED_CLIENT_ID } from '../types';
import { DashboardDateFilter, DatePreset, computeDateRange } from './dashboard/DashboardDateFilter';
import { DashboardWidgetWrapper } from './dashboard/DashboardWidgetWrapper';
import { StatusDistributionChart } from './dashboard/StatusDistributionChart';
import { UserDistributionChart } from './dashboard/UserDistributionChart';
import { TodayTasksWidget } from './dashboard/TodayTasksWidget';
import { TodayMeetingsWidget } from './dashboard/TodayMeetingsWidget';
import { TaskTimeDistributionChart } from './dashboard/TaskTimeDistributionChart';

interface DashboardWidgetVisibility {
    statusChart: boolean;
    userChart: boolean;
    todayTasks: boolean;
    todayMeetings: boolean;
    taskTimeChart?: boolean;
}

const DEFAULT_WIDGET_VISIBILITY: DashboardWidgetVisibility = {
    statusChart: true,
    userChart: true,
    todayTasks: true,
    todayMeetings: true,
    taskTimeChart: true,
};

const WIDGET_LABELS: { key: keyof DashboardWidgetVisibility; label: string }[] = [
    { key: 'statusChart', label: 'התפלגות לפי סטטוס' },
    { key: 'userChart', label: 'התפלגות לפי משתמש' },
    { key: 'todayTasks', label: 'משימות להיום' },
    { key: 'taskTimeChart', label: 'התפלגות משימות לפי זמן' },
];

interface DashboardPageProps {
    onClientClick: (client: Client) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onClientClick }) => {
    const { clients, statuses, meetings, teamMembers, labelMap, visibilitySettings, entityLabels } = useAppContext();

    // Widget visibility
    const [widgetVisibility, setWidgetVisibility] = useLocalStorage<DashboardWidgetVisibility>(
        'dashboardWidgets', DEFAULT_WIDGET_VISIBILITY
    );
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
                setSettingsOpen(false);
            }
        };
        if (settingsOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [settingsOpen]);

    // Date filter for charts
    const [datePreset, setDatePreset] = useState<DatePreset>('last30');
    const [customRange, setCustomRange] = useState({ from: '', to: '' });

    const dateRange = useMemo(
        () => computeDateRange(datePreset, customRange),
        [datePreset, customRange]
    );

    // Filtered clients for charts
    const chartClients = useMemo(() => {
        return clients.filter(c => {
            if (c.id === UNASSOCIATED_CLIENT_ID) return false;
            if (!c.createdAt) return false;
            return c.createdAt >= dateRange.from && c.createdAt <= dateRange.to;
        });
    }, [clients, dateRange]);

    // Status distribution
    const statusDistribution = useMemo(() => {
        const countMap = new Map<string, number>();
        chartClients.forEach(client => {
            countMap.set(client.status, (countMap.get(client.status) || 0) + 1);
        });
        return statuses.map(status => ({
            name: status.name,
            count: countMap.get(status.name) || 0,
            color: status.color,
        }));
    }, [chartClients, statuses]);

    // User distribution
    const userDistribution = useMemo(() => {
        const countMap = new Map<string, number>();
        let unassignedCount = 0;

        chartClients.forEach(client => {
            if (client.assignedTo) {
                countMap.set(client.assignedTo, (countMap.get(client.assignedTo) || 0) + 1);
            } else {
                unassignedCount++;
            }
        });

        const result = teamMembers.map(member => ({
            name: member.displayName || member.email.split('@')[0],
            count: countMap.get(member.id) || 0,
        }));

        if (unassignedCount > 0) {
            result.push({ name: 'לא משויך', count: unassignedCount });
        }

        return result;
    }, [chartClients, teamMembers]);

    // Task time distribution tasks (enriched with clientName)
    const timeChartTasks = useMemo(() => {
        const result: (Task & { clientName: string })[] = [];
        clients.forEach(client => {
            client.tasks.forEach(task => {
                const time = Number(task.totalTime) || 0;
                if (time > 0 && task.text) {
                    let taskDate = task.createdAt;
                    if (!taskDate) {
                        const parts = task.id.split('_');
                        if (parts.length >= 2) {
                            const parsed = parseInt(parts[1], 10);
                            if (!isNaN(parsed) && parsed > 1000000000000) {
                                taskDate = parsed;
                            }
                        }
                    }
                    if (!taskDate) taskDate = client.createdAt || 0;

                    if (taskDate >= dateRange.from && taskDate <= dateRange.to) {
                        result.push({ ...task, clientName: client.id === UNASSOCIATED_CLIENT_ID ? entityLabels.withoutEntity : client.name });
                    }
                }
            });
        });
        return result;
    }, [clients, dateRange]);

    // Today's tasks
    const todayTasks = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const result: { task: Task; client: Client }[] = [];
        clients.forEach(client => {
            client.tasks.forEach(task => {
                if (task.dueDate && task.dueDate.startsWith(todayStr)) {
                    result.push({ task, client });
                }
            });
        });
        return result;
    }, [clients]);

    // Today's meetings
    const todayMeetings = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        return meetings
            .filter(m => {
                const start = new Date(m.startTime);
                return start >= todayStart && start <= todayEnd;
            })
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }, [meetings]);

    const toggleWidget = (key: keyof DashboardWidgetVisibility) => {
        setWidgetVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const activeWidgets = Object.values(widgetVisibility).filter(Boolean).length;

    return (
        <div className="overflow-y-auto h-full">
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                {/* Header */}
                <header className="p-3 sm:p-4 border-b dark:border-gray-700 flex-shrink-0">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">דשבורד</h1>
                            <p className="hidden sm:block text-gray-500 dark:text-gray-400 text-sm mt-0.5">סקירה כללית של הנתונים</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Date filter - desktop only inline */}
                            {(widgetVisibility.statusChart || widgetVisibility.userChart) && (
                                <div className="hidden sm:block">
                                    <DashboardDateFilter
                                        preset={datePreset}
                                        onPresetChange={setDatePreset}
                                        customRange={customRange}
                                        onCustomRangeChange={setCustomRange}
                                    />
                                </div>
                            )}
                            <div className="relative" ref={settingsRef}>
                                <button
                                    onClick={() => setSettingsOpen(!settingsOpen)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                                    title="הגדרות תצוגה"
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                                {settingsOpen && (
                                    <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-30 py-2">
                                        <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase">רכיבי דשבורד</div>
                                        {WIDGET_LABELS.map(w => (
                                            <label
                                                key={w.key}
                                                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                                            >
                                                <div
                                                    onClick={() => toggleWidget(w.key)}
                                                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                                                        (widgetVisibility[w.key] ?? true) ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-500'
                                                    }`}
                                                >
                                                    <div className={`absolute top-0.5 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                                        (widgetVisibility[w.key] ?? true) ? 'translate-x-[18px]' : 'translate-x-0.5'
                                                    }`} />
                                                </div>
                                                <span className="text-sm text-gray-700 dark:text-gray-200">{w.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Date filter - mobile full width */}
                    {(widgetVisibility.statusChart || widgetVisibility.userChart) && (
                        <div className="sm:hidden mt-2">
                            <DashboardDateFilter
                                preset={datePreset}
                                onPresetChange={setDatePreset}
                                customRange={customRange}
                                onCustomRangeChange={setCustomRange}
                                fullWidth
                            />
                        </div>
                    )}
                </header>

                {/* Widgets Grid */}
                <div className="p-3 sm:p-4">
                    {activeWidgets === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <LayoutDashboard className="w-16 h-16 mb-3" />
                            <p className="text-sm mb-1">כל הרכיבים מוסתרים</p>
                            <p className="text-xs">לחץ על ההגדרות כדי להפעיל רכיבים</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {widgetVisibility.statusChart && (
                                <DashboardWidgetWrapper title={`התפלגות ${entityLabels.plural} לפי סטטוס`}>
                                    <StatusDistributionChart data={statusDistribution} />
                                </DashboardWidgetWrapper>
                            )}
                            {widgetVisibility.userChart && (
                                <DashboardWidgetWrapper title={`התפלגות ${entityLabels.plural} לפי משתמש`}>
                                    <UserDistributionChart data={userDistribution} />
                                </DashboardWidgetWrapper>
                            )}
                            {visibilitySettings.tasks?.enableTimeTracking !== false && (widgetVisibility.taskTimeChart ?? true) && (
                                <DashboardWidgetWrapper title="התפלגות משימות לפי זמן">
                                    <TaskTimeDistributionChart tasks={timeChartTasks} labelMap={labelMap} />
                                </DashboardWidgetWrapper>
                            )}
                            {widgetVisibility.todayTasks && (
                                <DashboardWidgetWrapper title="משימות להיום">
                                    <TodayTasksWidget tasks={todayTasks} clients={clients} onClientClick={onClientClick} />
                                </DashboardWidgetWrapper>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
