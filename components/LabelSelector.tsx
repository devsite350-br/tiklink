
import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from '../context/AppContext';

interface LabelSelectorProps {
    selectedLabelIds: string[];
    onChange: (labelIds: string[]) => void;
    module?: 'client' | 'task';
}

const isColorLight = (hexColor: string) => {
    const color = (hexColor.charAt(0) === '#') ? hexColor.substring(1, 7) : hexColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186);
};

export const LabelSelector: React.FC<LabelSelectorProps> = ({ selectedLabelIds, onChange, module }) => {
    const { labels, labelMap } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLUListElement>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

    const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const dropdownWidth = Math.max(rect.width, 180);
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Align right edge with trigger right edge (good for RTL),
        // then clamp to keep within viewport.
        let left = rect.right - dropdownWidth;
        if (left < 8) left = 8;
        if (left + dropdownWidth > viewportWidth - 8) left = viewportWidth - dropdownWidth - 8;

        // Default open below; flip up if not enough space.
        const estimatedHeight = 240;
        const spaceBelow = viewportHeight - rect.bottom;
        const top = spaceBelow < estimatedHeight && rect.top > estimatedHeight
            ? rect.top - estimatedHeight - 4
            : rect.bottom + 4;

        setDropdownPos({ top, left, width: dropdownWidth });
    };

    useLayoutEffect(() => {
        if (isOpen) updatePosition();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleReposition = () => updatePosition();
        window.addEventListener('resize', handleReposition);
        window.addEventListener('scroll', handleReposition, true);
        return () => {
            window.removeEventListener('resize', handleReposition);
            window.removeEventListener('scroll', handleReposition, true);
        };
    }, [isOpen]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            const inWrapper = wrapperRef.current?.contains(target);
            const inDropdown = dropdownRef.current?.contains(target);
            if (!inWrapper && !inDropdown) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleToggleLabel = (labelId: string) => {
        const newSelectedIds = selectedLabelIds.includes(labelId)
            ? selectedLabelIds.filter(id => id !== labelId)
            : [...selectedLabelIds, labelId];
        onChange(newSelectedIds);
    };

    const availableLabels = useMemo(() => {
        return labels.filter(label => {
            if (selectedLabelIds.includes(label.id)) return false;
            // If filtering by module:
            // 'client' -> includes 'client' AND undefined (legacy)
            // 'task' -> includes only 'task'
            if (module === 'client') return !label.module || label.module === 'client';
            if (module === 'task') return label.module === 'task';
            return true;
        });
    }, [labels, selectedLabelIds, module]);

    return (
        <div className="relative max-w-full" ref={wrapperRef}>
            <div
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full max-w-full rounded-xl text-gray-900 dark:text-white flex flex-wrap gap-1.5 items-center cursor-pointer transition-all ${selectedLabelIds.length === 0 ? 'px-3 py-1.5 border border-dashed border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20' : 'p-1'}`}
            >
                {selectedLabelIds.map(id => {
                    const label = labelMap.get(id);
                    if (!label) return null;
                    return (
                        <span key={id} className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm"
                            style={{ backgroundColor: label.color, color: isColorLight(label.color) ? '#000' : '#FFF' }}>
                            {label.name}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleLabel(id);
                                }}
                                className="opacity-75 hover:opacity-100 ml-1"
                            >
                                &times;
                            </button>
                        </span>
                    );
                })}
                {selectedLabelIds.length === 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-600">בחר תגיות...</span>
                )}
            </div>
            {isOpen && dropdownPos && ReactDOM.createPortal(
                <ul
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        width: dropdownPos.width,
                    }}
                    className="z-[60] bg-white dark:bg-base-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-60 overflow-auto py-1.5 animate-in fade-in zoom-in duration-200"
                >
                    {availableLabels.length > 0 ? availableLabels.map(label => (
                        <li
                            key={label.id}
                            onClick={() => handleToggleLabel(label.id)}
                            className="px-3 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                            <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full"
                                style={{ backgroundColor: label.color, color: isColorLight(label.color) ? '#000' : '#FFF' }}>
                                {label.name}
                            </span>
                        </li>
                    )) : (
                        <li className="px-4 py-2 text-gray-500 text-sm">אין תגיות נוספות.</li>
                    )}
                </ul>,
                document.body
            )}
        </div>
    );
};
