
import React, { useState, useMemo, useRef } from 'react';
import { Plus, FileText, Trash2, Pencil, Eye, Upload, Download, Paperclip, Link2, Check } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Client, CrmDocument, CustomFieldType, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '../types';
import { DocumentEditor } from './DocumentEditor';
import { DocumentShareButtons } from './DocumentShareButtons';
import { uploadFile } from '../utils/apiClient';
import { useConfirm } from './ConfirmDialog';

interface DocumentsListProps {
    client: Client;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'טיוטה', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-white/10' },
    sent: { label: 'נשלח', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    viewed: { label: 'נצפה', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    signed: { label: 'נחתם ✓', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
};

const getDocumentUrl = (userId: string, publicToken: string) => {
    return `${window.location.origin}/doc/${userId}/${publicToken}`;
};

const getChecklistUrl = (userId: string, token: string) => {
    return `${window.location.origin}/task/${userId}/${token}`;
};

const formatBytes = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileEmoji = (mimeType?: string) => {
    if (!mimeType) return '📎';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📕';
    if (mimeType.includes('word')) return '📘';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📗';
    return '📎';
};

const timeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'הרגע';
    if (minutes < 60) return `לפני ${minutes} דקות`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `לפני ${hours} שעות`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `לפני ${days} ימים`;
    return new Date(timestamp).toLocaleDateString('he-IL');
};

export const DocumentsList: React.FC<DocumentsListProps> = ({ client }) => {
    const { documents, addDocument, deleteDocument, documentTemplates, userId, customFields } = useAppContext();
    const confirm = useConfirm();
    const [isEditorOpen, setEditorOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<CrmDocument | null>(null);
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [showTemplateList, setShowTemplateList] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const clientDocuments = useMemo(() => {
        return documents.filter(d => d.clientId === client.id);
    }, [documents, client.id]);

    // Checklists on this client that are shared externally — the client can use
    // these links to attach files without logging in.
    const sharedChecklists = useMemo(() => {
        return (client.tasks || []).filter(t => t.shareToken && (t.subtasks || []).length > 0);
    }, [client.tasks]);

    const phoneField = customFields.find(f => f.type === CustomFieldType.PHONE);
    const emailField = customFields.find(f => f.type === CustomFieldType.EMAIL);
    const clientPhone = phoneField ? client.customFields?.[phoneField.id] || '' : '';
    const clientEmail = emailField ? client.customFields?.[emailField.id] || '' : '';

    const handleNewBlank = () => {
        setEditingDoc(null);
        setEditorOpen(true);
        setShowCreateMenu(false);
    };

    const handleFromTemplate = (templateId: string) => {
        const template = documentTemplates.find(t => t.id === templateId);
        if (!template) return;
        setEditingDoc({
            id: '',
            clientId: client.id,
            title: template.name,
            templateId: template.id,
            status: 'draft',
            createdAt: 0,
            updatedAt: 0,
            publicToken: '',
            content: { ...template.content },
        } as any);
        setEditorOpen(true);
        setShowCreateMenu(false);
        setShowTemplateList(false);
    };

    const handleEdit = (doc: CrmDocument) => {
        setEditingDoc(doc);
        setEditorOpen(true);
    };

    const handleDelete = async (docId: string) => {
        if (await confirm({ message: 'האם אתה בטוח שברצונך למחוק מסמך זה?' })) {
            await deleteDocument(docId);
        }
    };

    const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
            alert('הקובץ גדול מדי. הגודל המרבי הוא 10MB.');
            return;
        }
        if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
            alert('סוג קובץ לא נתמך. ניתן להעלות תמונות, PDF, Word ו-Excel.');
            return;
        }
        setUploading(true);
        try {
            const fileUrl = await uploadFile(file, `documents/${client.id}`);
            const now = Date.now();
            await addDocument({
                clientId: client.id,
                title: file.name,
                status: 'sent',
                kind: 'file',
                fileUrl,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                uploadedBy: 'team',
                publicToken: '',
                createdAt: now,
                updatedAt: now,
            } as Omit<CrmDocument, 'id'>);
        } catch (err: any) {
            console.error('File upload failed', err);
            alert(`העלאת הקובץ נכשלה: ${err?.message || 'שגיאה'}`);
        } finally {
            setUploading(false);
        }
    };

    const handleCopyLink = async (token: string) => {
        const url = getChecklistUrl(userId, token);
        try {
            await navigator.clipboard.writeText(url);
            setCopiedToken(token);
            setTimeout(() => setCopiedToken(null), 2000);
        } catch {
            window.prompt('העתק את הקישור:', url);
        }
    };

    return (
        <div className="space-y-4">
            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowCreateMenu(!showCreateMenu)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-95 transition-all font-medium text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        יצירת מסמך
                    </button>
                    {showCreateMenu && (
                        <div className="absolute z-50 top-full right-0 mt-2 bg-white dark:bg-base-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl min-w-[200px] animate-in fade-in slide-in-from-top-1 overflow-hidden">
                            <button
                                type="button"
                                onClick={handleNewBlank}
                                className="w-full text-right px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3"
                            >
                                <span className="text-lg">📄</span>
                                <div>
                                    <p className="font-medium">מסמך חדש (ריק)</p>
                                    <p className="text-xs text-gray-500">יצירת מסמך ריק מאפס</p>
                                </div>
                            </button>
                            <div className="border-t border-gray-100 dark:border-white/5" />
                            <button
                                type="button"
                                onClick={() => { setShowTemplateList(!showTemplateList); }}
                                className="w-full text-right px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3"
                            >
                                <span className="text-lg">📋</span>
                                <div>
                                    <p className="font-medium">בחירה מתבנית</p>
                                    <p className="text-xs text-gray-500">{documentTemplates.length > 0 ? `${documentTemplates.length} תבניות זמינות` : 'אין תבניות – צור תבנית בהגדרות'}</p>
                                </div>
                            </button>
                            {showTemplateList && documentTemplates.length > 0 && (
                                <div className="border-t border-gray-100 dark:border-white/5 max-h-40 overflow-y-auto">
                                    {documentTemplates.map(t => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => handleFromTemplate(t.id)}
                                            className="w-full text-right px-6 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                                        >
                                            <FileText className="w-3.5 h-3.5 text-primary" />
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Upload file */}
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={ALLOWED_UPLOAD_TYPES.join(',')}
                    onChange={handleFilePicked}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 transition-all font-medium text-sm disabled:opacity-50"
                >
                    <Upload className="w-4 h-4" />
                    {uploading ? 'מעלה...' : 'העלאת קובץ'}
                </button>
            </div>

            {/* External file-collection links (from shared checklists) */}
            {sharedChecklists.length > 0 && (
                <div className="rounded-xl border border-green-100 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10 p-3 space-y-2">
                    <p className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5" />
                        לינקים לצירוף קבצים מהלקוח (ללא התחברות)
                    </p>
                    {sharedChecklists.map(t => (
                        <div key={t.id} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">{t.text}</span>
                            <button
                                type="button"
                                onClick={() => handleCopyLink(t.shareToken!)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-white/10 border border-green-200 dark:border-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors whitespace-nowrap"
                            >
                                {copiedToken === t.shareToken ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                                {copiedToken === t.shareToken ? 'הועתק' : 'העתק לינק'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Documents List */}
            {clientDocuments.length === 0 ? (
                <div className="text-center py-12 text-gray-400 dark:text-gray-600">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">אין מסמכים עדיין</p>
                    <p className="text-xs mt-1">צור מסמך חדש או העלה קובץ</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {clientDocuments.map(doc => {
                        // ── Uploaded file card ──
                        if (doc.kind === 'file') {
                            return (
                                <div key={doc.id} className="bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <span className="text-2xl leading-none mt-0.5">{fileEmoji(doc.mimeType)}</span>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-semibold text-gray-900 dark:text-white truncate">{doc.fileName || doc.title}</h4>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-400">
                                                    {doc.fileSize ? <span>{formatBytes(doc.fileSize)}</span> : null}
                                                    <span>{timeAgo(doc.createdAt)}</span>
                                                    <span className={`px-2 py-0.5 rounded-full font-bold ${doc.uploadedBy === 'client' ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20' : 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'}`}>
                                                        {doc.uploadedBy === 'client' ? 'מהלקוח' : 'צוות'}
                                                    </span>
                                                </div>
                                                {doc.sourceSubtaskText && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                                                        <Paperclip className="w-3 h-3" />
                                                        {doc.sourceSubtaskText}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <a
                                                href={doc.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                                title="הורדה / צפייה"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(doc.id)}
                                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                title="מחק"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // ── Generated document card ──
                        const statusInfo = STATUS_LABELS[doc.status] || STATUS_LABELS.draft;
                        return (
                            <div key={doc.id} className="bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-gray-900 dark:text-white truncate">{doc.title}</h4>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusInfo.color} ${statusInfo.bg}`}>
                                                {statusInfo.label}
                                            </span>
                                            <span className="text-xs text-gray-400">{timeAgo(doc.createdAt)}</span>
                                            {doc.signedAt && (
                                                <span className="text-xs text-green-600 dark:text-green-400">
                                                    נחתם {new Date(doc.signedAt).toLocaleDateString('he-IL')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => window.open(getDocumentUrl(userId, doc.publicToken), '_blank')}
                                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                            title="צפייה"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(doc)}
                                            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                            title="ערוך"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(doc.id)}
                                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            title="מחק"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Share buttons */}
                                <DocumentShareButtons
                                    documentUrl={getDocumentUrl(userId, doc.publicToken)}
                                    clientName={client.name}
                                    documentTitle={doc.title}
                                    clientPhone={clientPhone}
                                    clientEmail={clientEmail}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Editor Modal */}
            <DocumentEditor
                isOpen={isEditorOpen}
                onClose={() => { setEditorOpen(false); setEditingDoc(null); }}
                client={client}
                document={editingDoc || null}
            />
        </div>
    );
};
