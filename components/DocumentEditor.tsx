
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { CrmDocument, DocumentContent, Client } from '../types';
import { Modal } from './Modal';
import { auth } from '../firebaseConfig';
import { SignatureCanvas } from './SignatureCanvas';
import { Plus, Trash2, Image, Pencil, Eye, Save, Send } from 'lucide-react';

interface DocumentEditorProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    document?: CrmDocument | null;
}

const generateToken = () => {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

const DEFAULT_CONTENT: DocumentContent = {
    headerRight: '',
    headerLeft: '',
    body: '',
    showSignature: true,
};

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ isOpen, onClose, client, document: existingDoc }) => {
    const { customFields, addDocument, updateDocument, entityLabels } = useAppContext();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState<DocumentContent>(DEFAULT_CONTENT);
    const [isPreview, setIsPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showFieldDropdown, setShowFieldDropdown] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            alert('הקובץ גדול מדי. הגודל המקסימלי הוא 500KB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setContent(prev => ({ ...prev, logoUrl: ev.target?.result as string }));
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        if (isOpen) {
            if (existingDoc) {
                setTitle(existingDoc.title);
                setContent(existingDoc.content);
            } else {
                setTitle('');
                setContent(DEFAULT_CONTENT);
            }
            setIsPreview(false);
        }
    }, [isOpen, existingDoc]);

    const dynamicFields = useMemo(() => {
        const fields = [
            { key: entityLabels.templateNameVar, label: entityLabels.nameOf },
            { key: '{{תאריך היום}}', label: 'תאריך היום' },
        ];
        customFields.forEach(f => {
            fields.push({ key: `{{${f.name}}}`, label: f.name });
        });
        return fields;
    }, [customFields]);

    const replaceDynamicFields = (text: string) => {
        let result = text;
        result = result.replace(/{{שם הלקוח}}/g, client.name || '');
        result = result.replace(/{{שם הפרויקט}}/g, client.name || '');
        result = result.replace(/{{תאריך היום}}/g, new Date().toLocaleDateString('he-IL'));
        customFields.forEach(f => {
            const value = client.customFields?.[f.id] || client.customFields?.[f.name] || '';
            result = result.replace(new RegExp(`{{${f.name}}}`, 'g'), String(value));
        });
        return result;
    };

    const insertField = (targetField: string, fieldKey: string) => {
        setContent(prev => ({
            ...prev,
            [targetField]: prev[targetField as keyof DocumentContent] + fieldKey,
        }));
        setShowFieldDropdown(null);
    };

    const handleSave = async (status: 'draft' | 'sent') => {
        if (!title.trim()) return;
        setSaving(true);
        try {
            if (existingDoc?.id) {
                await updateDocument({
                    ...existingDoc,
                    title,
                    content,
                    status: status === 'sent' ? 'sent' : existingDoc.status,
                    updatedAt: Date.now(),
                });
            } else {
                const user = auth.currentUser;
                await addDocument({
                    clientId: client.id,
                    title,
                    status,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    publicToken: generateToken(),
                    content,
                    authorId: user?.uid || '',
                    authorName: user?.displayName || user?.email?.split('@')[0] || '',
                    authorPhotoUrl: user?.photoURL || '',
                });
            }
            onClose();
        } catch (err) {
            console.error('Failed to save document', err);
            alert('שגיאה בשמירת המסמך');
        } finally {
            setSaving(false);
        }
    };

    const FieldInsertButton: React.FC<{ target: string }> = ({ target }) => (
        <div className="relative">
            <button
                type="button"
                onClick={() => setShowFieldDropdown(showFieldDropdown === target ? null : target)}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
                <Plus className="w-3.5 h-3.5" />
                הוסף שדה
            </button>
            {showFieldDropdown === target && (
                <div className="absolute z-50 top-full left-0 mt-1 bg-white dark:bg-base-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto min-w-[180px] animate-in fade-in slide-in-from-top-1">
                    {dynamicFields.map(f => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => insertField(target, f.key)}
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

    const renderPreview = () => (
        <div className="bg-white dark:bg-base-900 border border-gray-200 dark:border-white/10 rounded-2xl p-6 space-y-6 text-gray-800 dark:text-gray-200" dir="rtl">
            {/* Logo */}
            {content.logoUrl && (
                <div className="flex justify-center">
                    <img src={content.logoUrl} alt="Logo" className="max-h-16 max-w-[200px] object-contain" />
                </div>
            )}
            {/* Header */}
            <div className="flex justify-between items-start gap-4">
                <div className="whitespace-pre-wrap text-sm flex-1">{replaceDynamicFields(content.headerRight)}</div>
                <div className="whitespace-pre-wrap text-sm text-left flex-1">{replaceDynamicFields(content.headerLeft)}</div>
            </div>

            {/* Body */}
            {content.body && (
                <div className="whitespace-pre-wrap text-sm leading-relaxed border-t border-gray-100 dark:border-white/5 pt-4">
                    {replaceDynamicFields(content.body)}
                </div>
            )}

            {/* Signature area */}
            {content.showSignature && (
                <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">אזור חתימה</p>
                    <div className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl h-32 flex items-center justify-center text-gray-400 text-sm">
                        אזור החתימה יופיע כאן בעמוד הציבורי
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={existingDoc?.id ? 'עריכת מסמך' : 'יצירת מסמך חדש'} mode="side">
            <div className="space-y-4" onClick={() => setShowFieldDropdown(null)}>
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium mb-1">כותרת המסמך</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="למשל: הצעת מחיר, הזמנה..."
                        className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
                    />
                </div>

                {/* Toggle Preview / Edit */}
                <div className="flex items-center gap-2 bg-gray-100/50 dark:bg-white/5 p-1 rounded-xl w-fit">
                    <button
                        type="button"
                        onClick={() => setIsPreview(false)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!isPreview ? 'bg-white dark:bg-base-800 text-primary shadow-sm' : 'text-gray-500'}`}
                    >
                        <Pencil className="w-4 h-4 inline-block ml-1" /> עריכה
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsPreview(true)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isPreview ? 'bg-white dark:bg-base-800 text-primary shadow-sm' : 'text-gray-500'}`}
                    >
                        <Eye className="w-4 h-4 inline-block ml-1" /> תצוגה מקדימה
                    </button>
                </div>

                {isPreview ? renderPreview() : (
                    <div className="space-y-4" onClick={e => e.stopPropagation()}>
                        {/* Logo Upload */}
                        <div>
                            <label className="block text-sm font-medium mb-1">לוגו</label>
                            <div className="flex items-center gap-3">
                                {content.logoUrl ? (
                                    <div className="flex items-center gap-3 p-2 bg-gray-50/50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                                        <img src={content.logoUrl} alt="Logo" className="h-10 max-w-[120px] object-contain" />
                                        <button
                                            type="button"
                                            onClick={() => setContent(p => ({ ...p, logoUrl: undefined }))}
                                            className="text-red-500 hover:text-red-700 p-1"
                                            title="הסר לוגו"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => logoInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/50 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/20 rounded-xl hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        <Image className="w-4 h-4" />
                                        העלה לוגו
                                    </button>
                                )}
                                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">PNG או JPG, עד 500KB</p>
                        </div>

                        {/* Header Right */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-medium">צד ימין (עליון)</label>
                                <FieldInsertButton target="headerRight" />
                            </div>
                            <textarea
                                value={content.headerRight}
                                onChange={e => setContent(p => ({ ...p, headerRight: e.target.value }))}
                                rows={3}
                                placeholder="שם העסק, כתובת, טלפון..."
                                className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm resize-none"
                            />
                        </div>

                        {/* Header Left */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-medium">צד שמאל (עליון)</label>
                                <FieldInsertButton target="headerLeft" />
                            </div>
                            <textarea
                                value={content.headerLeft}
                                onChange={e => setContent(p => ({ ...p, headerLeft: e.target.value }))}
                                rows={3}
                                placeholder={`תאריך, מספר מסמך, שם ${entityLabels.singular}...`}
                                className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm resize-none"
                            />
                        </div>

                        {/* Body */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-medium">גוף המסמך</label>
                                <FieldInsertButton target="body" />
                            </div>
                            <textarea
                                value={content.body}
                                onChange={e => setContent(p => ({ ...p, body: e.target.value }))}
                                rows={8}
                                placeholder={`תוכן המסמך... ניתן להשתמש בשדות דינאמיים כמו ${entityLabels.templateNameVar}`}
                                className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm resize-none"
                            />
                        </div>

                        {/* Signature Toggle */}
                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50/50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                            <input
                                type="checkbox"
                                checked={content.showSignature}
                                onChange={e => setContent(p => ({ ...p, showSignature: e.target.checked }))}
                                className="rounded text-primary focus:ring-primary w-4 h-4"
                            />
                            <div>
                                <span className="text-sm font-medium">הצג אזור חתימה</span>
                                <p className="text-xs text-gray-500">{`${entityLabels.theSingular} יוכל לחתום ישירות על המסמך`}</p>
                            </div>
                        </label>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
                    <button
                        type="button"
                        onClick={() => handleSave('draft')}
                        disabled={saving || !title.trim()}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all font-medium disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 inline-block ml-1" /> שמור טיוטה
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSave('sent')}
                        disabled={saving || !title.trim()}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-95 transition-all font-medium disabled:opacity-50"
                    >
                        <Send className="w-4 h-4 inline-block ml-1" /> שמור ושתף
                    </button>
                </div>
            </div>
        </Modal>
    );
};
