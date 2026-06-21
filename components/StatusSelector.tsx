
import React, { useState, useRef, useEffect } from 'react';
import { StatusDefinition } from '../types';
import { useAppContext } from '../context/AppContext';
import { ChevronDown } from 'lucide-react';

interface StatusSelectorProps {
    value: string;
    onChange: (status: string) => void;
}

export const StatusSelector: React.FC<StatusSelectorProps> = ({ value, onChange }) => {
    const { statuses, statusMap } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedStatus = statusMap.get(value);
    const selectedColor = selectedStatus?.color || '#cccccc';

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const handleSelect = (statusName: string) => {
        onChange(statusName);
        setIsOpen(false);
    }

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full mt-1 px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 flex justify-between items-center transition-all shadow-sm"
            >
                <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedColor }}></span>
                    {value || 'בחר סטטוס'}
                </span>
                <ChevronDown className={`w-5 h-5 transition-transform text-gray-500 dark:text-gray-400 ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <ul className="absolute z-20 w-full mt-2 bg-white dark:bg-base-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-60 overflow-auto py-1 animate-in fade-in zoom-in duration-200">
                    {statuses.map(status => (
                        <li
                            key={status.id}
                            onClick={() => handleSelect(status.name)}
                            className="px-4 py-2 hover:bg-base-200 dark:hover:bg-base-900/50 cursor-pointer flex items-center gap-2 text-gray-900 dark:text-gray-200"
                        >
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }}></span>
                            {status.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};