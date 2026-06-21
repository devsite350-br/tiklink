import React, { useState } from 'react';
import { Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useAppContext } from '../../context/AppContext';
import { Users } from 'lucide-react';

interface UserData {
    name: string;
    count: number;
}

interface UserDistributionChartProps {
    data: UserData[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

const createCustomTooltip = (entityPlural: string) => ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload as UserData;
        return (
            <div className="bg-white dark:bg-gray-700 shadow-lg rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{d.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-300">{d.count} {entityPlural}</p>
            </div>
        );
    }
    return null;
};

export const UserDistributionChart: React.FC<UserDistributionChartProps> = ({ data }) => {
    const { entityLabels } = useAppContext();
    const [chartType, setChartType] = useState<'bar' | 'pie'>('pie');
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const isDark = useDarkMode();
    const labelColor = isDark ? '#e5e7eb' : '#374151';
    const total = data.reduce((sum, d) => sum + d.count, 0);
    const maxCount = data.length > 0 ? Math.max(...data.map(d => d.count)) : 1;

    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Users className="w-12 h-12 mb-2" strokeWidth={1} />
                <p className="text-sm">אין נתונים לתקופה זו</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-end mb-2">
                <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-md">
                    <button
                        onClick={() => setChartType('bar')}
                        className={`px-2 py-1 text-xs rounded ${chartType === 'bar' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary dark:text-white' : 'text-gray-500'}`}
                    >
                        עמודות
                    </button>
                    <button
                        onClick={() => setChartType('pie')}
                        className={`px-2 py-1 text-xs rounded ${chartType === 'pie' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary dark:text-white' : 'text-gray-500'}`}
                    >
                        עוגה
                    </button>
                </div>
            </div>

            {chartType === 'bar' ? (
                <div className="space-y-2" dir="rtl">
                    {data.map((item, index) => {
                        const pct = Math.max(4, (item.count / maxCount) * 100);
                        const color = COLORS[index % COLORS.length];
                        const isHovered = hoveredIndex === index;

                        return (
                            <div
                                key={index}
                                className="group"
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                <div className="flex items-center justify-between mb-0.5 gap-2">
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate flex-1 min-w-0">
                                        {item.name}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">
                                        {item.count} {entityLabels.plural}
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
                            </div>
                        );
                    })}
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={data.filter(d => d.count > 0)}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={75}
                            innerRadius={35}
                            label={({ name, percent, x, y, textAnchor }) => (
                                <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fill={labelColor} fontSize={12} fontWeight={500}>
                                    {`${name} ${(percent * 100).toFixed(0)}%`}
                                </text>
                            )}
                            labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                            paddingAngle={2}
                        >
                            {data.filter(d => d.count > 0).map((_, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={createCustomTooltip(entityLabels.plural)} />
                    </PieChart>
                </ResponsiveContainer>
            )}

            <div className="flex flex-wrap gap-2 mt-3 justify-center">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span>{d.name}: {d.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
