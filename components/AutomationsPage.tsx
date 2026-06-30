
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Automation, AutomationLog, AutomationTrigger, AutomationAction, CustomFieldType } from '../types';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Modal } from './Modal';
import { Link, MessageSquare, Mail, Zap, Target, ChevronDown, Plus, X } from 'lucide-react';
import { useConfirm } from './ConfirmDialog';

type TriggerType = 'status_change' | 'client_created';
type ActionType = 'webhook' | 'whatsapp' | 'email';

const getTriggerLabels = (entityLabels: { createEntity: string }): Record<TriggerType, string> => ({
    status_change: 'מעבר לסטטוס',
    client_created: entityLabels.createEntity,
});

const ACTION_LABELS: Record<ActionType, string> = {
    webhook: 'שליחת Webhook',
    whatsapp: 'שליחת הודעת וואטסאפ',
    email: 'שליחת מייל',
};

const ACTION_ICONS: Record<ActionType, React.ReactNode> = {
    webhook: <Link className="w-4 h-4" />,
    whatsapp: <MessageSquare className="w-4 h-4" />,
    email: <Mail className="w-4 h-4" />,
};

const inputClass = 'w-full mt-1 px-3 py-2 border rounded-md bg-white dark:bg-base-900/50 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 focus:ring-primary focus:border-primary';

const AutomationForm: React.FC<{
    selectedAutomation: Automation | null;
    onSave: (automation: Omit<Automation, 'id'> | Automation) => Promise<void>;
    onClear: () => void;
    onNavigateToTab?: (tab: string) => void;
}> = ({ selectedAutomation, onSave, onClear, onNavigateToTab }) => {
    const { customFields, statuses, visibilitySettings, entityLabels } = useAppContext();
    const TRIGGER_LABELS = getTriggerLabels(entityLabels);
    const [name, setName] = useState('');

    // Trigger state
    const [triggerType, setTriggerType] = useState<TriggerType>('status_change');
    const [triggerStatus, setTriggerStatus] = useState<string>(statuses[0]?.name || '');

    // Action state
    const [actionType, setActionType] = useState<ActionType>('webhook');

    // Webhook action state
    const [webhookUrl, setWebhookUrl] = useState('');
    const [method, setMethod] = useState<'POST' | 'GET'>('POST');
    const [fieldMapping, setFieldMapping] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);

    // WhatsApp action state
    const [recipientMode, setRecipientMode] = useState<'manual' | 'field'>('manual');
    const [manualPhone, setManualPhone] = useState('');
    const [fieldId, setFieldId] = useState('');
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const messageRef = useRef<HTMLTextAreaElement>(null);

    // Email action state
    const [emailRecipientMode, setEmailRecipientMode] = useState<'manual' | 'field'>('manual');
    const [manualEmail, setManualEmail] = useState('');
    const [emailFieldId, setEmailFieldId] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const emailSubjectRef = useRef<HTMLInputElement>(null);
    const emailBodyRef = useRef<HTMLTextAreaElement>(null);

    const phoneFields = customFields.filter(f => f.type === CustomFieldType.PHONE);
    const emailFields = customFields.filter(f => f.type === CustomFieldType.EMAIL);

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        if (selectedAutomation) {
            setName(selectedAutomation.name);
            const t = selectedAutomation.trigger;
            setTriggerType(t.type);
            setTriggerStatus(t.type === 'status_change' ? t.status : (statuses[0]?.name || ''));

            const a = selectedAutomation.action;
            setActionType(a.type);
            // reset all action states first
            setWebhookUrl(''); setMethod('POST'); setFieldMapping([{ key: '', value: '' }]);
            setRecipientMode('manual'); setManualPhone(''); setFieldId(''); setWhatsappMessage('');
            setEmailRecipientMode('manual'); setManualEmail(''); setEmailFieldId(''); setEmailSubject(''); setEmailBody('');
            if (a.type === 'webhook') {
                setWebhookUrl(a.url || '');
                setMethod(a.method || 'POST');
                setFieldMapping(a.fieldMapping?.length > 0 ? a.fieldMapping : [{ key: '', value: '' }]);
            } else if (a.type === 'whatsapp') {
                setRecipientMode(a.recipient?.mode || 'manual');
                setManualPhone(a.recipient?.manualPhone || '');
                setFieldId(a.recipient?.fieldId || '');
                setWhatsappMessage(a.message || '');
            } else if (a.type === 'email') {
                setEmailRecipientMode(a.recipient?.mode || 'manual');
                setManualEmail(a.recipient?.manualEmail || '');
                setEmailFieldId(a.recipient?.fieldId || '');
                setEmailSubject(a.subject || '');
                setEmailBody(a.body || '');
            }
        } else {
            setName('');
            setTriggerType('status_change');
            setTriggerStatus(statuses[0]?.name || '');
            setActionType('webhook');
            setWebhookUrl('');
            setMethod('POST');
            setFieldMapping([{ key: '', value: '' }]);
            setRecipientMode('manual');
            setManualPhone('');
            setFieldId(phoneFields[0]?.id || '');
            setWhatsappMessage('');
            setEmailRecipientMode('manual');
            setManualEmail('');
            setEmailFieldId(emailFields[0]?.id || '');
            setEmailSubject('');
            setEmailBody('');
        }
    }, [selectedAutomation, statuses]);

    const handleMappingChange = (index: number, field: 'key' | 'value', value: string) => {
        const newMapping = [...fieldMapping];
        newMapping[index][field] = value;
        setFieldMapping(newMapping);
    };

    const addMappingField = () => setFieldMapping([...fieldMapping, { key: '', value: '' }]);
    const removeMappingField = (index: number) => setFieldMapping(fieldMapping.filter((_, i) => i !== index));

    const allTags = [
        entityLabels.templateNameVar, entityLabels.templateIdVar, '{{סטטוס}}', '{{סטטוס קודם}}', '{{הערות}}',
        '{{תאריך יצירה}}', '{{מקור הגעה}}', '{{משתמש מוקצה}}',
        ...customFields.map(f => `{{${f.name}}}`)
    ];

    const insertTagIntoField = (tag: string, ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, value: string, setter: (v: string) => void) => {
        const el = ref.current;
        if (!el) {
            setter(value + tag);
            return;
        }
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + tag + value.slice(end);
        setter(next);
        setTimeout(() => {
            el.focus();
            const pos = start + tag.length;
            el.setSelectionRange(pos, pos);
        }, 0);
    };

    const insertTagIntoMessage = (tag: string) => {
        insertTagIntoField(tag, messageRef, whatsappMessage, setWhatsappMessage);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        if (!name.trim()) {
            setSubmitError('יש למלא שם אוטומציה.');
            return;
        }
        if (triggerType === 'status_change' && !triggerStatus) {
            setSubmitError('יש לבחור סטטוס לטריגר.');
            return;
        }
        if (actionType === 'webhook' && !webhookUrl.trim()) {
            setSubmitError('יש למלא כתובת Webhook.');
            return;
        }
        if (actionType === 'whatsapp') {
            if (!whatsappMessage.trim()) {
                setSubmitError('יש למלא תוכן הודעה.');
                return;
            }
            if (recipientMode === 'manual' && !manualPhone.trim()) {
                setSubmitError('יש למלא מספר טלפון לנמען.');
                return;
            }
            if (recipientMode === 'field' && !fieldId) {
                setSubmitError(`יש לבחור שדה טלפון ${entityLabels.fromSingular}.`);
                return;
            }
        }
        if (actionType === 'email') {
            if (!emailSubject.trim()) {
                setSubmitError('יש למלא כותרת מייל.');
                return;
            }
            if (emailRecipientMode === 'manual' && !manualEmail.trim()) {
                setSubmitError('יש למלא כתובת מייל לנמען.');
                return;
            }
            if (emailRecipientMode === 'field' && !emailFieldId) {
                setSubmitError(`יש לבחור שדה מייל ${entityLabels.fromSingular}.`);
                return;
            }
        }

        const trigger: AutomationTrigger = triggerType === 'status_change'
            ? { type: 'status_change', status: triggerStatus }
            : { type: 'client_created' };

        let action: AutomationAction;
        if (actionType === 'webhook') {
            const finalMapping = fieldMapping.filter(m => m.key.trim() !== '' || m.value.trim() !== '');
            action = { type: 'webhook', url: webhookUrl, method, fieldMapping: finalMapping };
        } else if (actionType === 'whatsapp') {
            const recipient = recipientMode === 'manual'
                ? { mode: 'manual' as const, manualPhone: manualPhone.trim() }
                : { mode: 'field' as const, fieldId };
            action = { type: 'whatsapp', recipient, message: whatsappMessage };
        } else {
            const recipient = emailRecipientMode === 'manual'
                ? { mode: 'manual' as const, manualEmail: manualEmail.trim() }
                : { mode: 'field' as const, fieldId: emailFieldId };
            action = { type: 'email', recipient, subject: emailSubject, body: emailBody };
        }

        const automationData = { name: name.trim(), trigger, action };
        setSubmitting(true);
        try {
            if (selectedAutomation) {
                await onSave({ ...selectedAutomation, ...automationData });
            } else {
                await onSave(automationData);
            }
        } catch (err: any) {
            console.error('[Automation save] failed', err);
            setSubmitError(err?.message || String(err) || 'שמירה נכשלה');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name */}
                <div>
                    <label htmlFor="automationName" className="block text-sm font-medium">שם האוטומציה *</label>
                    <input type="text" id="automationName" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
                </div>

                {/* Trigger */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-base-200/50 dark:bg-base-900/20">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1"><Zap className="w-4 h-4" /> טריגר</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">סוג טריגר</label>
                            <select value={triggerType} onChange={e => setTriggerType(e.target.value as TriggerType)} className={inputClass}>
                                <option value="status_change">{TRIGGER_LABELS.status_change}</option>
                                <option value="client_created">{TRIGGER_LABELS.client_created}</option>
                                <option value="" disabled>X ימים מיצירה — בקרוב</option>
                            </select>
                        </div>
                        {triggerType === 'status_change' && (
                            <div>
                                <label className="block text-sm font-medium">סטטוס</label>
                                <select value={triggerStatus} onChange={e => setTriggerStatus(e.target.value)} className={inputClass}>
                                    {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-base-200/50 dark:bg-base-900/20">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1"><Target className="w-4 h-4" /> פעולה</h3>
                    <div className="mb-4">
                        <label className="block text-sm font-medium">סוג פעולה</label>
                        <select value={actionType} onChange={e => setActionType(e.target.value as ActionType)} className={inputClass}>
                            <option value="webhook">{ACTION_LABELS.webhook}</option>
                            <option value="whatsapp">{ACTION_LABELS.whatsapp}</option>
                            <option value="email">{ACTION_LABELS.email}</option>
                        </select>
                    </div>

                    {actionType === 'webhook' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium">כתובת Webhook *</label>
                                    <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">שיטה</label>
                                    <select value={method} onChange={e => setMethod(e.target.value as 'POST' | 'GET')} className={inputClass + ' h-[42px]'}>
                                        <option value="POST">POST</option>
                                        <option value="GET">GET</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium mb-1">מיפוי שדות (JSON Payload)</h3>
                                <p className="text-xs text-gray-500 mb-2">מפתח (Key) יישלח כפרמטר, הערך (Value) יכול לכלול תגיות דינמיות.</p>
                                <div className="space-y-3">
                                    {fieldMapping.map((mapping, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-base-200 dark:bg-base-900/30 p-3 rounded-md">
                                            <div className="flex-1 w-full sm:w-auto">
                                                <label className="text-xs text-gray-500 block mb-1">שם השדה (Key)</label>
                                                <input type="text" value={mapping.key} onChange={e => handleMappingChange(index, 'key', e.target.value)} placeholder="למשל: client_name" className="w-full px-3 py-2 border rounded-md bg-white dark:bg-base-900/50 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 focus:ring-primary focus:border-primary" />
                                            </div>
                                            <div className="flex-[2] w-full sm:w-auto flex items-end gap-2">
                                                <div className="flex-grow">
                                                    <label className="text-xs text-gray-500 block mb-1">ערך (Value)</label>
                                                    <input type="text" value={mapping.value} onChange={e => handleMappingChange(index, 'value', e.target.value)} placeholder="ערך קבוע או תגית" className="w-full px-3 py-2 border rounded-md bg-white dark:bg-base-900/50 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 focus:ring-primary focus:border-primary" />
                                                </div>
                                                <select onChange={e => { if (e.target.value) { handleMappingChange(index, 'value', mapping.value + e.target.value); e.target.value = ''; } }} className="w-10 sm:w-32 px-2 py-2 border rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-600 focus:ring-primary focus:border-primary cursor-pointer text-xs sm:text-sm" title="הוסף משתנה">
                                                    <option value="">{'+ משתנה'}</option>
                                                    {allTags.map(tag => <option key={tag} value={tag}>{tag.replace(/{{|}}/g, '')}</option>)}
                                                </select>
                                            </div>
                                            <button type="button" onClick={() => removeMappingField(index)} className="text-red-500 p-2 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full mt-4 sm:mt-0" title="הסר שדה"><X className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addMappingField} className="mt-3 text-sm font-medium text-primary hover:underline flex items-center gap-1">
                                    <Plus className="w-4 h-4" /> הוסף שדה למיפוי
                                </button>
                            </div>
                        </div>
                    )}

                    {actionType === 'whatsapp' && (
                        <div className="space-y-4">
                            {!(visibilitySettings.whatsapp?.enabled) && (
                                <div className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                                    <p className="font-bold mb-1">לאוטומציה מסוג זה נדרש להפעיל מודול &quot;וואטסאפ&quot; ולהגדיר חיבור.</p>
                                    <button
                                        type="button"
                                        onClick={() => onNavigateToTab?.('whatsapp')}
                                        className="text-xs text-primary hover:underline font-bold mt-1"
                                    >
                                        עבור להגדרות מודול וואטסאפ &larr;
                                    </button>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium mb-2">נמען</label>
                                <div className="flex flex-wrap gap-3 text-sm">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" name="recipientMode" checked={recipientMode === 'manual'} onChange={() => setRecipientMode('manual')} />
                                        מספר טלפון ידני
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" name="recipientMode" checked={recipientMode === 'field'} onChange={() => setRecipientMode('field')} />
                                        שדה דינמי {entityLabels.fromSingular}
                                    </label>
                                </div>
                                <div className="mt-2">
                                    {recipientMode === 'manual' ? (
                                        <input type="text" dir="ltr" value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="לדוגמא: 0501234567" className={inputClass} />
                                    ) : (
                                        <select value={fieldId} onChange={e => setFieldId(e.target.value)} className={inputClass}>
                                            <option value="">בחר שדה טלפון…</option>
                                            {phoneFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                        </select>
                                    )}
                                    {recipientMode === 'field' && phoneFields.length === 0 && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">לא נמצאו שדות מסוג "טלפון". הוסף שדה כזה במסך "ניהול שדות".</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium">תוכן ההודעה *</label>
                                    <select onChange={e => { if (e.target.value) { insertTagIntoMessage(e.target.value); e.target.value = ''; } }} className="px-2 py-1 border rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-600 cursor-pointer text-xs">
                                        <option value="">+ משתנה</option>
                                        {allTags.map(tag => <option key={tag} value={tag}>{tag.replace(/{{|}}/g, '')}</option>)}
                                    </select>
                                </div>
                                <textarea
                                    ref={messageRef}
                                    value={whatsappMessage}
                                    onChange={e => setWhatsappMessage(e.target.value)}
                                    rows={6}
                                    placeholder={`היי ${entityLabels.templateNameVar}, סטטוס הפניה שלך עודכן ל-{{סטטוס}}.`}
                                    className={inputClass + ' resize-y leading-relaxed'}
                                />
                                <p className="text-xs text-gray-500 mt-1">תגיות בסוגריים מסולסלים יוחלפו בערך {entityLabels.fromSingular} בעת השליחה.</p>
                            </div>
                        </div>
                    )}

                    {actionType === 'email' && (
                        <div className="space-y-4">
                            {!(visibilitySettings.email?.enabled) && (
                                <div className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                                    <p className="font-bold mb-1">לאוטומציה מסוג זה נדרש להפעיל מודול &quot;אימייל&quot; ולהגדיר שיטת משלוח.</p>
                                    <button
                                        type="button"
                                        onClick={() => onNavigateToTab?.('email')}
                                        className="text-xs text-primary hover:underline font-bold mt-1"
                                    >
                                        עבור להגדרות מודול אימייל &larr;
                                    </button>
                                </div>
                            )}
                            {/* Recipient */}
                            <div>
                                <label className="block text-sm font-medium mb-2">נמען</label>
                                <div className="flex flex-wrap gap-3 text-sm">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" name="emailRecipientMode" checked={emailRecipientMode === 'manual'} onChange={() => setEmailRecipientMode('manual')} />
                                        כתובת מייל ידנית
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" name="emailRecipientMode" checked={emailRecipientMode === 'field'} onChange={() => setEmailRecipientMode('field')} />
                                        שדה דינמי {entityLabels.fromSingular}
                                    </label>
                                </div>
                                <div className="mt-2">
                                    {emailRecipientMode === 'manual' ? (
                                        <input type="email" dir="ltr" value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="example@mail.com" className={inputClass} />
                                    ) : (
                                        <select value={emailFieldId} onChange={e => setEmailFieldId(e.target.value)} className={inputClass}>
                                            <option value="">בחר שדה מייל…</option>
                                            {emailFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                        </select>
                                    )}
                                    {emailRecipientMode === 'field' && emailFields.length === 0 && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">לא נמצאו שדות מסוג "אימייל". הוסף שדה כזה במסך "ניהול שדות".</p>
                                    )}
                                </div>
                            </div>

                            {/* Subject */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium">כותרת המייל *</label>
                                    <select onChange={e => { if (e.target.value) { insertTagIntoField(e.target.value, emailSubjectRef, emailSubject, setEmailSubject); e.target.value = ''; } }} className="px-2 py-1 border rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-600 cursor-pointer text-xs">
                                        <option value="">+ משתנה</option>
                                        {allTags.map(tag => <option key={tag} value={tag}>{tag.replace(/{{|}}/g, '')}</option>)}
                                    </select>
                                </div>
                                <input
                                    ref={emailSubjectRef}
                                    type="text"
                                    value={emailSubject}
                                    onChange={e => setEmailSubject(e.target.value)}
                                    placeholder={`עדכון סטטוס עבור ${entityLabels.templateNameVar}`}
                                    className={inputClass}
                                />
                            </div>

                            {/* Body */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium">תוכן המייל</label>
                                    <select onChange={e => { if (e.target.value) { insertTagIntoField(e.target.value, emailBodyRef, emailBody, setEmailBody); e.target.value = ''; } }} className="px-2 py-1 border rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-600 cursor-pointer text-xs">
                                        <option value="">+ משתנה</option>
                                        {allTags.map(tag => <option key={tag} value={tag}>{tag.replace(/{{|}}/g, '')}</option>)}
                                    </select>
                                </div>
                                <textarea
                                    ref={emailBodyRef}
                                    value={emailBody}
                                    onChange={e => setEmailBody(e.target.value)}
                                    rows={6}
                                    placeholder={`שלום ${entityLabels.templateNameVar},\n\nסטטוס הפניה שלך עודכן ל-{{סטטוס}}.\n\nבברכה,\nהצוות שלנו`}
                                    className={inputClass + ' resize-y leading-relaxed'}
                                />
                                <p className="text-xs text-gray-500 mt-1">תגיות בסוגריים מסולסלים יוחלפו בערך {entityLabels.fromSingular} בעת השליחה.</p>
                            </div>
                        </div>
                    )}
                </div>

                {submitError && (
                    <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm px-3 py-2">
                        {submitError}
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClear} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">ביטול</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded bg-primary text-white hover:bg-opacity-90 disabled:opacity-60">
                        {submitting ? 'שומר…' : 'שמור אוטומציה'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const describeAutomation = (a: Automation, entityLabels: { newEntity: string }): string => {
    const triggerText = a.trigger.type === 'status_change'
        ? `כאשר סטטוס משתנה ל-"${a.trigger.status}"`
        : `כאשר נוצר ${entityLabels.newEntity}`;
    const actionText = a.action.type === 'webhook'
        ? `שלח Webhook (${a.action.method || 'POST'})`
        : a.action.type === 'email'
        ? 'שלח מייל'
        : 'שלח הודעת וואטסאפ';
    return `${triggerText} → ${actionText}`;
};

export const AutomationsPage: React.FC<{ onNavigateToTab?: (tab: string) => void }> = ({ onNavigateToTab }) => {
    const { automations, addAutomation, updateAutomation, deleteAutomation, effectiveUserId, entityLabels } = useAppContext();
    const confirm = useConfirm();
    const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [logs, setLogs] = useState<AutomationLog[]>([]);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        if (!effectiveUserId) return;
        const q = query(collection(db, 'users', effectiveUserId, 'automationLogs'), orderBy('timestamp', 'desc'), limit(50));
        const unsub = onSnapshot(q, snap => {
            const newLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as AutomationLog);
            setLogs(newLogs);
        });
        return () => unsub();
    }, [effectiveUserId]);

    const closeForm = () => {
        setIsFormOpen(false);
        setSelectedAutomation(null);
    };

    const openNew = () => {
        setSelectedAutomation(null);
        setIsFormOpen(true);
    };

    const openEdit = (auto: Automation) => {
        setSelectedAutomation(auto);
        setIsFormOpen(true);
    };

    const handleToggleEnabled = async (auto: Automation) => {
        await updateAutomation({ ...auto, enabled: !auto.enabled });
    };

    const handleSave = async (automation: Omit<Automation, 'id'> | Automation) => {
        if ('id' in automation) {
            await updateAutomation(automation);
        } else {
            await addAutomation({ ...automation, enabled: true });
        }
        closeForm();
    };

    return (
        <div className="flex flex-col gap-4 sm:gap-6 px-1 sm:px-0">
            <div className="bg-base-100 dark:bg-base-800 p-4 sm:p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h2 className="text-xl font-bold">אוטומציות קיימות</h2>
                    <button
                        onClick={openNew}
                        className="px-4 py-2 rounded-md bg-primary text-white hover:bg-opacity-90 text-sm font-medium flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" /> אוטומציה חדשה
                    </button>
                </div>
                {automations.length > 0 ? (
                    <ul className="space-y-3">
                        {automations.map(auto => (
                            <li key={auto.id} className={`flex justify-between items-center bg-base-200 dark:bg-base-900/50 p-3 rounded-md ${auto.enabled === false ? 'opacity-50' : ''}`}>
                                <div>
                                    <p className="font-semibold flex items-center gap-2">
                                        <span>{ACTION_ICONS[auto.action.type as ActionType]}</span>
                                        {auto.name}
                                        {auto.enabled === false && <span className="text-xs text-gray-400 font-normal">(מושהה)</span>}
                                    </p>
                                    <p className="text-sm text-gray-900 dark:text-gray-400">{describeAutomation(auto, entityLabels)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        dir="ltr"
                                        onClick={() => handleToggleEnabled(auto)}
                                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${auto.enabled !== false ? 'bg-primary' : 'bg-gray-400 dark:bg-gray-600'}`}
                                        title={auto.enabled !== false ? 'השהה אוטומציה' : 'הפעל אוטומציה'}
                                    >
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${auto.enabled !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </button>
                                    <button onClick={() => openEdit(auto)} className="text-primary hover:underline">ערוך</button>
                                    <button onClick={async () => { if (await confirm({ title: 'מחיקת אוטומציה', message: <>האם אתה בטוח שברצונך למחוק את האוטומציה <strong>"{auto.name}"</strong>?</> })) deleteAutomation(auto.id); }} className="text-red-600 hover:underline">מחק</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">עדיין לא הוגדרו אוטומציות.</p>
                )}
            </div>

            <Modal
                isOpen={isFormOpen}
                onClose={closeForm}
                title={selectedAutomation ? 'עריכת אוטומציה' : 'אוטומציה חדשה'}
                mode="side"
            >
                <AutomationForm
                    selectedAutomation={selectedAutomation}
                    onSave={handleSave}
                    onClear={closeForm}
                    onNavigateToTab={onNavigateToTab}
                />
            </Modal>

            <div className="bg-base-100 dark:bg-base-800 p-4 sm:p-6 rounded-lg shadow-md mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">לוג הפעלות {logs.length > 0 && `(${logs.length} אחרונות)`}</h2>
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className="text-sm font-medium text-primary hover:text-accent transition-colors flex items-center gap-1"
                    >
                        {showLogs ? 'הסתר לוג' : 'הצג לוג'}
                        <ChevronDown className={`w-4 h-4 transform transition-transform ${showLogs ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {showLogs && (
                    logs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-right">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-base-900/50 dark:text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3">תאריך ההפעלה</th>
                                        <th className="px-4 py-3">אוטומציה</th>
                                        <th className="px-4 py-3">סטטוס</th>
                                        <th className="px-4 py-3">יעד</th>
                                        <th className="px-4 py-3">שגיאה</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => (
                                        <tr key={log.id} className="border-b dark:border-base-900/50 hover:bg-gray-50 dark:hover:bg-base-900/30 transition-colors">
                                            <td className="px-4 py-3">{new Date(log.timestamp).toLocaleString('he-IL')}</td>
                                            <td className="px-4 py-3 font-medium">{log.automationName}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${log.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {log.status === 'success' ? 'הצלחה' : 'שגיאה'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 max-w-xs truncate text-left direc-ltr" title={log.url} dir="ltr">{log.url}</td>
                                            <td className="px-4 py-3 text-red-500 max-w-xs truncate" title={log.response}>{log.response || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">עדיין לא נרשמו הפעלות אוטומציה.</p>
                    )
                )}
            </div>
        </div>
    );
};
