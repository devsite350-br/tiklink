
import React, { useState, useMemo } from 'react';
import { Plus, FileText, Trash2, Pencil, Eye } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Client, CrmDocument, CustomFieldType } from '../types';
import { DocumentEditor } from './DocumentEditor';
import { DocumentShareButtons } from './DocumentShareButtons';

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
    const { documents, deleteDocument, documentTemplates, userId, customFields } = useAppContext();
    const [isEditorOpen, setEditorOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<CrmDocument | null>(null);
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [showTemplateList, setShowTemplateList] = useState(false);

    const clientDocuments = useMemo(() => {
        return documents.filter(d => d.clientId === client.id);
    }, [documents, client.id]);

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
        // We create a "virtual" document with template content pre-filled
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
        // We set editingDoc to null so DocumentEditor treats it as new
        setEditorOpen(true);
        setShowCreateMenu(false);
        setShowTemplateList(false);
    };

    const handleEdit = (doc: CrmDocument) => {
        setEditingDoc(doc);
        setEditorOpen(true);
    };

    const handleDelete = async (docId: string) => {
        if (window.confirm('האם אתה בטוח שברצונך למחוק מסמך זה?')) {
            await deleteDocument(docId);
        }
    };

    return (
        <div className="space-y-4">
            {/* Create Button */}
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

            {/* Documents List */}
            {clientDocuments.length === 0 ? (
                <div className="text-center py-12 text-gray-400 dark:text-gray-600">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">אין מסמכים עדיין</p>
                    <p className="text-xs mt-1">צור מסמך חדש כדי לשלוח לבדיקה או לחתימה</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {clientDocuments.map(doc => {
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

                                {/* Share buttons - only after saved */}
                                {doc.status !== 'draft' && (
                                    <DocumentShareButtons
                                        documentUrl={getDocumentUrl(userId, doc.publicToken)}
                                        clientName={client.name}
                                        documentTitle={doc.title}
                                        clientPhone={clientPhone}
                                        clientEmail={clientEmail}
                                    />
                                )}
                                {doc.status === 'draft' && (
                                    <DocumentShareButtons
                                        documentUrl={getDocumentUrl(userId, doc.publicToken)}
                                        clientName={client.name}
                                        documentTitle={doc.title}
                                        clientPhone={clientPhone}
                                        clientEmail={clientEmail}
                                    />
                                )}
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
