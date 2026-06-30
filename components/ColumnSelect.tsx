import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { TaskKanbanColumn } from '../types';

interface ColumnSelectProps {
    columns: TaskKanbanColumn[];
    value: string;
    onChange: (id: string) => void;
}

// Custom dropdown for picking a task kanban column. Unlike a native <select>,
// it renders a colored dot next to each option (and the selected value) using
// the column's configured color.
export const ColumnSelect: React.FC<ColumnSelectProps> = ({ columns, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = columns.find(c => c.id === value) || columns[0];

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary dark:bg-base-800 dark:border-gray-600 outline-none flex items-center gap-2"
            >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selected?.color }} />
                <span className="flex-1 text-right truncate">{selected?.name}</span>
                <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" strokeWidth={3} />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 right-0 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
                    {columns.map(col => (
                        <button
                            key={col.id}
                            type="button"
                            onClick={() => { onChange(col.id); setOpen(false); }}
                            className={`w-full px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${value === col.id ? 'bg-primary/10 text-primary font-medium' : 'dark:text-gray-200'}`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                            <span className="flex-1 text-right truncate">{col.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
