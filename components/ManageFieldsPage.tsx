
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GripVertical, Pencil, Trash2, Plus, Image, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { CustomFieldDefinition, CustomFieldType, CUSTOM_FIELD_TYPE_LIST, StatusDefinition, LabelDefinition, ModuleVisibility, VisibilitySettings, SYSTEM_FIELD_DEFINITIONS, isSystemFieldId } from '../types';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LeadSourcesPage } from './LeadSourcesPage';
import { AutomationsPage } from './AutomationsPage';
import { TeamSettings } from './TeamSettings';
import { AISettings } from './AISettings';
import { MeetingsSettings } from './MeetingsSettings';
import { WhatsAppSettings } from './WhatsAppSettings';
import { EmailSettings } from './EmailSettings';
import { SystemSettings } from './SystemSettings';

export const ModuleVisibilityCheckboxes: React.FC<{
    moduleKey: keyof VisibilitySettings;
    label: string;
    allowToggle?: boolean;
    defaultEnabled?: boolean;
}> = ({ moduleKey, label, allowToggle = false, defaultEnabled = true }) => {
    const { visibilitySettings, updateVisibilitySettings, entityLabels } = useAppContext();
    const current = visibilitySettings[moduleKey];

    const handleChange = (field: keyof ModuleVisibility, value: boolean) => {
        let updates: Partial<ModuleVisibility> = { [field]: value };
        if (field === 'enabled' && value) {
            updates.showInCard = true;
            updates.showInGrid = false;
            updates.showInList = false;
        }
        updateVisibilitySettings({
            ...visibilitySettings,
            [moduleKey]: { ...current, ...updates },
        });
    };

    return (
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-500/20 rounded-xl p-4 mb-6">
            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3">הגדרות תצוגה - {label}</h4>
            <div className="flex flex-col gap-4">
                {allowToggle && (
                    <label className="flex items-center gap-2 cursor-pointer border-b border-blue-100 dark:border-blue-500/10 pb-4">
                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="toggle"
                                id={`toggle-${moduleKey}`}
                                checked={current.enabled ?? defaultEnabled}
                                onChange={e => handleChange('enabled', e.target.checked)}
                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out focus:outline-none focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                                style={{
                                    transform: (current.enabled ?? defaultEnabled) ? 'translateX(-100%)' : 'translateX(0)',
                                    borderColor: (current.enabled ?? defaultEnabled) ? '#3b82f6' : '#d1d5db',
                                    backgroundColor: (current.enabled ?? defaultEnabled) ? '#3b82f6' : '#fff',
                                    right: 0
                                }}
                            />
                            <label
                                htmlFor={`toggle-${moduleKey}`}
                                className={`toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer transition-colors duration-200 ease-in-out disabled:opacity-50 ${(current.enabled ?? defaultEnabled) ? 'bg-blue-200 dark:bg-blue-900' : 'bg-gray-300 dark:bg-gray-600'}`}
                            ></label>
                        </div>
                        <span className="text-gray-900 dark:text-gray-100 font-bold">הפעל מודול {label}</span>
                    </label>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm mt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={current.showInGrid} onChange={e => handleChange('showInGrid', e.target.checked)} className="rounded text-primary focus:ring-primary" disabled={allowToggle && !(current.enabled ?? defaultEnabled)} />
                        <span className={`text-gray-700 dark:text-gray-300 ${allowToggle && !(current.enabled ?? defaultEnabled) ? 'opacity-50' : ''}`}>הצג בגריד</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={current.showInList} onChange={e => handleChange('showInList', e.target.checked)} className="rounded text-primary focus:ring-primary" disabled={allowToggle && !(current.enabled ?? defaultEnabled)} />
                        <span className={`text-gray-700 dark:text-gray-300 ${allowToggle && !(current.enabled ?? defaultEnabled) ? 'opacity-50' : ''}`}>הצג ברשימה</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={current.showInCard} onChange={e => handleChange('showInCard', e.target.checked)} className="rounded text-primary focus:ring-primary" disabled={allowToggle && !(current.enabled ?? defaultEnabled)} />
                        <span className={`text-gray-700 dark:text-gray-300 ${allowToggle && !(current.enabled ?? defaultEnabled) ? 'opacity-50' : ''}`}>{entityLabels.showInCard}</span>
                    </label>
                </div>
            </div>
        </div>
    );
};

const isColorLight = (hexColor: string) => {
    if (!hexColor) return false;
    const color = (hexColor.charAt(0) === '#') ? hexColor.substring(1, 7) : hexColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186);
};

const DragHandle = () => (
    <GripVertical size={20} className="cursor-grab text-gray-500" />
);

const LabelsManager = () => {
    // Module visibility for labels
    // (displayed above the labels list)
    const { labels, addLabel, updateLabel, deleteLabel, clients, entityLabels } = useAppContext();
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState('#2f8f74');

    const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
    const [editedLabelData, setEditedLabelData] = useState<Omit<LabelDefinition, 'id'>>({ name: '', color: '#2f8f74' });

    const filteredLabels = useMemo(() => {
        return labels.filter(l => !l.module || l.module === 'client');
    }, [labels]);

    const handleAddLabel = (e: React.FormEvent) => {
        e.preventDefault();
        if (newLabelName.trim()) {
            addLabel(newLabelName.trim(), newLabelColor, 'client');
            setNewLabelName('');
            setNewLabelColor('#2f8f74');
        }
    };

    const handleStartEdit = (label: LabelDefinition) => {
        setEditingLabelId(label.id);
        setEditedLabelData({ name: label.name, color: label.color, module: label.module });
    };

    const handleSaveEdit = () => {
        if (editingLabelId && editedLabelData.name.trim()) {
            updateLabel({ id: editingLabelId, ...editedLabelData });
            setEditingLabelId(null);
        }
    };

    return (
        <div className="space-y-6 px-1">
            <ModuleVisibilityCheckboxes moduleKey="labels" label="תגיות" />

            <div>
                <h3 className="text-lg font-medium mb-2">
                    {`תגיות ${entityLabels.singular} קיימות`}
                </h3>
                {filteredLabels.length > 0 ? (
                    <ul className="space-y-2 max-h-96 overflow-y-auto pr-2 hide-scrollbar">
                        {filteredLabels.map(label => (
                            <li key={label.id} className="bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-3 rounded-xl shadow-sm">
                                {editingLabelId === label.id ? (
                                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                                        <div className="flex w-full sm:w-auto gap-2">
                                            <input type="color" value={editedLabelData.color} onChange={e => setEditedLabelData(p => ({ ...p, color: e.target.value }))} className="p-1 h-8 w-full sm:w-10 block bg-white border border-gray-200 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none dark:bg-slate-900 dark:border-gray-700" />
                                        </div>
                                        <input type="text" value={editedLabelData.name} onChange={e => setEditedLabelData(p => ({ ...p, name: e.target.value }))} className="flex-grow w-full sm:w-auto px-4 py-2 border rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white border-gray-200 dark:border-white/10" />
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button onClick={() => setEditingLabelId(null)} className="flex-1 sm:flex-none text-sm px-2 py-1 rounded bg-gray-300 dark:bg-gray-600">בטל</button>
                                            <button onClick={handleSaveEdit} className="flex-1 sm:flex-none text-sm px-2 py-1 rounded bg-primary text-white">שמור</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <span
                                            className="font-semibold px-2 py-1 rounded-md text-sm"
                                            style={{ backgroundColor: label.color, color: isColorLight(label.color) ? '#000' : '#FFF' }}
                                        >
                                            {label.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleStartEdit(label)} className="text-primary hover:opacity-80" aria-label={`ערוך תגית ${label.name}`}>
                                                <Pencil className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('האם אתה בטוח שברצונך למחוק תגית זו?')) {
                                                        deleteLabel(label.id);
                                                    }
                                                }}
                                                className="text-red-500 hover:text-red-700"
                                                aria-label={`מחק תגית ${label.name}`}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-gray-500">אין תגיות {entityLabels.singular} קיימות.</p>}
            </div>
            <form onSubmit={handleAddLabel} className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium mb-2">הוספת תגית {entityLabels.singular} חדשה</h3>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                        type="color"
                        value={newLabelColor}
                        onChange={(e) => setNewLabelColor(e.target.value)}
                        className="p-1 h-10 w-full sm:w-12 block bg-white dark:bg-base-950 border border-gray-200 dark:border-white/10 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none"
                    />
                    <input
                        type="text"
                        placeholder="שם התגית"
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        required
                        className="w-full sm:w-auto flex-grow px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
                    />
                    <button type="submit" className="w-full sm:w-auto px-4 py-2 rounded bg-primary text-white hover:bg-opacity-90">הוסף תגית</button>
                </div>
            </form>
        </div>
    )
}

interface SortableStatusItemProps {
    status: StatusDefinition;
    isEditing: boolean;
    onStartEdit: (status: StatusDefinition) => void;
    onSaveEdit: (status: StatusDefinition) => void;
    onCancelEdit: () => void;
    onDelete: (id: string) => void;
    editedData: Omit<StatusDefinition, 'id' | 'order'>;
    setEditedData: React.Dispatch<React.SetStateAction<Omit<StatusDefinition, 'id' | 'order'>>>;
}

const SortableStatusItem: React.FC<SortableStatusItemProps> = ({ status, isEditing, onStartEdit, onSaveEdit, onCancelEdit, onDelete, editedData, setEditedData }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: status.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <li ref={setNodeRef} style={style} className="bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-3 rounded-xl shadow-sm flex items-center gap-2">
            <div {...attributes} {...listeners}><DragHandle /></div>
            {isEditing ? (
                <div className="flex-grow flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <input type="color" value={editedData.color} onChange={e => setEditedData(p => ({ ...p, color: e.target.value }))} className="p-1 h-8 w-full sm:w-10 block bg-white border border-gray-200 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none dark:bg-slate-900 dark:border-gray-700" />
                    <input type="text" value={editedData.name} onChange={e => setEditedData(p => ({ ...p, name: e.target.value }))} className="w-full sm:flex-grow px-4 py-2 border rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white border-gray-200 dark:border-white/10" />
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={onCancelEdit} className="flex-1 sm:flex-none text-sm px-2 py-1 rounded bg-gray-300 dark:bg-gray-600">בטל</button>
                        <button onClick={onSaveEdit} className="flex-1 sm:flex-none text-sm px-2 py-1 rounded bg-primary text-white">שמור</button>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full" style={{ backgroundColor: status.color }}></span>
                        <span className="font-semibold">{status.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onStartEdit(status)} className="text-primary hover:opacity-80" aria-label={`ערוך את הסטטוס ${status.name}`}>
                            <Pencil className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => onDelete(status.id)}
                            onPointerDown={e => e.stopPropagation()}
                            className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                            aria-label={`מחק את הסטטוס ${status.name}`}
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </li>
    );
};

const StatusManager = () => {
    const { statuses, addStatus, updateStatus, deleteStatus, setStatusesOrder, clients } = useAppContext();
    const [currentStatuses, setCurrentStatuses] = useState(statuses);
    const [newStatusName, setNewStatusName] = useState('');
    const [newStatusColor, setNewStatusColor] = useState('#cccccc');
    const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
    const [editedStatusData, setEditedStatusData] = useState<Omit<StatusDefinition, 'id' | 'order'>>({ name: '', color: '#cccccc' });

    useEffect(() => {
        setCurrentStatuses(statuses);
    }, [statuses]);

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = currentStatuses.findIndex(s => s.id === active.id);
            const newIndex = currentStatuses.findIndex(s => s.id === over.id);
            const newOrder = arrayMove(currentStatuses, oldIndex, newIndex);
            setCurrentStatuses(newOrder);
            setStatusesOrder(newOrder.map((s: StatusDefinition) => s.id));
        }
    };

    const statusInUseMap = useMemo(() => new Set(clients.map(c => c.status)), [clients]);

    const handleAddStatus = (e: React.FormEvent) => {
        e.preventDefault();
        if (newStatusName.trim()) {
            addStatus(newStatusName.trim(), newStatusColor);
            setNewStatusName('');
            setNewStatusColor('#cccccc');
        }
    };

    const handleStartEdit = (status: StatusDefinition) => {
        setEditingStatusId(status.id);
        setEditedStatusData({ name: status.name, color: status.color });
    };

    const handleSaveEdit = () => {
        if (editingStatusId && editedStatusData.name.trim()) {
            updateStatus({ id: editingStatusId, ...editedStatusData, order: currentStatuses.find(s => s.id === editingStatusId)?.order ?? 0 });
            setEditingStatusId(null);
        }
    };

    const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, name: string } | null>(null);

    const handleDeleteStatus = (id: string) => {
        deleteStatus(id);
        setDeleteConfirmation(null);
    };

    return (
        <div className="space-y-6 relative">
            <ModuleVisibilityCheckboxes moduleKey="statuses" label="סטטוסים" />
            {deleteConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-2 dark:text-white">מחיקת סטטוס</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            הסטטוס <strong>"{deleteConfirmation.name}"</strong> נמצא בשימוש.
                            <br />
                            במידה ויש כפילויות, בטוח למחוק את המיותרים.
                            <br />
                            האם אתה בטוח שברצונך למחוק?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirmation(null)}
                                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={() => handleDeleteStatus(deleteConfirmation.id)}
                                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium shadow-md shadow-red-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                מחק
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div>
                <h3 className="text-lg font-medium mb-2">סטטוסים קיימים</h3>
                {currentStatuses.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={currentStatuses.map(s => s.id)} strategy={verticalListSortingStrategy}>
                            <ul className="space-y-2 max-h-96 overflow-y-auto pr-2 hide-scrollbar">
                                {currentStatuses.map(status => (
                                    <SortableStatusItem
                                        key={status.id}
                                        status={status}
                                        isEditing={editingStatusId === status.id}
                                        onStartEdit={handleStartEdit}
                                        onSaveEdit={handleSaveEdit}
                                        onCancelEdit={() => setEditingStatusId(null)}
                                        onDelete={() => {
                                            if (statusInUseMap.has(status.name)) {
                                                setDeleteConfirmation({ id: status.id, name: status.name });
                                            } else {
                                                deleteStatus(status.id);
                                            }
                                        }}
                                        editedData={editedStatusData}
                                        setEditedData={setEditedStatusData}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                ) : <p className="text-gray-500">אין סטטוסים.</p>}
            </div>
            <form onSubmit={handleAddStatus} className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium mb-2">הוספת סטטוס חדש</h3>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                        type="color"
                        value={newStatusColor}
                        onChange={(e) => setNewStatusColor(e.target.value)}
                        className="p-1 h-10 w-full sm:w-12 block bg-white border border-gray-200 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none dark:bg-base-950 dark:border-white/10"
                    />
                    <input
                        type="text"
                        placeholder="שם הסטטוס"
                        value={newStatusName}
                        onChange={(e) => setNewStatusName(e.target.value)}
                        required
                        className="w-full sm:w-auto flex-grow px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
                    />
                    <button type="submit" className="w-full sm:w-auto px-4 py-2 rounded bg-primary text-white hover:bg-opacity-90">הוסף סטטוס</button>
                </div>
            </form>
        </div>
    );
}


interface SortableFieldItemProps {
    field: CustomFieldDefinition;
    isEditing: boolean;
    onStartEdit: (field: CustomFieldDefinition) => void;
    onSaveEdit: (field: CustomFieldDefinition) => void;
    onCancelEdit: () => void;
    onDelete: (id: string) => void;
    editedData: Omit<CustomFieldDefinition, 'id' | 'type' | 'order'>;
    setEditedData: React.Dispatch<React.SetStateAction<Omit<CustomFieldDefinition, 'id' | 'type' | 'order'>>>;
}

const SortableFieldItem: React.FC<SortableFieldItemProps> = ({ field, isEditing, onStartEdit, onSaveEdit, onCancelEdit, onDelete, editedData, setEditedData }) => {
    const { entityLabels } = useAppContext();
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const systemDef = SYSTEM_FIELD_DEFINITIONS.find(sf => sf.id === field.id);
    const isSystem = !!systemDef;
    // Reorder-only system fields (status / labels / user / lead-source / name)
    // can only be dragged to change their order on the card. Their visibility is
    // managed in the matching module settings, so we hide the edit/show-hide and
    // the (misleading) type chip for them.
    const isReorderOnly = !!systemDef?.reorderOnly;

    return (
        <li ref={setNodeRef} style={style} className="bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-3 rounded-xl shadow-sm flex items-center gap-2">
            <div {...attributes} {...listeners}><DragHandle /></div>
            {isEditing && !isReorderOnly ? (
                <div className="flex-grow space-y-2">
                    <input
                        type="text"
                        name="name"
                        value={editedData.name}
                        onChange={e => setEditedData(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
                        disabled={SYSTEM_FIELD_DEFINITIONS.some(sf => sf.id === field.id)}
                    />
                    <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" name="showInGrid" checked={editedData.showInGrid} onChange={e => setEditedData(p => ({ ...p, showInGrid: e.target.checked }))} className="rounded text-primary focus:ring-primary" />
                            <span>הצג בגריד</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" name="showInList" checked={editedData.showInList} onChange={e => setEditedData(p => ({ ...p, showInList: e.target.checked }))} className="rounded text-primary focus:ring-primary" />
                            <span>הצג ברשימה</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" name="showInCard" checked={editedData.showInCard} onChange={e => setEditedData(p => ({ ...p, showInCard: e.target.checked }))} className="rounded text-primary focus:ring-primary" />
                            <span>{entityLabels.showInCard}</span>
                        </label>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                        <button onClick={onCancelEdit} className="text-sm px-2 py-1 rounded bg-gray-300 dark:bg-gray-600">ביטול</button>
                        <button onClick={() => onSaveEdit(field)} className="text-sm px-2 py-1 rounded bg-primary text-white">שמור</button>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex justify-between items-center">
                    <div>
                        <span className="font-semibold">{field.name}</span>
                        {!isReorderOnly && <span className="text-xs text-gray-500 dark:text-gray-400 mr-2 bg-gray-200/50 dark:bg-white/10 px-2 py-0.5 rounded-full">{field.type}</span>}
                        {isSystem && <span className="text-xs text-blue-500 bg-blue-100/50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full mr-2">מערכת</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        {!isReorderOnly && (
                            <button onClick={() => onStartEdit(field)} className="text-primary hover:opacity-80" aria-label={`ערוך את השדה ${field.name}`}>
                                <Pencil className="w-5 h-5" />
                            </button>
                        )}
                        {!isSystem && (
                            <button onClick={() => onDelete(field.id)} className="text-red-500 hover:text-red-700" aria-label={`מחק את השדה ${field.name}`}>
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </li>
    );
};


const FieldsManager = () => {
    const { customFields, addCustomField, deleteCustomField, updateCustomField, setCustomFieldsOrder, entityLabels } = useAppContext();
    const [currentFields, setCurrentFields] = useState(customFields);
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldType, setNewFieldType] = useState<CustomFieldType>(CustomFieldType.TEXT);
    const [showInGrid, setShowInGrid] = useState(true);
    const [showInList, setShowInList] = useState(true);
    const [showInCard, setShowInCard] = useState(true);
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
    const [editedFieldData, setEditedFieldData] = useState<Omit<CustomFieldDefinition, 'id' | 'type' | 'order'>>({ name: '', showInGrid: true, showInList: true, showInCard: true });

    useEffect(() => {
        const merged = [...customFields];
        SYSTEM_FIELD_DEFINITIONS.forEach(sf => {
            const existing = merged.find(f => f.id === sf.id);
            if (!existing) {
                merged.push({
                    ...sf,
                    showInGrid: false,
                    showInList: false,
                    showInCard: true,
                    order: sf.defaultOrder,
                } as CustomFieldDefinition);
            } else {
                // Always use the canonical name/type from SYSTEM_FIELD_DEFINITIONS.
                // A system field may exist only as an order placeholder (created by a
                // previous reorder) without a name/type of its own.
                existing.name = sf.name;
                existing.type = sf.type;
            }
        });
        setCurrentFields(merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }, [customFields]);

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = currentFields.findIndex(f => f.id === active.id);
            const newIndex = currentFields.findIndex(f => f.id === over.id);
            const newOrder = arrayMove(currentFields, oldIndex, newIndex);
            setCurrentFields(newOrder);
            setCustomFieldsOrder(newOrder.map((f: CustomFieldDefinition) => f.id));
        }
    };

    const handleAddField = (e: React.FormEvent) => {
        e.preventDefault();
        if (newFieldName.trim()) {
            addCustomField({ name: newFieldName.trim(), type: newFieldType, showInGrid, showInList, showInCard });
            setNewFieldName('');
            setNewFieldType(CustomFieldType.TEXT);
            setShowInGrid(true);
            setShowInList(true);
            setShowInCard(true);
        }
    };

    const handleStartEdit = (field: CustomFieldDefinition) => {
        setEditingFieldId(field.id);
        setEditedFieldData({ name: field.name, showInGrid: field.showInGrid ?? true, showInList: field.showInList ?? true, showInCard: field.showInCard ?? true });
    };

    const handleSaveEdit = (field: CustomFieldDefinition) => {
        if (editedFieldData.name.trim()) {
            updateCustomField({ ...field, ...editedFieldData });
            setEditingFieldId(null);
        }
    };


    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium mb-2">ניהול שדות</h3>
                <p className="text-sm text-gray-500 mb-4">גרור שדות כדי לקבוע את סדר הופעתם בכרטיס הלקוח. שדות מערכת מסומנים בתווית כחולה — ניתן לשנות את סדר הצגתם, התצוגה שלהם נשלטת בהגדרות המתאימות.</p>
                {currentFields.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={currentFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                            <ul className="space-y-2 max-h-[500px] overflow-y-auto pr-2 hide-scrollbar">
                                {currentFields.map(field => (
                                    <SortableFieldItem
                                        key={field.id}
                                        field={field}
                                        isEditing={editingFieldId === field.id}
                                        onStartEdit={handleStartEdit}
                                        onSaveEdit={() => handleSaveEdit(field)}
                                        onCancelEdit={() => setEditingFieldId(null)}
                                        onDelete={() => deleteCustomField(field.id)}
                                        editedData={editedFieldData}
                                        setEditedData={setEditedFieldData}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                ) : (
                    <p className="text-gray-500">אין שדות להצגה.</p>
                )}
            </div>


            <form onSubmit={handleAddField} className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium mb-2">הוספת שדה חדש</h3>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <select
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                            className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
                        >
                            {CUSTOM_FIELD_TYPE_LIST.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="שם השדה"
                            value={newFieldName}
                            onChange={(e) => setNewFieldName(e.target.value)}
                            required
                            className="w-full sm:w-auto flex-grow px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
                        />
                        <button type="submit" className="w-full sm:w-auto px-4 py-2 rounded bg-primary text-white hover:bg-opacity-90 whitespace-nowrap">הוסף שדה</button>
                    </div>
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={showInGrid} onChange={e => setShowInGrid(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                            <span>הצג בגריד</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={showInList} onChange={e => setShowInList(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                            <span>הצג ברשימה</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={showInCard} onChange={e => setShowInCard(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                            <span>{entityLabels.showInCard}</span>
                        </label>
                    </div>
                </div>
            </form>
        </div>
    )
}

const DocumentsSettings = () => {
    const { documentTemplates, addDocumentTemplate, updateDocumentTemplate, deleteDocumentTemplate, customFields, entityLabels } = useAppContext();
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editContent, setEditContent] = useState<{ headerRight: string; headerLeft: string; body: string; showSignature: boolean; logoUrl?: string }>({ headerRight: '', headerLeft: '', body: '', showSignature: true });
    const [showFieldDropdown, setShowFieldDropdown] = useState<string | null>(null);
    const templateLogoRef = useRef<HTMLInputElement>(null);

    const handleTemplateLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            alert('הקובץ גדול מדי. הגודל המקסימלי הוא 500KB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setEditContent(prev => ({ ...prev, logoUrl: ev.target?.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const dynamicFields = useMemo(() => {
        const fields = [
            { key: entityLabels.templateNameVar, label: entityLabels.nameOf },
            { key: '{{תאריך היום}}', label: 'תאריך היום' },
        ];
        customFields.filter(f => !isSystemFieldId(f.id)).forEach(f => {
            fields.push({ key: `{{${f.name}}}`, label: f.name });
        });
        return fields;
    }, [customFields, entityLabels]);

    const insertField = (targetField: string, fieldKey: string) => {
        setEditContent(prev => ({
            ...prev,
            [targetField]: (prev as any)[targetField] + fieldKey,
        }));
        setShowFieldDropdown(null);
    };

    const FieldInsertBtn: React.FC<{ target: string }> = ({ target }) => (
        <div className="relative">
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowFieldDropdown(showFieldDropdown === target ? null : target); }}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
                <Plus className="w-3.5 h-3.5" />
                הוסף שדה
            </button>
            {showFieldDropdown === target && (
                <div className="absolute z-50 top-full left-0 mt-1 bg-white dark:bg-base-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto min-w-[200px]">
                    {dynamicFields.map(f => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); insertField(target, f.key); }}
                            className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between gap-2"
                        >
                            <span>{f.label}</span>
                            <code className="text-[10px] text-gray-400 bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{f.key}</code>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim()) {
            addDocumentTemplate({
                name: newName.trim(),
                content: { headerRight: '', headerLeft: '', body: '', showSignature: true },
                createdAt: Date.now(),
            });
            setNewName('');
        }
    };

    const handleStartEdit = (t: any) => {
        setEditingId(t.id);
        setEditName(t.name);
        setEditContent({ headerRight: t.content?.headerRight || '', headerLeft: t.content?.headerLeft || '', body: t.content?.body || '', showSignature: t.content?.showSignature ?? true, logoUrl: t.content?.logoUrl || undefined });
    };

    const handleSaveEdit = (t: any) => {
        updateDocumentTemplate({ ...t, name: editName, content: editContent });
        setEditingId(null);
    };

    return (
        <div className="space-y-6 px-1" onClick={() => setShowFieldDropdown(null)}>
            <ModuleVisibilityCheckboxes moduleKey="documents" label="מסמכים" allowToggle={true} />
            <div>
                <h3 className="text-lg font-medium mb-2">תבניות מסמכים</h3>
                <p className="text-sm text-gray-500 mb-4">תבניות מאפשרות ליצור מסמכים במהירות עם תוכן מוכן מראש.</p>
                {documentTemplates.length > 0 ? (
                    <ul className="space-y-3 max-h-[600px] overflow-y-auto pr-2 hide-scrollbar">
                        {documentTemplates.map(t => (
                            <li key={t.id} className="bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 rounded-xl shadow-sm">
                                {editingId === t.id ? (
                                    <div className="space-y-3" onClick={e => e.stopPropagation()}>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">שם התבנית</label>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="w-full px-3 py-2 border rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white border-gray-200 dark:border-white/10"
                                            />
                                        </div>
                                        {/* Logo Upload */}
                                        <div>
                                            <label className="block text-sm font-medium mb-1">לוגו</label>
                                            <div className="flex items-center gap-3">
                                                {editContent.logoUrl ? (
                                                    <div className="flex items-center gap-3 p-2 bg-gray-50/50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                                                        <img src={editContent.logoUrl} alt="Logo" className="h-10 max-w-[120px] object-contain" />
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditContent(p => ({ ...p, logoUrl: undefined }))}
                                                            className="text-red-500 hover:text-red-700 p-1"
                                                            title="הסר לוגו"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => templateLogoRef.current?.click()}
                                                        className="flex items-center gap-2 px-3 py-2 bg-gray-50/50 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/20 rounded-xl hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors text-sm text-gray-600 dark:text-gray-400"
                                                    >
                                                        <Image className="w-4 h-4" />
                                                        העלה לוגו
                                                    </button>
                                                )}
                                                <input ref={templateLogoRef} type="file" accept="image/*" onChange={handleTemplateLogoUpload} className="hidden" />
                                            </div>
                                            <p className="text-[11px] text-gray-400 mt-1">PNG או JPG, עד 500KB</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-medium">צד ימין (עליון)</label>
                                                <FieldInsertBtn target="headerRight" />
                                            </div>
                                            <textarea
                                                value={editContent.headerRight}
                                                onChange={e => setEditContent(p => ({ ...p, headerRight: e.target.value }))}
                                                rows={2}
                                                placeholder="שם העסק, כתובת, טלפון..."
                                                className="w-full px-3 py-2 border rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white border-gray-200 dark:border-white/10 resize-none"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-medium">צד שמאל (עליון)</label>
                                                <FieldInsertBtn target="headerLeft" />
                                            </div>
                                            <textarea
                                                value={editContent.headerLeft}
                                                onChange={e => setEditContent(p => ({ ...p, headerLeft: e.target.value }))}
                                                rows={2}
                                                placeholder="תאריך, מספר מסמך..."
                                                className="w-full px-3 py-2 border rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white border-gray-200 dark:border-white/10 resize-none"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-medium">גוף המסמך</label>
                                                <FieldInsertBtn target="body" />
                                            </div>
                                            <textarea
                                                value={editContent.body}
                                                onChange={e => setEditContent(p => ({ ...p, body: e.target.value }))}
                                                rows={5}
                                                placeholder={`תוכן המסמך... ניתן להשתמש בשדות דינאמיים כמו ${entityLabels.templateNameVar}`}
                                                className="w-full px-3 py-2 border rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white border-gray-200 dark:border-white/10 resize-none"
                                            />
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={editContent.showSignature}
                                                onChange={e => setEditContent(p => ({ ...p, showSignature: e.target.checked }))}
                                                className="rounded text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm">הצג אזור חתימה</span>
                                        </label>
                                        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100 dark:border-white/5">
                                            <button onClick={() => setEditingId(null)} className="text-sm px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">ביטול</button>
                                            <button onClick={() => handleSaveEdit(t)} className="text-sm px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-opacity-90 transition-colors">שמור תבנית</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-primary" />
                                            <span className="font-semibold">{t.name}</span>
                                            <span className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString('he-IL')}</span>
                                            {t.content?.body && <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">יש תוכן</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleStartEdit(t)} className="text-primary hover:opacity-80" title="ערוך תבנית"><Pencil className="w-5 h-5" /></button>
                                            <button onClick={() => { if(window.confirm('למחוק תבנית זו?')) deleteDocumentTemplate(t.id); }} className="text-red-500 hover:text-red-700" title="מחק תבנית"><Trash2 className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-gray-500">אין תבניות עדיין. צור תבנית חדשה למטה.</p>}
            </div>
            <form onSubmit={handleAdd} className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium mb-2">הוספת תבנית חדשה</h3>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                        type="text"
                        placeholder="שם התבנית"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        required
                        className="w-full sm:w-auto flex-grow px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-base-950/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
                    />
                    <button type="submit" className="w-full sm:w-auto px-4 py-2 rounded bg-primary text-white hover:bg-opacity-90">הוסף תבנית</button>
                </div>
            </form>
        </div>
    );
};

const EmailModuleToggle: React.FC = () => {
    const { visibilitySettings, updateVisibilitySettings } = useAppContext();
    const current = visibilitySettings.email;
    const enabled = current.enabled ?? false;

    const handleToggle = (value: boolean) => {
        updateVisibilitySettings({
            ...visibilitySettings,
            email: { ...current, enabled: value },
        });
    };

    return (
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-500/20 rounded-xl p-4 mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input
                        type="checkbox"
                        name="toggle-email"
                        id="toggle-email"
                        checked={enabled}
                        onChange={e => handleToggle(e.target.checked)}
                        className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out focus:outline-none focus:ring-0 focus:ring-offset-0"
                        style={{
                            transform: enabled ? 'translateX(-100%)' : 'translateX(0)',
                            borderColor: enabled ? '#3b82f6' : '#d1d5db',
                            backgroundColor: enabled ? '#3b82f6' : '#fff',
                            right: 0
                        }}
                    />
                    <label
                        htmlFor="toggle-email"
                        className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${enabled ? 'bg-blue-200 dark:bg-blue-900' : 'bg-gray-300 dark:bg-gray-600'}`}
                    ></label>
                </div>
                <span className="text-gray-900 dark:text-gray-100 font-bold">הפעל מודול אימייל</span>
            </label>
        </div>
    );
};

export const ManageFieldsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'fields' | 'statuses' | 'labels' | 'leadSources' | 'automations' | 'team' | 'ai' | 'meetings' | 'documents' | 'whatsapp' | 'email' | 'tasks' | 'system'>('fields');
    const { blockedModules } = useAppContext();
    const isBlocked = (key: string) => blockedModules.includes(key);

    // If the currently open tab gets blocked, fall back to the always-available fields tab.
    useEffect(() => {
        if (isBlocked(activeTab)) setActiveTab('fields');
    }, [blockedModules, activeTab]);

    return (
        <div className="p-2 sm:p-6 h-full flex flex-col overflow-x-hidden">
            <h1 className="text-lg font-bold mb-2 pt-2 sm:pt-0 text-gray-800 dark:text-gray-100 px-2 sm:px-0">הגדרות מערכת</h1>
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto hide-scrollbar -mx-2 px-4 sm:mx-0 sm:px-0">
                <nav className="flex -mb-px space-x-4 space-x-reverse min-w-max" aria-label="Tabs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('fields')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'fields' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        ניהול שדות
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('statuses')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'statuses' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        ניהול סטטוסים
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('labels')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'labels' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        ניהול תגיות
                    </button>
                    {!isBlocked('leadSources') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('leadSources')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'leadSources' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        מקורות הגעה
                    </button>
                    )}
                    {!isBlocked('automations') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('automations')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'automations' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        אוטומציות
                    </button>
                    )}
                    {!isBlocked('team') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('team')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'team' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        ניהול צוות
                    </button>
                    )}
                    {!isBlocked('tasks') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('tasks')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'tasks' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        משימות
                    </button>
                    )}
                    {!isBlocked('ai') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('ai')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'ai' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        הגדרות AI
                    </button>
                    )}
                    {!isBlocked('documents') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('documents')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'documents' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        מסמכים
                    </button>
                    )}
                    {!isBlocked('whatsapp') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('whatsapp')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'whatsapp' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        וואטסאפ
                    </button>
                    )}
                    {!isBlocked('email') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('email')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'email' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        אימייל
                    </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setActiveTab('system')}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'system' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        מערכת
                    </button>
                </nav>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden pl-4">
                {activeTab === 'fields' && <FieldsManager />}
                {activeTab === 'statuses' && <StatusManager />}
                {activeTab === 'labels' && <LabelsManager />}
                {activeTab === 'leadSources' && !isBlocked('leadSources') && <div><ModuleVisibilityCheckboxes moduleKey="leadSources" label="מקורות הגעה" /><div className="-mx-2 sm:-mx-6"><LeadSourcesPage /></div></div>}
                {activeTab === 'automations' && !isBlocked('automations') && <AutomationsPage onNavigateToTab={(tab) => setActiveTab(tab as any)} />}
                {activeTab === 'team' && !isBlocked('team') && <div><ModuleVisibilityCheckboxes moduleKey="users" label="משתמשים" /><TeamSettings /></div>}
                {activeTab === 'tasks' && !isBlocked('tasks') && <div className="p-0"><ModuleVisibilityCheckboxes moduleKey="tasks" label="משימות" allowToggle={true} /><p className="text-sm text-gray-500">הגדרות אלו קובעות היכן מודול המשימות יוצג במערכת.</p></div>}
                {activeTab === 'ai' && !isBlocked('ai') && <div><ModuleVisibilityCheckboxes moduleKey="aiSummary" label="סיכום AI" /><AISettings /></div>}
                {activeTab === 'documents' && !isBlocked('documents') && <DocumentsSettings />}
                {activeTab === 'whatsapp' && !isBlocked('whatsapp') && (
                    <div className="p-0 space-y-5">
                        <ModuleVisibilityCheckboxes moduleKey="whatsapp" label="וואטסאפ" allowToggle={true} defaultEnabled={false} />
                        <WhatsAppSettings />
                    </div>
                )}
                {activeTab === 'email' && !isBlocked('email') && (
                    <div className="p-0 space-y-5">
                        <EmailModuleToggle />
                        <EmailSettings />
                    </div>
                )}
                {activeTab === 'system' && <SystemSettings />}
            </div>
        </div>
    );
};
