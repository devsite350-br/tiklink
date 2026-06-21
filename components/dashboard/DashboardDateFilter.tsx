import React from 'react';

export interface DateRange {
    from: number;
    to: number;
}

export type DatePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'last30' | 'custom';

const PRESETS: { id: DatePreset; label: string }[] = [
    { id: 'today', label: 'היום' },
    { id: 'yesterday', label: 'אתמול' },
    { id: 'thisWeek', label: 'השבוע' },
    { id: 'thisMonth', label: 'החודש' },
    { id: 'last30', label: '30 ימים' },
    { id: 'custom', label: 'טווח מותאם' },
];

export function computeDateRange(preset: DatePreset, custom: { from: string; to: string }): DateRange {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

    switch (preset) {
        case 'today':
            return { from: startOfDay(now), to: endOfDay(now) };
        case 'yesterday': {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            return { from: startOfDay(y), to: endOfDay(y) };
        }
        case 'thisWeek': {
            const d = new Date(now);
            d.setDate(d.getDate() - d.getDay());
            return { from: startOfDay(d), to: endOfDay(now) };
        }
        case 'thisMonth':
            return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: endOfDay(now) };
        case 'last30': {
            const d = new Date(now);
            d.setDate(d.getDate() - 30);
            return { from: startOfDay(d), to: endOfDay(now) };
        }
        case 'custom':
            return {
                from: custom.from ? new Date(custom.from).getTime() : 0,
                to: custom.to ? endOfDay(new Date(custom.to)) : endOfDay(now),
            };
        default: {
            const d = new Date(now);
            d.setDate(d.getDate() - 30);
            return { from: startOfDay(d), to: endOfDay(now) };
        }
    }
}

interface DashboardDateFilterProps {
    preset: DatePreset;
    onPresetChange: (preset: DatePreset) => void;
    customRange: { from: string; to: string };
    onCustomRangeChange: (range: { from: string; to: string }) => void;
    fullWidth?: boolean;
}

export const DashboardDateFilter: React.FC<DashboardDateFilterProps> = ({
    preset,
    onPresetChange,
    customRange,
    onCustomRangeChange,
    fullWidth,
}) => {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className={`flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg ${fullWidth ? 'w-full' : 'flex-wrap'}`}>
                {PRESETS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => onPresetChange(p.id)}
                        className={`${fullWidth ? 'flex-1' : ''} px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-shadow whitespace-nowrap ${
                            preset === p.id
                                ? 'bg-white dark:bg-gray-600 shadow-sm text-primary dark:text-white'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-200'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            {preset === 'custom' && (
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={customRange.from}
                        onChange={e => onCustomRangeChange({ ...customRange, from: e.target.value })}
                        className="h-9 px-2 text-sm rounded-lg border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-300 focus:ring-0 focus:border-transparent"
                    />
                    <span className="text-gray-400 text-sm">עד</span>
                    <input
                        type="date"
                        value={customRange.to}
                        onChange={e => onCustomRangeChange({ ...customRange, to: e.target.value })}
                        className="h-9 px-2 text-sm rounded-lg border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-300 focus:ring-0 focus:border-transparent"
                    />
                </div>
            )}
        </div>
    );
};
