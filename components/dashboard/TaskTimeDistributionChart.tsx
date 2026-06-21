import React, { useState, useMemo } from 'react';
import { Task } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { Clock } from 'lucide-react';

interface EnrichedTask extends Task {
    clientName: string;
}

interface TaskTimeDistributionChartProps {
    tasks: EnrichedTask[];

}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f43f5e', '#84cc16', '#64748b'];

const formatTimeFromMs = (ms: number) => {
    if (!ms) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatTimeShort = (ms: number) => {
    if (!ms) return '0m';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${minutes}m`;
};

type GroupBy = 'task' | 'client';

export const TaskTimeDistributionChart: React.FC<TaskTimeDistributionChartProps> = ({ tasks }) => {
    const { entityLabels } = useAppContext();
    const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'completed'>('all');
    const [groupBy, setGroupBy] = useState<GroupBy>('task');
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const data = useMemo(() => {
        const timeMap = new Map<string, { count: number; color?: string }>();

        tasks.forEach(task => {
            if (filterStatus === 'open' && task.isCompleted) return;
            if (filterStatus === 'completed' && !task.isCompleted) return;

            const time = Number(task.totalTime) || 0;
            if (time <= 0) return;

            if (groupBy === 'task') {
                const key = task.text;
                const existing = timeMap.get(key) || { count: 0 };
                timeMap.set(key, { count: existing.count + time });
            } else if (groupBy === 'client') {
                const key = task.clientName;
                const existing = timeMap.get(key) || { count: 0 };
                timeMap.set(key, { count: existing.count + time });
            }
        });

        const sorted = Array.from(timeMap.entries())
            .map(([name, { count, color }]) => ({ name, count, color }))
            .sort((a, b) => b.count - a.count);

        if (sorted.length > 10) {
            const top10 = sorted.slice(0, 10);
            const othersTotal = sorted.slice(10).reduce((sum, item) => sum + item.count, 0);
            return [...top10, { name: 'אחר', count: othersTotal, color: undefined }];
        }

        return sorted;
    }, [tasks, filterStatus, groupBy]);

    const total = data.reduce((sum, d) => sum + d.count, 0);
    const maxCount = data.length > 0 ? data[0].count : 1;

    return (
        <div>
            {/* Controls row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <div className="flex items-center gap-2">
                    {/* Group by – pill tabs */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-md">
                        {([
                            { id: 'task' as const, label: 'משימה' },
                            { id: 'client' as const, label: entityLabels.singular },
                        ]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setGroupBy(tab.id)}
                                className={`px-2 py-1 text-xs rounded ${
                                    groupBy === tab.id
                                        ? 'bg-white dark:bg-gray-600 shadow-sm text-primary dark:text-white'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                        סה"כ:{' '}
                        <span className="font-mono font-medium">{formatTimeFromMs(total)}</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {/* Status filter – pill tabs */}
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
                </div>
            </div>

            {total === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <Clock className="w-12 h-12 mb-2" strokeWidth={1} />
                    <p className="text-sm">אין זמנים מוקלטים תחת סינון זה</p>
                </div>
            ) : (
                <div className="space-y-2" dir="rtl">
                    {data.map((item, index) => {
                        const pct = Math.max(4, (item.count / maxCount) * 100);
                        const color = item.color || COLORS[index % COLORS.length];
                        const isHovered = hoveredIndex === index;

                        return (
                            <div
                                key={index}
                                className="group"
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                <div className="flex items-center justify-between mb-0.5 gap-2">
                                    <span
                                        className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate flex-1 min-w-0"
                                        title={item.name}
                                    >
                                        {item.name}
                                    </span>
                                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">
                                        {formatTimeShort(item.count)}
                                    </span>
                                </div>

                                <div className="w-full h-5 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden">
                                    <div
                                        className="h-full rounded-md transition-all duration-300"
                                        style={{
                                            width: `${pct}%`,
                                            backgroundColor: color,
                                            opacity: isHovered ? 1 : 0.85,
                                        }}
                                    />
                                </div>

                                {isHovered && (
                                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                                        {formatTimeFromMs(item.count)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
