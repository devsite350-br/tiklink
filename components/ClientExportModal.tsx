import React, { useState } from 'react';
import { Client, CustomFieldDefinition, StatusDefinition } from '../types';
import { useAppContext } from '../context/AppContext';
import { Modal } from './Modal';
import { Download } from 'lucide-react';

interface ClientExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ClientExportModal: React.FC<ClientExportModalProps> = ({ isOpen, onClose }) => {
    const { clients, statuses, customFields, entityLabels } = useAppContext();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedStatusIds, setSelectedStatusIds] = useState<Set<string>>(new Set(statuses.map(s => s.id)));
    // Initialize with name, status and ALL custom fields (which typically includes phone/email)
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(['name', 'status', ...customFields.map(f => f.id)]));
    const [includeNotes, setIncludeNotes] = useState(true);

    const toggleStatus = (id: string) => {
        const newSet = new Set(selectedStatusIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedStatusIds(newSet);
    };

    // Reset selection when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setSelectedStatusIds(new Set(statuses.map(s => s.id)));
            // Select all fields including name, status, notes and all custom fields
            setSelectedFields(new Set(['name', 'status', ...customFields.map(f => f.id)]));
            setIncludeNotes(true);
        }
    }, [isOpen, statuses, customFields]);

    const toggleField = (id: string) => {
        const newSet = new Set(selectedFields);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedFields(newSet);
    };

    const handleExport = () => {
        // 1. Filter Clients
        const filteredClients = clients.filter(client => {
            // Status Filter
            const statusDef = statuses.find(s => s.name === client.status);
            if (!statusDef || !selectedStatusIds.has(statusDef.id)) return false;

            // Date Filter
            if (startDate || endDate) {
                const clientDate = client.createdAt || 0;
                if (startDate && clientDate < new Date(startDate).getTime()) return false;
                // End date should be end of day
                if (endDate) {
                    const endDateTime = new Date(endDate).getTime() + 86400000;
                    if (clientDate >= endDateTime) return false;
                }
            }
            return true;
        });

        // 2. Prepare Data
        const headers: string[] = [];
        if (selectedFields.has('name')) headers.push(entityLabels.nameOf);
        if (selectedFields.has('status')) headers.push('סטטוס');

        // Dynamic Custom Fields (Phone and Email are usually here)
        customFields.forEach(field => {
            if (selectedFields.has(field.id)) headers.push(field.name);
        });

        if (includeNotes) headers.push('הערות');
        headers.push('תאריך יצירה');


        const csvRows = [headers.join(',')];

        filteredClients.forEach(client => {
            const row: string[] = [];

            if (selectedFields.has('name')) row.push(`"${(client.name || '').replace(/"/g, '""')}"`);
            if (selectedFields.has('status')) row.push(`"${(client.status || '').replace(/"/g, '""')}"`);

            customFields.forEach(field => {
                if (selectedFields.has(field.id)) {
                    // Check field ID or Name for value. Try both ID first.
                    const val = client.customFields[field.id] !== undefined ? client.customFields[field.id] : (client.customFields[field.name] || '');
                    row.push(`"${String(val).replace(/"/g, '""')}"`);
                }
            });

            if (includeNotes) row.push(`"${(client.notes || '').replace(/"/g, '""')}"`);

            const dateStr = client.createdAt ? new Date(client.createdAt).toLocaleDateString('he-IL') : '-';
            row.push(`"${dateStr}"`);

            csvRows.push(row.join(','));
        });

        // 3. Download CSV
        // BOM for Hebrew support in Excel
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `clients_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`ייצוא ${entityLabels.plural} לאקסל`}>
            <div className="space-y-6">

                {/* Date Range */}
                <div>
                    <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">טווח תאריכים (לפי תאריך יצירה)</h3>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500">מתאריך</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full p-2 rounded-lg border dark:bg-base-700 dark:border-gray-600"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-gray-500">עד תאריך</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full p-2 rounded-lg border dark:bg-base-700 dark:border-gray-600"
                            />
                        </div>
                    </div>
                </div>

                {/* Statuses */}
                <div>
                    <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">סטטוסים</h3>
                    <div className="flex flex-wrap gap-2">
                        {statuses.map(status => (
                            <button
                                key={status.id}
                                onClick={() => toggleStatus(status.id)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all border-2 ${selectedStatusIds.has(status.id)
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-transparent bg-gray-100 dark:bg-gray-700 text-gray-500'
                                    }`}
                            >
                                {status.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Fields */}
                <div>
                    <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">עמודות לייצוא</h3>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                        <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedFields.has('name')}
                                onChange={() => toggleField('name')}
                                className="rounded text-primary focus:ring-primary"
                            />
                            <span>{entityLabels.nameOf}</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedFields.has('status')}
                                onChange={() => toggleField('status')}
                                className="rounded text-primary focus:ring-primary"
                            />
                            <span>סטטוס</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeNotes}
                                onChange={() => setIncludeNotes(!includeNotes)}
                                className="rounded text-primary focus:ring-primary"
                            />
                            <span>הערות</span>
                        </label>
                        {customFields.map(field => (
                            <label key={field.id} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedFields.has(field.id)}
                                    onChange={() => toggleField(field.id)}
                                    className="rounded text-primary focus:ring-primary"
                                />
                                <span>{field.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-white/10">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg">ביטול</button>
                    <button onClick={handleExport} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        <span>ייצא לאקסל</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};
