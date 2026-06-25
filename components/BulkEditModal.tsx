
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useAppContext } from '../context/AppContext';
import { Client, CustomFieldType, isSystemFieldId } from '../types';
import { Check, Info } from 'lucide-react';

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedClients: Client[];
    onComplete: () => void;
}

type FieldOption = {
    id: string;
    label: string;
    type: 'status' | 'label_add' | 'label_remove' | 'label_replace' | 'assignedTo' | 'source' | 'custom';
    customFieldType?: CustomFieldType;
};

export const BulkEditModal: React.FC<BulkEditModalProps> = ({ isOpen, onClose, selectedClients, onComplete }) => {
    const { statuses, labels, teamMembers, leadSources, customFields, updateClient, triggerAutomations, entityLabels } = useAppContext();
    const [selectedField, setSelectedField] = useState<string>('');
    const [newValue, setNewValue] = useState<string>('');
    const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    const clientLabels = labels.filter(l => !l.module || l.module === 'client');

    useEffect(() => {
        if (isOpen) {
            setSelectedField('');
            setNewValue('');
            setSelectedLabelIds([]);
            setIsProcessing(false);
            setProgress(0);
        }
    }, [isOpen]);

    const fieldOptions: FieldOption[] = [
        { id: 'status', label: 'סטטוס', type: 'status' },
        { id: 'label_add', label: 'הוספת תגיות', type: 'label_add' },
        { id: 'label_remove', label: 'הסרת תגיות', type: 'label_remove' },
        { id: 'label_replace', label: 'החלפת תגיות', type: 'label_replace' },
        { id: 'assignedTo', label: 'משתמש מוקצה', type: 'assignedTo' },
        { id: 'source', label: 'מקור הגעה', type: 'source' },
        ...customFields
            .filter(f => !isSystemFieldId(f.id))
            .map(f => ({
                id: `custom_${f.id}`,
                label: f.name,
                type: 'custom' as const,
                customFieldType: f.type,
            })),
    ];

    const currentOption = fieldOptions.find(f => f.id === selectedField);

    const isLabelType = currentOption?.type === 'label_add' || currentOption?.type === 'label_remove' || currentOption?.type === 'label_replace';

    const toggleLabel = (labelId: string) => {
        setSelectedLabelIds(prev =>
            prev.includes(labelId) ? prev.filter(id => id !== labelId) : [...prev, labelId]
        );
    };

    const isColorLight = (hexColor: string) => {
        const color = (hexColor.charAt(0) === '#') ? hexColor.substring(1, 7) : hexColor;
        const r = parseInt(color.substring(0, 2), 16);
        const g = parseInt(color.substring(2, 4), 16);
        const b = parseInt(color.substring(4, 6), 16);
        return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186);
    };

    const handleApply = async () => {
        if (!currentOption) return;
        if (isLabelType && selectedLabelIds.length === 0) return;
        if (!isLabelType && !newValue && currentOption.type !== 'assignedTo') return;

        setIsProcessing(true);
        setProgress(0);

        const total = selectedClients.length;

        for (let i = 0; i < selectedClients.length; i++) {
            const client = selectedClients[i];
            let updatedClient = { ...client };

            switch (currentOption.type) {
                case 'status':
                    updatedClient.status = newValue;
                    break;
                case 'label_add':
                    updatedClient.labelIds = [...new Set([...(client.labelIds || []), ...selectedLabelIds])];
                    break;
                case 'label_remove':
                    updatedClient.labelIds = (client.labelIds || []).filter(id => !selectedLabelIds.includes(id));
                    break;
                case 'label_replace':
                    updatedClient.labelIds = [...selectedLabelIds];
                    break;
                case 'assignedTo':
                    updatedClient.assignedTo = newValue || undefined;
                    break;
                case 'source':
                    updatedClient.sourceId = newValue || undefined;
                    break;
                case 'custom': {
                    const cfId = currentOption.id.replace('custom_', '');
                    updatedClient.customFields = {
                        ...client.customFields,
                        [cfId]: newValue,
                    };
                    break;
                }
            }

            await updateClient(updatedClient);

            // Trigger automations if status changed
            if (currentOption.type === 'status' && updatedClient.status !== client.status) {
                triggerAutomations(updatedClient, updatedClient.status, client.status);
            }

            setProgress(Math.round(((i + 1) / total) * 100));
        }

        setIsProcessing(false);
        onComplete();
        onClose();
    };

    const canApply = currentOption && (
        (isLabelType && selectedLabelIds.length > 0) ||
        (!isLabelType && (newValue !== '' || currentOption.type === 'assignedTo'))
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`עריכה מרובה (${selectedClients.length} ${entityLabels.plural})`}>
            <div className="space-y-6">
                {/* Step 1: Select field */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        בחר שדה לעריכה
                    </label>
                    <select
                        value={selectedField}
                        onChange={(e) => {
                            setSelectedField(e.target.value);
                            setNewValue('');
                            setSelectedLabelIds([]);
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-base-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none cursor-pointer"
                    >
                        <option value="">-- בחר שדה --</option>
                        <optgroup label="שדות מערכת">
                            {fieldOptions.filter(f => f.type !== 'custom').map(f => (
                                <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                        </optgroup>
                        {fieldOptions.some(f => f.type === 'custom') && (
                            <optgroup label="שדות מותאמים">
                                {fieldOptions.filter(f => f.type === 'custom').map(f => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </div>

                {/* Step 2: Set new value */}
                {currentOption && (
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            ערך חדש
                        </label>

                        {/* Status selector */}
                        {currentOption.type === 'status' && (
                            <div className="flex flex-wrap gap-2">
                                {statuses.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setNewValue(s.name)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border-2 ${newValue === s.name
                                            ? 'border-primary shadow-md scale-105'
                                            : 'border-transparent hover:border-gray-200 dark:hover:border-white/10'
                                            }`}
                                        style={{
                                            backgroundColor: `${s.color}20`,
                                        }}
                                    >
                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></span>
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Label selector */}
                        {isLabelType && (
                            <div className="flex flex-wrap gap-2">
                                {clientLabels.map(l => (
                                    <button
                                        key={l.id}
                                        onClick={() => toggleLabel(l.id)}
                                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all border-2 ${selectedLabelIds.includes(l.id)
                                            ? 'border-primary shadow-md scale-105 ring-2 ring-primary/30'
                                            : 'border-transparent opacity-70 hover:opacity-100'
                                            }`}
                                        style={{
                                            backgroundColor: l.color,
                                            color: isColorLight(l.color) ? '#000' : '#FFF',
                                        }}
                                    >
                                        {selectedLabelIds.includes(l.id) && (
                                            <Check className="w-3 h-3" />
                                        )}
                                        {l.name}
                                    </button>
                                ))}
                                {clientLabels.length === 0 && (
                                    <p className="text-sm text-gray-400 italic">
                                        לא הוגדרו תגיות עדיין.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Assigned user selector */}
                        {currentOption.type === 'assignedTo' && (
                            <select
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-base-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none cursor-pointer"
                            >
                                <option value="">ללא הקצאה</option>
                                {teamMembers.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.displayName || m.email}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Lead source selector */}
                        {currentOption.type === 'source' && (
                            <select
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-base-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none cursor-pointer"
                            >
                                <option value="">ללא מקור</option>
                                {leadSources.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        )}

                        {/* Custom field input */}
                        {currentOption.type === 'custom' && (
                            <>
                                {currentOption.customFieldType === CustomFieldType.DATE ? (
                                    <input
                                        type="date"
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-base-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                    />
                                ) : currentOption.customFieldType === CustomFieldType.NUMBER ? (
                                    <input
                                        type="number"
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        placeholder="הזן מספר..."
                                        className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-base-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                    />
                                ) : (
                                    <input
                                        type={currentOption.customFieldType === CustomFieldType.EMAIL ? 'email' : currentOption.customFieldType === CustomFieldType.PHONE ? 'tel' : currentOption.customFieldType === CustomFieldType.URL ? 'url' : 'text'}
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        placeholder={`הזן ${currentOption.label}...`}
                                        dir={currentOption.customFieldType === CustomFieldType.PHONE || currentOption.customFieldType === CustomFieldType.EMAIL || currentOption.customFieldType === CustomFieldType.URL ? 'ltr' : 'rtl'}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-base-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                    />
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Processing progress */}
                {isProcessing && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>מעדכן {entityLabels.plural}...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-base-800 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-primary to-accent h-full rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* Summary */}
                {currentOption && !isProcessing && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4">
                        <div className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
                            <Info className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>
                                הפעולה תעדכן את השדה <strong>{currentOption.label}</strong> עבור <strong>{selectedClients.length}</strong> {entityLabels.plural} שנבחרו.
                            </span>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={handleApply}
                        disabled={!canApply || isProcessing}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/25 disabled:shadow-none hover:scale-[1.02] active:scale-95"
                    >
                        {isProcessing ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                מעדכן...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                עדכן {selectedClients.length} {entityLabels.plural}
                            </>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-6 py-3 bg-gray-100 dark:bg-base-800 hover:bg-gray-200 dark:hover:bg-base-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-all"
                    >
                        ביטול
                    </button>
                </div>
            </div>
        </Modal>
    );
};
