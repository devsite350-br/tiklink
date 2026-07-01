
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { LeadSource, isMappableField } from '../types';
import { webhookUrl } from '../utils/apiClient';
import { Plus, Link, Trash2, UserPlus, Check, Copy, Shuffle, X, CheckSquare } from 'lucide-react';
import { useConfirm } from './ConfirmDialog';

export const LeadSourcesPage: React.FC = () => {
    const { leadSources, addLeadSource, updateLeadSource, deleteLeadSource, userId, customFields, entityLabels } = useAppContext();
    const confirm = useConfirm();
    const [newSourceName, setNewSourceName] = useState('');
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    const handleAddSource = () => {
        if (newSourceName.trim()) {
            addLeadSource(newSourceName.trim());
            setNewSourceName('');
        }
    };

    const handleDeleteSource = async (id: string) => {
        if (await confirm({ message: 'האם אתה בטוח שברצונך למחוק מקור הגעה זה?' })) {
            deleteLeadSource(id);
        }
    };

    const handleAddMapping = (source: LeadSource) => {
        const newMappings = [...(source.mappings || []), { key: '', fieldId: '' }];
        updateLeadSource({ ...source, mappings: newMappings });
    };

    const handleUpdateMappingKey = (source: LeadSource, index: number, newKey: string) => {
        const newMappings = [...(source.mappings || [])];
        if (newMappings[index]) {
            newMappings[index].key = newKey;
            updateLeadSource({ ...source, mappings: newMappings });
        }
    };

    const handleUpdateMappingField = (source: LeadSource, index: number, newFieldId: string) => {
        const newMappings = [...(source.mappings || [])];
        if (newMappings[index]) {
            newMappings[index].fieldId = newFieldId;
            updateLeadSource({ ...source, mappings: newMappings });
        }
    };

    const handleDeleteMapping = (source: LeadSource, index: number) => {
        const newMappings = [...(source.mappings || [])];
        newMappings.splice(index, 1);
        updateLeadSource({ ...source, mappings: newMappings });
    };

    const getLeadEndpointUrl = (sourceId: string) => {
        return webhookUrl('leads/inbound', { crmSource: sourceId, userId, name: 'clientName' });
    };

    const getTaskEndpointUrl = (sourceId: string) => {
        return webhookUrl('tasks/inbound', { crmSource: sourceId, userId, name: 'TaskTitle' });
    };

    const handleCopyUrl = (url: string, id: string) => {
        navigator.clipboard.writeText(url);
        setCopiedUrl(id);
        setTimeout(() => setCopiedUrl(null), 2000);
    };

    // System fields that are auto-managed or act as a catch-all (creation date,
    // additional details, and the duplicate name field) are excluded — only
    // fields that can actually be set from an incoming param are offered.
    const availableFields = [
        { id: 'name', name: entityLabels.nameOf },
        ...customFields.filter(f => isMappableField(f.id)).map(f => ({ id: f.id, name: f.name }))
    ];

    return (
        <div className="p-3 sm:p-6 max-w-4xl mx-auto">
            <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold dark:text-gray-100" style={{ marginBottom: '8px' }}>ניהול מקורות הגעה</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    צור מקורות הגעה וקבל קישורי API לחיבור עם מערכות חיצוניות
                </p>
            </div>

            {/* Add new source */}
            <div style={{
                marginBottom: '32px',
                border: '1px dashed',
            }} className="flex gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-blue-50 to-emerald-50 border-blue-200 dark:from-gray-800 dark:to-gray-800 dark:border-gray-700">
                <input
                    type="text"
                    placeholder="שם מקור הגעה חדש..."
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                    style={{
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                    }}
                    className="flex-1 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-sm sm:text-base bg-white border-slate-200 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                    onClick={handleAddSource}
                    disabled={!newSourceName.trim()}
                    style={{
                        border: 'none',
                        cursor: !newSourceName.trim() ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                    }}
                    className={`flex items-center gap-1 sm:gap-2 px-3 py-2 sm:px-6 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base ${!newSourceName.trim() ? "bg-slate-300 text-white dark:bg-gray-600 dark:text-gray-300" : "bg-gradient-to-br from-[#1E5CC5] to-[#1976d2] text-white"}`}
                >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                    הוסף
                </button>
            </div>

            {/* Sources list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {leadSources.map((source) => (
                    <div key={source.id} style={{
                        background: 'white',
                        borderRadius: '16px',
                        border: '1px solid #e8ecf2',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
                        transition: 'box-shadow 0.2s',
                    }} className="dark:!bg-gray-800 dark:!border-gray-700">
                        {/* Source header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '16px 20px',
                            borderBottom: '1px solid #f1f5f9',
                            background: 'linear-gradient(135deg, rgba(30,92,197,0.03), rgba(30,92,197,0.01))',
                        }} className="dark:!border-gray-700">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #1E5CC5, #3b82f6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '16px',
                                }}>
                                    <Link className="w-4 h-4" />
                                </div>
                                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }} className="dark:text-gray-100">
                                    {source.name}
                                </h3>
                            </div>
                            <button
                                onClick={() => handleDeleteSource(source.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    borderRadius: '8px',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                                title="מחק מקור הגעה"
                                onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none'; }}
                            >
                                <Trash2 width={18} height={18} />
                            </button>
                        </div>

                        <div style={{ padding: '20px' }}>
                            {/* Lead Endpoint */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                    <UserPlus width={14} height={14} stroke="#1E5CC5" />
                                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }} className="dark:!text-gray-300">
                                        Endpoint להוספת {entityLabels.singular}
                                    </h4>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '4px 4px 4px 12px',
                                    direction: 'ltr',
                                }} className="dark:!bg-gray-900 dark:!border-gray-700">
                                    <div style={{
                                        flex: 1,
                                        fontSize: '12px',
                                        fontFamily: 'monospace',
                                        color: '#64748b',
                                        wordBreak: 'break-all',
                                        lineHeight: 1.5,
                                        userSelect: 'all',
                                    }} className="dark:!text-gray-400">
                                        {getLeadEndpointUrl(source.id)}
                                    </div>
                                    <button
                                        onClick={() => handleCopyUrl(getLeadEndpointUrl(source.id), `lead-${source.id}`)}
                                        style={{
                                            flexShrink: 0,
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: copiedUrl === `lead-${source.id}` ? '#14BC88' : '#1E5CC5',
                                            color: 'white',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                        }}
                                    >
                                        {copiedUrl === `lead-${source.id}` ? (
                                            <>
                                                <Check width={14} height={14} />
                                                הועתק
                                            </>
                                        ) : (
                                            <>
                                                <Copy width={14} height={14} />
                                                העתק
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Field Mappings */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Shuffle width={14} height={14} stroke="#1E5CC5" />
                                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }} className="dark:!text-gray-300">
                                            מיפוי שדות
                                        </h4>
                                        <span style={{
                                            fontSize: '11px',
                                            color: '#94a3b8',
                                            background: '#f1f5f9',
                                            padding: '2px 8px',
                                            borderRadius: '99px',
                                        }} className="dark:!bg-gray-700 dark:!text-gray-400">
                                            אופציונלי
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleAddMapping(source)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            background: 'white',
                                            color: '#1E5CC5',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                        className="dark:!bg-gray-700 dark:!border-gray-600 dark:!text-blue-400"
                                        onMouseOver={(e) => { e.currentTarget.style.background = '#f0f5ff'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = 'white'; }}
                                    >
                                        <Plus width={12} height={12} />
                                        הוסף מיפוי
                                    </button>
                                </div>

                                {(source.mappings || []).length > 0 && (
                                    <div style={{
                                        background: '#f8fafc',
                                        borderRadius: '10px',
                                        border: '1px solid #e2e8f0',
                                        overflow: 'hidden',
                                    }} className="dark:!bg-gray-900 dark:!border-gray-700">
                                        {/* Mapping header */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 32px 1fr 36px',
                                            gap: '8px',
                                            padding: '8px 12px',
                                            borderBottom: '1px solid #e2e8f0',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: '#94a3b8',
                                            textTransform: 'uppercase',
                                        }} className="dark:!border-gray-700">
                                            <span>פרמטר ב-URL</span>
                                            <span></span>
                                            <span>שדה במערכת</span>
                                            <span></span>
                                        </div>

                                        {(source.mappings || []).map((mapping, index) => (
                                            <div key={index} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 32px 1fr 36px',
                                                gap: '8px',
                                                padding: '8px 12px',
                                                alignItems: 'center',
                                                borderBottom: index < (source.mappings?.length || 0) - 1 ? '1px solid #f1f5f9' : 'none',
                                            }} className="dark:!border-gray-800">
                                                <input
                                                    type="text"
                                                    placeholder="שם הפרמטר"
                                                    value={mapping.key}
                                                    onChange={(e) => handleUpdateMappingKey(source, index, e.target.value)}
                                                    style={{
                                                        padding: '8px 12px',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        fontSize: '13px',
                                                        outline: 'none',
                                                        background: 'white',
                                                        width: '100%',
                                                        boxSizing: 'border-box',
                                                    }}
                                                    className="dark:!bg-gray-800 dark:!border-gray-600 dark:!text-gray-100"
                                                />
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    color: '#94a3b8',
                                                    fontSize: '16px',
                                                }}>
                                                    ➔
                                                </div>
                                                <select
                                                    value={mapping.fieldId}
                                                    onChange={(e) => handleUpdateMappingField(source, index, e.target.value)}
                                                    style={{
                                                        padding: '8px 12px',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        fontSize: '13px',
                                                        outline: 'none',
                                                        background: 'white',
                                                        width: '100%',
                                                        boxSizing: 'border-box',
                                                        cursor: 'pointer',
                                                    }}
                                                    className="dark:!bg-gray-800 dark:!border-gray-600 dark:!text-gray-100"
                                                >
                                                    <option value="">בחר שדה...</option>
                                                    {availableFields.map(f => (
                                                        <option key={f.id} value={f.id}>{f.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleDeleteMapping(source, index)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#cbd5e1',
                                                        cursor: 'pointer',
                                                        padding: '6px',
                                                        borderRadius: '6px',
                                                        transition: 'all 0.2s',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                    onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none'; }}
                                                >
                                                    <X width={14} height={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Task Endpoint */}
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                    <CheckSquare width={14} height={14} stroke="#14BC88" />
                                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }} className="dark:!text-gray-300">
                                        Endpoint להוספת משימה
                                    </h4>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '4px 4px 4px 12px',
                                    direction: 'ltr',
                                }} className="dark:!bg-gray-900 dark:!border-gray-700">
                                    <div style={{
                                        flex: 1,
                                        fontSize: '12px',
                                        fontFamily: 'monospace',
                                        color: '#64748b',
                                        wordBreak: 'break-all',
                                        lineHeight: 1.5,
                                        userSelect: 'all',
                                    }} className="dark:!text-gray-400">
                                        {getTaskEndpointUrl(source.id)}
                                    </div>
                                    <button
                                        onClick={() => handleCopyUrl(getTaskEndpointUrl(source.id), `task-${source.id}`)}
                                        style={{
                                            flexShrink: 0,
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: copiedUrl === `task-${source.id}` ? '#14BC88' : '#1E5CC5',
                                            color: 'white',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                        }}
                                    >
                                        {copiedUrl === `task-${source.id}` ? (
                                            <>
                                                <Check width={14} height={14} />
                                                הועתק
                                            </>
                                        ) : (
                                            <>
                                                <Copy width={14} height={14} />
                                                העתק
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer tip */}
                        <div style={{
                            padding: '12px 20px',
                            borderTop: '1px solid #f1f5f9',
                            background: '#fafbfc',
                            fontSize: '12px',
                            color: '#94a3b8',
                            lineHeight: 1.6,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                        }} className="dark:!bg-gray-850 dark:!border-gray-700">
                            <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>💡</span>
                            <span>
                                הקישור מכיל את ה-User ID שלך. ניתן להוסיף פרמטרים כמו <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }} dir="ltr">&phone=...&email=...</code> ({entityLabels.plural})
                                או פרמטרים שיופיעו בתיאור (משימות).
                            </span>
                        </div>
                    </div>
                ))}

                {leadSources.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        color: '#94a3b8',
                        background: 'white',
                        borderRadius: '16px',
                        border: '1px dashed #e2e8f0',
                    }} className="dark:!bg-gray-800 dark:!border-gray-700">
                        <div style={{ marginBottom: '12px' }}><Link className="w-10 h-10 mx-auto opacity-40" /></div>
                        <p style={{ fontSize: '16px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }} className="dark:!text-gray-300">
                            אין מקורות הגעה
                        </p>
                        <p style={{ fontSize: '13px' }}>
                            הוסף מקור הגעה חדש כדי לקבל קישורי API לחיבור מערכות חיצוניות
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
