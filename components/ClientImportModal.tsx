import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { Client, CustomFieldType, ImportBatch } from '../types';
import * as XLSX from 'xlsx';
import { UserAvatar } from './UserAvatar';
import { Smartphone, Calendar as CalendarIcon, Link, Hash, FileText, User, FolderOpen, Eye, CheckCircle2, Check, ChevronRight, Info, AlertTriangle, Upload, X, CircleCheck, XCircle, Undo2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface SystemField {
    id: string; // '__name__' | '__status__' | '__notes__' | customField.id
    name: string;
    type: CustomFieldType | 'status' | 'notes' | 'name';
    required?: boolean;
}

interface FieldMapping {
    excelColumn: string;
    systemFieldId: string; // '' = unmapped
    defaultValue: string;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'result';

interface ValidationIssue {
    row: number;
    column: string;
    value: string;
    expectedType: string;
    message: string;
}

interface ClientImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<string, string> = {
    [CustomFieldType.TEXT]: 'טקסט',
    [CustomFieldType.EMAIL]: 'אימייל',
    [CustomFieldType.PHONE]: 'טלפון',
    [CustomFieldType.DATE]: 'תאריך',
    [CustomFieldType.URL]: 'URL',
    [CustomFieldType.NUMBER]: 'מספר',
    'status': 'סטטוס',
    'notes': 'טקסט',
    'name': 'טקסט',
};

const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
    [CustomFieldType.TEXT]: 'Aa',
    [CustomFieldType.EMAIL]: '@',
    [CustomFieldType.PHONE]: <Smartphone className="w-3.5 h-3.5" />,
    [CustomFieldType.DATE]: <CalendarIcon className="w-3.5 h-3.5" />,
    [CustomFieldType.URL]: <Link className="w-3.5 h-3.5" />,
    [CustomFieldType.NUMBER]: '#',
    'status': '◉',
    'notes': <FileText className="w-3.5 h-3.5" />,
    'name': <User className="w-3.5 h-3.5" />,
};

function parseExcelDate(value: any): string {
    if (!value) return '';
    // Excel serial date number
    if (typeof value === 'number' && value > 25569 && value < 100000) {
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }
    // Already a date string
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (!isNaN(parsed)) {
            return new Date(parsed).toISOString().split('T')[0];
        }
    }
    if (value instanceof Date) {
        return value.toISOString().split('T')[0];
    }
    return String(value);
}

function validateValue(value: any, fieldType: CustomFieldType | 'status' | 'notes' | 'name'): { valid: boolean; message?: string } {
    if (value === null || value === undefined || String(value).trim() === '') {
        return { valid: true }; // Empty is OK (will use default)
    }
    const str = String(value).trim();
    switch (fieldType) {
        case 'name':
        case 'notes':
        case CustomFieldType.TEXT:
            return { valid: true };
        case CustomFieldType.NUMBER:
            return isNaN(Number(str))
                ? { valid: false, message: `"${str}" אינו מספר תקין` }
                : { valid: true };
        case CustomFieldType.EMAIL:
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)
                ? { valid: true }
                : { valid: false, message: `"${str}" אינו כתובת אימייל תקינה` };
        case CustomFieldType.PHONE:
            return /^[\d\s\-\+\(\)\.]{5,}$/.test(str)
                ? { valid: true }
                : { valid: false, message: `"${str}" אינו מספר טלפון תקין` };
        case CustomFieldType.DATE: {
            if (typeof value === 'number' && value > 25569) return { valid: true }; // Excel date serial
            const parsed = Date.parse(str);
            return isNaN(parsed)
                ? { valid: false, message: `"${str}" אינו תאריך תקין` }
                : { valid: true };
        }
        case CustomFieldType.URL:
            try { new URL(str.startsWith('http') ? str : 'https://' + str); return { valid: true }; }
            catch { return { valid: false, message: `"${str}" אינו כתובת URL תקינה` }; }
        case 'status':
            return { valid: true }; // validated separately
        default:
            return { valid: true };
    }
}

function getTypeCompatibility(sourceValues: any[], targetType: CustomFieldType | 'status' | 'notes' | 'name'): 'full' | 'partial' | 'none' {
    const nonEmpty = sourceValues.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (nonEmpty.length === 0) return 'full';
    const validCount = nonEmpty.filter(v => validateValue(v, targetType).valid).length;
    if (validCount === nonEmpty.length) return 'full';
    if (validCount > 0) return 'partial';
    return 'none';
}

const AUTO_MAP_ALIASES: Record<string, string[]> = {
    '__name__': ['שם', 'שם לקוח', 'שם הלקוח', 'name', 'client name', 'לקוח', 'שם מלא', 'full name', 'first name', 'שם פרויקט', 'שם הפרויקט', 'פרויקט', 'project name'],
    '__status__': ['סטטוס', 'status', 'מצב', 'state'],
    '__notes__': ['הערות', 'הערה', 'notes', 'note', 'תיאור', 'description', 'comments'],
};

// ─── Sub-Components ──────────────────────────────────────────────────

const StepIndicator: React.FC<{ currentStep: ImportStep }> = ({ currentStep }) => {
    const steps: { id: ImportStep; label: string; icon: React.ReactNode }[] = [
        { id: 'upload', label: 'העלאת קובץ', icon: <FolderOpen className="w-4 h-4" /> },
        { id: 'mapping', label: 'מיפוי שדות', icon: <Link className="w-4 h-4" /> },
        { id: 'preview', label: 'תצוגה מקדימה', icon: <Eye className="w-4 h-4" /> },
        { id: 'result', label: 'סיום', icon: <CheckCircle2 className="w-4 h-4" /> },
    ];
    const currentIdx = steps.findIndex(s => s.id === currentStep);

    return (
        <div className="flex items-center justify-center gap-1 sm:gap-2 py-4 px-2">
            {steps.map((step, idx) => (
                <React.Fragment key={step.id}>
                    <div className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${idx === currentIdx
                        ? 'bg-primary/15 text-primary ring-2 ring-primary/30 shadow-sm'
                        : idx < currentIdx
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                        }`}>
                        <span>{idx < currentIdx ? <Check className="w-4 h-4" /> : step.icon}</span>
                        <span className="hidden sm:inline">{step.label}</span>
                    </div>
                    {idx < steps.length - 1 && (
                        <div className={`w-6 sm:w-10 h-0.5 rounded-full transition-colors duration-300 ${idx < currentIdx ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-white/10'
                            }`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

const ImportHistorySection: React.FC<{
    importHistory: ImportBatch[];
    onUndo: (batchId: string) => void;
    undoingId: string | null;
}> = ({ importHistory, onUndo, undoingId }) => {
    const { entityLabels } = useAppContext();
    const [isExpanded, setIsExpanded] = useState(false);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    if (importHistory.length === 0) return null;

    return (
        <div className="mt-6" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary transition-colors w-full"
            >
                <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                <span>היסטוריית ייבוא ({importHistory.length})</span>
            </button>
            {isExpanded && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {importHistory.map(batch => (
                        <div key={batch.id} className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 flex-shrink-0">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{batch.fileName}</p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(batch.timestamp).toLocaleDateString('he-IL')} · {batch.recordCount} רשומות
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        console.log('[Import] Undo button clicked for batch:', batch.id, batch.fileName);
                                        setConfirmingId(batch.id);
                                    }}
                                    disabled={undoingId === batch.id || confirmingId === batch.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all disabled:opacity-50 flex-shrink-0 mr-2"
                                >
                                    {undoingId === batch.id ? (
                                        <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Undo2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>{undoingId === batch.id ? 'מוחק...' : 'ביטול ייבוא'}</span>
                                </button>
                            </div>
                            {/* Inline confirmation */}
                            {confirmingId === batch.id && (
                                <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
                                    <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                                        האם אתה בטוח? פעולה זו תמחק <strong>{batch.recordCount}</strong> {entityLabels.plural} שיובאו מ-"{batch.fileName}".
                                    </p>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setConfirmingId(null); }}
                                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-base-800 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg border border-gray-200 dark:border-white/10 transition-colors"
                                        >
                                            ביטול
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                console.log('[Import] Confirming undo for batch:', batch.id);
                                                setConfirmingId(null);
                                                onUndo(batch.id);
                                            }}
                                            className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                                        >
                                            כן, מחק {batch.recordCount} {entityLabels.plural}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────

export const ClientImportModal: React.FC<ClientImportModalProps> = ({ isOpen, onClose }) => {
    const { customFields, statuses, importHistory, bulkAddClients, undoImport, clients, teamMembers, entityLabels } = useAppContext();

    // State
    const [step, setStep] = useState<ImportStep>('upload');
    const [fileName, setFileName] = useState('');
    const [excelData, setExcelData] = useState<any[][]>([]);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<FieldMapping[]>([]);
    const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
    const [skipDuplicates, setSkipDuplicates] = useState(false);
    const [defaultStatus, setDefaultStatus] = useState('');
    const [defaultAssignedTo, setDefaultAssignedTo] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: boolean; count: number; skipped: number; errors: string[] } | null>(null);
    const [undoingId, setUndoingId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // System fields list
    const systemFields = useMemo<SystemField[]>(() => {
        const fields: SystemField[] = [
            { id: '__name__', name: entityLabels.nameOf, type: 'name', required: true },
            { id: '__status__', name: 'סטטוס', type: 'status' },
            { id: '__notes__', name: 'הערות', type: 'notes' },
        ];
        customFields.forEach(cf => {
            fields.push({ id: cf.id, name: cf.name, type: cf.type });
        });
        return fields;
    }, [customFields, entityLabels]);

    // Actual data rows (excluding header if needed)
    const dataRows = useMemo(() => {
        if (excelData.length === 0) return [];
        return firstRowIsHeader ? excelData.slice(1) : excelData;
    }, [excelData, firstRowIsHeader]);

    // Reset when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep('upload');
            setFileName('');
            setExcelData([]);
            setExcelHeaders([]);
            setMappings([]);
            setFirstRowIsHeader(true);
            setSkipDuplicates(false);
            setDefaultStatus(statuses[0]?.name || '');
            setDefaultAssignedTo('');
            setImportResult(null);
            setIsImporting(false);
        }
    }, [isOpen, statuses]);

    // Auto-map fields
    const autoMapFields = useCallback((headers: string[]) => {
        const newMappings: FieldMapping[] = headers.map(header => {
            const headerLower = header.toLowerCase().trim();
            // Try exact match first
            const exactMatch = systemFields.find(sf => sf.name.toLowerCase() === headerLower);
            if (exactMatch) return { excelColumn: header, systemFieldId: exactMatch.id, defaultValue: '' };
            // Try alias match
            for (const [fieldId, aliases] of Object.entries(AUTO_MAP_ALIASES)) {
                if (aliases.some(a => a.toLowerCase() === headerLower || headerLower.includes(a.toLowerCase()))) {
                    return { excelColumn: header, systemFieldId: fieldId, defaultValue: '' };
                }
            }
            // Try partial match on custom fields
            const partialMatch = customFields.find(cf =>
                cf.name.toLowerCase().includes(headerLower) || headerLower.includes(cf.name.toLowerCase())
            );
            if (partialMatch) return { excelColumn: header, systemFieldId: partialMatch.id, defaultValue: '' };
            return { excelColumn: header, systemFieldId: '', defaultValue: '' };
        });
        setMappings(newMappings);
    }, [systemFields, customFields]);

    // Parse file
    const handleFile = useCallback((file: File) => {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

                if (jsonData.length === 0) {
                    alert('הקובץ ריק.');
                    return;
                }

                // Clean empty trailing rows
                const cleanedData = jsonData.filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined));

                setExcelData(cleanedData);
                const headers = cleanedData[0].map((h: any, i: number) => String(h || `עמודה ${i + 1}`));
                setExcelHeaders(headers);
                autoMapFields(headers);
                setStep('mapping');
            } catch (err) {
                alert('שגיאה בקריאת הקובץ. ודא שהקובץ בפורמט Excel תקין.');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    }, [autoMapFields]);

    // Drag & Drop
    const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
    const onDragLeave = useCallback(() => setIsDragging(false), []);
    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    // Update mapping
    const updateMapping = (index: number, field: keyof FieldMapping, value: string) => {
        setMappings(prev => {
            const updated = [...prev];
            // If assigning a system field, clear it from other mappings first (prevent duplicates)
            if (field === 'systemFieldId' && value) {
                updated.forEach((m, i) => {
                    if (i !== index && m.systemFieldId === value) {
                        updated[i] = { ...m, systemFieldId: '' };
                    }
                });
            }
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // Get sample values for a column
    const getSampleValues = (colIndex: number): any[] => {
        return dataRows.slice(0, 3).map(row => row[colIndex]).filter(v => v !== '' && v !== null && v !== undefined);
    };

    // Validation
    const validationIssues = useMemo<ValidationIssue[]>(() => {
        const issues: ValidationIssue[] = [];
        mappings.forEach((mapping, colIdx) => {
            if (!mapping.systemFieldId) return;
            const field = systemFields.find(f => f.id === mapping.systemFieldId);
            if (!field) return;
            dataRows.forEach((row, rowIdx) => {
                const value = row[colIdx];
                const result = validateValue(value, field.type);
                if (!result.valid) {
                    issues.push({
                        row: rowIdx + 1 + (firstRowIsHeader ? 1 : 0),
                        column: mapping.excelColumn,
                        value: String(value),
                        expectedType: FIELD_TYPE_LABELS[field.type] || String(field.type),
                        message: result.message || '',
                    });
                }
            });
        });
        return issues;
    }, [mappings, dataRows, systemFields, firstRowIsHeader]);

    // Check if name field is mapped
    const isNameMapped = mappings.some(m => m.systemFieldId === '__name__');

    // Build preview data
    const previewClients = useMemo(() => {
        return dataRows.slice(0, 10).map((row, idx) => {
            const client: Record<string, any> = { _rowNum: idx + 1 };
            mappings.forEach((mapping, colIdx) => {
                if (!mapping.systemFieldId) return;
                const field = systemFields.find(f => f.id === mapping.systemFieldId);
                if (!field) return;
                let value = row[colIdx];
                // Use default if empty
                if (value === '' || value === null || value === undefined) {
                    value = mapping.defaultValue;
                }
                // Also use default if value is invalid
                if (value !== '' && value !== null && value !== undefined) {
                    const validation = validateValue(value, field.type);
                    if (!validation.valid && mapping.defaultValue) {
                        value = mapping.defaultValue;
                    }
                }
                client[field.name] = value;
            });
            return client;
        });
    }, [dataRows, mappings, systemFields]);

    // Count duplicates
    const duplicateCount = useMemo(() => {
        if (!skipDuplicates || !isNameMapped) return 0;
        const nameColIdx = mappings.findIndex(m => m.systemFieldId === '__name__');
        if (nameColIdx === -1) return 0;
        const existingNames = new Set(clients.map(c => c.name.toLowerCase().trim()));
        return dataRows.filter(row => {
            const name = String(row[nameColIdx] || '').toLowerCase().trim();
            return name && existingNames.has(name);
        }).length;
    }, [skipDuplicates, isNameMapped, mappings, dataRows, clients]);

    // Execute import
    const handleImport = async () => {
        setIsImporting(true);
        try {
            const nameColIdx = mappings.findIndex(m => m.systemFieldId === '__name__');
            const existingNames = skipDuplicates ? new Set(clients.map(c => c.name.toLowerCase().trim())) : new Set<string>();

            const clientsToImport: Omit<Client, 'id'>[] = [];
            let skippedCount = 0;

            dataRows.forEach(row => {
                // Get name
                let name = '';
                if (nameColIdx !== -1) {
                    name = String(row[nameColIdx] || '').trim();
                    if (!name) {
                        const defaultName = mappings[nameColIdx]?.defaultValue;
                        name = defaultName || '';
                    }
                }
                if (!name) {
                    skippedCount++;
                    return;
                }

                // Skip duplicates
                if (skipDuplicates && existingNames.has(name.toLowerCase())) {
                    skippedCount++;
                    return;
                }

                let status = defaultStatus || statuses[0]?.name || '';
                let notes = '';
                const customFieldValues: Record<string, any> = {};

                mappings.forEach((mapping, colIdx) => {
                    if (!mapping.systemFieldId) return;
                    const field = systemFields.find(f => f.id === mapping.systemFieldId);
                    if (!field) return;

                    let value: any = row[colIdx];
                    // Use default if empty or invalid
                    if (value === '' || value === null || value === undefined) {
                        value = mapping.defaultValue || '';
                    } else {
                        const validation = validateValue(value, field.type);
                        if (!validation.valid) {
                            value = mapping.defaultValue || value; // prefer default, fallback to original
                        }
                    }

                    switch (mapping.systemFieldId) {
                        case '__name__':
                            // Already handled above
                            break;
                        case '__status__': {
                            const matchedStatus = statuses.find(s => s.name === String(value).trim());
                            if (matchedStatus) status = matchedStatus.name;
                            break;
                        }
                        case '__notes__':
                            notes = String(value || '');
                            break;
                        default:
                            // Custom field - convert dates properly
                            if (field.type === CustomFieldType.DATE) {
                                customFieldValues[mapping.systemFieldId] = parseExcelDate(value);
                            } else if (field.type === CustomFieldType.NUMBER) {
                                customFieldValues[mapping.systemFieldId] = value !== '' ? Number(value) : '';
                            } else {
                                customFieldValues[mapping.systemFieldId] = String(value || '');
                            }
                    }
                });

                clientsToImport.push({
                    name,
                    status,
                    notes,
                    tasks: [],
                    comments: [],
                    customFields: customFieldValues,
                    labelIds: [],
                    createdAt: Date.now(),
                    sourceId: '__import__',
                    ...(defaultAssignedTo ? { assignedTo: defaultAssignedTo } : {}),
                });
            });

            if (clientsToImport.length === 0) {
                setImportResult({ success: false, count: 0, skipped: skippedCount, errors: ['לא נמצאו רשומות תקינות לייבוא.'] });
                setStep('result');
                setIsImporting(false);
                return;
            }

            await bulkAddClients(clientsToImport, fileName);
            setImportResult({ success: true, count: clientsToImport.length, skipped: skippedCount, errors: [] });
            setStep('result');
        } catch (err: any) {
            setImportResult({ success: false, count: 0, skipped: 0, errors: [err.message || 'שגיאה לא צפויה'] });
            setStep('result');
        } finally {
            setIsImporting(false);
        }
    };

    // Undo handler
    const handleUndo = async (batchId: string) => {
        console.log('[Import] handleUndo called with batchId:', batchId);
        setUndoingId(batchId);
        try {
            await undoImport(batchId);
            console.log('[Import] undoImport completed successfully for:', batchId);
        } catch (err: any) {
            console.error('[Import] undoImport failed:', err);
            alert(`שגיאה בביטול הייבוא: ${err.message}`);
        } finally {
            setUndoingId(null);
        }
    };

    const handleClose = () => {
        if (isImporting) return; // Don't close during import
        onClose();
    };

    if (!isOpen) return null;

    // ─── Render Steps ────────────────────────────────────────────────

    const renderUploadStep = () => (
        <div className="space-y-5">
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 group ${isDragging
                    ? 'border-primary bg-primary/5 scale-[1.02]'
                    : 'border-gray-200 dark:border-white/10 hover:border-primary/50 hover:bg-primary/5'
                    }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    גרור קובץ לכאן או לחץ לבחירה
                </h3>
                <p className="text-sm text-gray-400">
                    פורמטים נתמכים: Excel (.xlsx, .xls), CSV
                </p>
            </div>

            <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-800/20">
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                    <Info className="w-4 h-4" />
                    טיפים לייבוא מוצלח
                </h4>
                <ul className="text-xs text-blue-600/80 dark:text-blue-400/80 space-y-1 list-disc pr-4">
                    <li>ודא שהשורה הראשונה מכילה כותרות עמודות</li>
                    <li>עמודת "שם" חובה - לא ניתן לייבא {entityLabels.singular} ללא שם</li>
                    <li>המערכת תזהה אוטומטית שדות מוכרים כמו טלפון, אימייל וכו׳</li>
                    <li>ניתן להגדיר ערכי ברירת מחדל לשדות ריקים</li>
                </ul>
            </div>

            <ImportHistorySection
                importHistory={importHistory}
                onUndo={handleUndo}
                undoingId={undoingId}
            />
        </div>
    );

    const renderMappingStep = () => {
        const mappedFields = mappings.filter(m => m.systemFieldId);

        return (
            <div className="space-y-5">
                {/* File info bar */}
                <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-xl p-3 border border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{fileName}</p>
                            <p className="text-xs text-gray-400">{dataRows.length} שורות נתונים · {excelHeaders.length} עמודות</p>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={firstRowIsHeader}
                            onChange={(e) => setFirstRowIsHeader(e.target.checked)}
                            className="rounded text-primary focus:ring-primary"
                        />
                        <span className="text-gray-600 dark:text-gray-400">השורה הראשונה היא כותרות</span>
                    </label>
                </div>

                {/* Mapping table */}
                <div className="rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_1fr_1fr] bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
                        <div className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">שדה באקסל</div>
                        <div className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">שדה במערכת</div>
                        <div className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ערך ברירת מחדל</div>
                    </div>
                    {/* Table rows */}
                    <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-[340px] overflow-y-auto">
                        {mappings.map((mapping, idx) => {
                            const selectedField = systemFields.find(f => f.id === mapping.systemFieldId);
                            const colValues = getSampleValues(idx);
                            const compatibility = selectedField
                                ? getTypeCompatibility(colValues, selectedField.type)
                                : null;

                            return (
                                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr] items-start hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                    {/* Excel column */}
                                    <div className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{mapping.excelColumn}</span>
                                            {compatibility && (
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${compatibility === 'full' ? 'bg-emerald-400' :
                                                    compatibility === 'partial' ? 'bg-amber-400' : 'bg-red-400'
                                                    }`} title={
                                                        compatibility === 'full' ? 'כל הערכים תואמים' :
                                                            compatibility === 'partial' ? 'חלק מהערכים לא תואמים' : 'הערכים לא תואמים לסוג השדה'
                                                    } />
                                            )}
                                        </div>
                                        {colValues.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {colValues.map((v, i) => (
                                                    <span key={i} className="inline-block text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-white/5 rounded text-gray-500 dark:text-gray-400 max-w-[120px] truncate">
                                                        {v instanceof Date ? v.toLocaleDateString('he-IL') : String(v)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* System field dropdown */}
                                    <div className="px-4 py-3">
                                        <select
                                            value={mapping.systemFieldId}
                                            onChange={(e) => updateMapping(idx, 'systemFieldId', e.target.value)}
                                            className={`w-full text-sm p-2 rounded-lg border transition-colors ${mapping.systemFieldId
                                                ? 'border-primary/30 bg-primary/5 dark:bg-primary/10 text-gray-800 dark:text-gray-200'
                                                : 'border-gray-200 dark:border-white/10 bg-white dark:bg-base-800 text-gray-400'
                                                }`}
                                        >
                                            <option value="">— לא ממופה —</option>
                                            {systemFields.map(field => {
                                                const alreadyMapped = mappings.some(m => m.systemFieldId === field.id && m.excelColumn !== mapping.excelColumn);
                                                return (
                                                    <option key={field.id} value={field.id} disabled={alreadyMapped}>
                                                        {FIELD_TYPE_ICONS[field.type]} {field.name} ({FIELD_TYPE_LABELS[field.type]})
                                                        {field.required ? ' *' : ''}
                                                        {alreadyMapped ? ' ✓' : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {selectedField && (
                                            <div className="mt-1 flex items-center gap-1">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${compatibility === 'full'
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                                    : compatibility === 'partial'
                                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                                    }`}>
                                                    {compatibility === 'full' ? '✓ תואם' : compatibility === 'partial' ? '⚠ תואם חלקית' : '✗ לא תואם'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Default value */}
                                    <div className="px-4 py-3">
                                        {selectedField ? (
                                            selectedField.type === 'status' ? (
                                                <select
                                                    value={mapping.defaultValue}
                                                    onChange={(e) => updateMapping(idx, 'defaultValue', e.target.value)}
                                                    className="w-full text-sm p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-base-800 text-gray-700 dark:text-gray-300"
                                                >
                                                    <option value="">— ללא —</option>
                                                    {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    type={
                                                        selectedField.type === CustomFieldType.NUMBER ? 'number' :
                                                            selectedField.type === CustomFieldType.EMAIL ? 'email' :
                                                                selectedField.type === CustomFieldType.DATE ? 'date' :
                                                                    selectedField.type === CustomFieldType.URL ? 'url' :
                                                                        'text'
                                                    }
                                                    value={mapping.defaultValue}
                                                    onChange={(e) => updateMapping(idx, 'defaultValue', e.target.value)}
                                                    placeholder="ערך ברירת מחדל..."
                                                    className="w-full text-sm p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-base-800 text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600"
                                                />
                                            )
                                        ) : (
                                            <span className="text-xs text-gray-300 dark:text-gray-600 italic">בחר שדה תחילה</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">סטטוס ברירת מחדל</label>
                        <select
                            value={defaultStatus}
                            onChange={(e) => setDefaultStatus(e.target.value)}
                            className="w-full text-sm p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-base-800 text-gray-700 dark:text-gray-300"
                        >
                            {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">משתמש ברירת מחדל</label>
                        <select
                            value={defaultAssignedTo}
                            onChange={(e) => setDefaultAssignedTo(e.target.value)}
                            className="w-full text-sm p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-base-800 text-gray-700 dark:text-gray-300"
                        >
                            <option value="">— ללא הקצאה —</option>
                            {teamMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.displayName || m.email}</option>
                            ))}
                        </select>
                        {defaultAssignedTo && (() => {
                            const member = teamMembers.find(m => m.id === defaultAssignedTo);
                            return member ? (
                                <div className="flex items-center gap-2 mt-2">
                                    <UserAvatar name={member.displayName || member.email || ''} photoUrl={member.photoUrl} size="xs" />
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{member.displayName || member.email}</span>
                                </div>
                            ) : null;
                        })()}
                    </div>
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/5">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={skipDuplicates}
                                onChange={(e) => setSkipDuplicates(e.target.checked)}
                                className="rounded text-primary focus:ring-primary"
                            />
                            <span className="font-medium text-gray-700 dark:text-gray-300">דלג על כפילויות</span>
                        </label>
                        <p className="text-xs text-gray-400 mt-1">זיהוי לפי שם {entityLabels.singular} זהה</p>
                    </div>
                </div>

                {/* Summary bar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                            <span className="font-medium text-gray-700 dark:text-gray-200">{mappedFields.length}</span> שדות ממופים
                        </span>
                        {!isNameMapped && (
                            <span className="text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                חובה למפות "{entityLabels.nameOf}"
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setStep('upload')}
                            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                        >
                            חזרה
                        </button>
                        <button
                            onClick={() => setStep('preview')}
                            disabled={!isNameMapped}
                            className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            תצוגה מקדימה
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderPreviewStep = () => {
        const mappedFields = mappings.filter(m => m.systemFieldId);
        const mappedSystemFields = mappedFields.map(m => systemFields.find(f => f.id === m.systemFieldId)!).filter(Boolean);
        const errorCount = validationIssues.length;
        const willImport = dataRows.length - duplicateCount;

        return (
            <div className="space-y-5">
                {/* Stats cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3 text-center border border-emerald-100 dark:border-emerald-800/20">
                        <div className="text-2xl font-bold text-emerald-600">{willImport}</div>
                        <div className="text-xs text-emerald-500">רשומות לייבוא</div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 text-center border border-amber-100 dark:border-amber-800/20">
                        <div className="text-2xl font-bold text-amber-600">{errorCount}</div>
                        <div className="text-xs text-amber-500">ערכים לא תקינים</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 text-center border border-blue-100 dark:border-blue-800/20">
                        <div className="text-2xl font-bold text-blue-600">{duplicateCount}</div>
                        <div className="text-xs text-blue-500">כפילויות (ידולגו)</div>
                    </div>
                </div>

                {/* Validation warnings */}
                {errorCount > 0 && (
                    <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-800/20">
                        <h4 className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            {errorCount} ערכים לא תואמים לסוג השדה
                        </h4>
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mb-2">
                            ערכים לא תקינים יוחלפו בערך ברירת מחדל (אם הוגדר), או ייובאו כמות שהם.
                        </p>
                        <div className="max-h-24 overflow-y-auto space-y-1">
                            {validationIssues.slice(0, 10).map((issue, i) => (
                                <div key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2 bg-amber-100/50 dark:bg-amber-800/10 rounded px-2 py-1">
                                    <span className="font-mono text-[10px] bg-amber-200/50 dark:bg-amber-700/20 px-1 rounded">שורה {issue.row}</span>
                                    <span>{issue.column}: {issue.message}</span>
                                </div>
                            ))}
                            {validationIssues.length > 10 && (
                                <p className="text-xs text-amber-500">ועוד {validationIssues.length - 10} שגיאות...</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Preview table */}
                <div className="rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden">
                    <div className="bg-gray-50 dark:bg-white/5 px-4 py-2 border-b border-gray-100 dark:border-white/5">
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">תצוגה מקדימה (עד 10 שורות ראשונות)</h4>
                    </div>
                    <div className="overflow-x-auto max-h-[240px]">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/50 dark:bg-white/[0.02] sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 whitespace-nowrap">#</th>
                                    {mappedSystemFields.map((field, i) => (
                                        <th key={i} className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {field.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                {previewClients.map((client, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                        <td className="px-3 py-2 text-xs text-gray-400">{client._rowNum}</td>
                                        {mappedSystemFields.map((field, i) => (
                                            <td key={i} className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[160px] truncate">
                                                {client[field.name] instanceof Date
                                                    ? (client[field.name] as Date).toLocaleDateString('he-IL')
                                                    : String(client[field.name] || '—')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-2">
                    <button
                        onClick={() => setStep('mapping')}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                    >
                        חזרה למיפוי
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={isImporting || willImport === 0}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-90 rounded-xl shadow-lg shadow-primary/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isImporting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>מייבא...</span>
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                <span>ייבא {willImport} {entityLabels.plural}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    const renderResultStep = () => {
        if (!importResult) return null;

        return (
            <div className="text-center py-8 space-y-6">
                {importResult.success ? (
                    <>
                        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/10 flex items-center justify-center">
                            <CircleCheck className="w-10 h-10 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                                הייבוא הושלם בהצלחה! 🎉
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                <span className="font-semibold text-emerald-600">{importResult.count}</span> {entityLabels.plural} יובאו מהקובץ <span className="font-medium">"{fileName}"</span>
                            </p>
                            {importResult.skipped > 0 && (
                                <p className="text-sm text-amber-500 mt-1">
                                    {importResult.skipped} רשומות דולגו (כפילויות או ללא שם)
                                </p>
                            )}
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-800/20 text-sm text-blue-600 dark:text-blue-400">
                            💡 ניתן לבטל את הייבוא בכל עת מתוך "היסטוריית ייבוא" בעמוד הייבוא
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/10 flex items-center justify-center">
                            <XCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">שגיאה בייבוא</h3>
                            {importResult.errors.map((err, i) => (
                                <p key={i} className="text-red-500">{err}</p>
                            ))}
                        </div>
                    </>
                )}
                <button
                    onClick={handleClose}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20 transition-all"
                >
                    סגור
                </button>
            </div>
        );
    };

    // ─── Modal Shell ──────────────────────────────────────────────────

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 bg-base-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300"
            dir="rtl"
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
            <div className="bg-white dark:bg-base-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-white/10 overflow-hidden transform transition-all scale-100">
                {/* Header */}
                <header className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex-shrink-0">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent flex items-center gap-2">
                        <Upload className="w-5 h-5 text-primary" />
                        ייבוא {entityLabels.plural}
                    </h2>
                    <button
                        onClick={handleClose}
                        disabled={isImporting}
                        className="p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all disabled:opacity-50"
                        aria-label="סגור חלון"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                {/* Step indicator */}
                <StepIndicator currentStep={step} />

                {/* Content */}
                <main className="p-6 overflow-y-auto hide-scrollbar flex-grow">
                    {step === 'upload' && renderUploadStep()}
                    {step === 'mapping' && renderMappingStep()}
                    {step === 'preview' && renderPreviewStep()}
                    {step === 'result' && renderResultStep()}
                </main>
            </div>
        </div>,
        document.body
    );
};
