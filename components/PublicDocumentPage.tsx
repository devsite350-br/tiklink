
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { SignatureCanvas } from './SignatureCanvas';
import { CrmDocument, Client, CustomFieldDefinition } from '../types';
import { Download, FileText, PenTool, Info, CheckCircle } from 'lucide-react';

interface PublicDocumentPageProps {
    userId: string;
    token: string;
}

export const PublicDocumentPage: React.FC<PublicDocumentPageProps> = ({ userId, token }) => {
    const [document, setDocument] = useState<CrmDocument | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [signerName, setSignerName] = useState('');
    const [signing, setSigning] = useState(false);
    const [signed, setSigned] = useState(false);
    const [docFirestoreId, setDocFirestoreId] = useState<string>('');

    // Override global overflow:hidden so the public page can scroll
    useEffect(() => {
        const root = window.document.getElementById('root');
        const html = window.document.documentElement;
        const body = window.document.body;
        html.style.overflow = 'auto';
        html.style.height = 'auto';
        body.style.overflow = 'auto';
        body.style.height = 'auto';
        if (root) { root.style.overflow = 'auto'; root.style.height = 'auto'; }
        return () => {
            html.style.overflow = '';
            html.style.height = '';
            body.style.overflow = '';
            body.style.height = '';
            if (root) { root.style.overflow = ''; root.style.height = ''; }
        };
    }, []);

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                // Direct query to the user's documents collection
                const docsCol = collection(db, 'users', userId, 'documents');
                const docsQuery = query(docsCol, where('publicToken', '==', token));
                const querySnapshot = await getDocs(docsQuery);

                if (querySnapshot.empty) {
                    setError('המסמך לא נמצא');
                    setLoading(false);
                    return;
                }

                const docSnap = querySnapshot.docs[0];
                const docData = { id: docSnap.id, ...docSnap.data() } as CrmDocument;
                setDocFirestoreId(docSnap.id);
                setDocument(docData);

                // Mark as viewed if it was just 'sent'
                if (docData.status === 'sent') {
                    await updateDoc(docSnap.ref, { status: 'viewed' });
                    setDocument(prev => prev ? { ...prev, status: 'viewed' } : null);
                }

                // If already signed, mark it
                if (docData.status === 'signed') {
                    setSigned(true);
                }

                // Fetch client data to resolve dynamic fields
                try {
                    const clientDoc = await getDoc(doc(db, 'users', userId, 'clients', docData.clientId));
                    if (clientDoc.exists()) {
                        setClient({ id: clientDoc.id, ...clientDoc.data() } as Client);
                    }
                } catch (e) {
                    console.error('Failed to fetch client', e);
                }

                // Fetch custom fields for dynamic replacement
                try {
                    const fieldsSnap = await getDocs(collection(db, 'users', userId, 'customFields'));
                    setCustomFields(fieldsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as CustomFieldDefinition));
                } catch (e) {
                    console.error('Failed to fetch custom fields', e);
                }

            } catch (err) {
                console.error('Error fetching document', err);
                setError('שגיאה בטעינת המסמך');
            } finally {
                setLoading(false);
            }
        };
        fetchDocument();
    }, [userId, token]);

    const replaceDynamicFields = useCallback((text: string) => {
        if (!text || !client) return text || '';
        let result = text;
        result = result.replace(/{{שם הלקוח}}/g, client.name || '');
        result = result.replace(/{{שם הפרויקט}}/g, client.name || '');
        result = result.replace(/{{תאריך היום}}/g, new Date().toLocaleDateString('he-IL'));
        customFields.forEach(f => {
            const value = client.customFields?.[f.id] || client.customFields?.[f.name] || '';
            result = result.replace(new RegExp(`{{${f.name}}}`, 'g'), String(value));
        });
        return result;
    }, [client, customFields]);

    const handleSign = async () => {
        if (!signatureData || !signerName.trim() || !document) return;
        setSigning(true);
        try {
            const docRef = doc(db, 'users', userId, 'documents', docFirestoreId);
            await updateDoc(docRef, {
                status: 'signed',
                signedAt: Date.now(),
                signatureDataUrl: signatureData,
                signerName: signerName.trim(),
            });
            setSigned(true);
            setDocument(prev => prev ? {
                ...prev,
                status: 'signed',
                signedAt: Date.now(),
                signatureDataUrl: signatureData,
                signerName: signerName.trim(),
            } : null);
        } catch (err) {
            console.error('Failed to sign document', err);
            alert('שגיאה בשמירת החתימה. אנא נסה שנית.');
        } finally {
            setSigning(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center" dir="rtl">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (error || !document) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4" dir="rtl">
                <div className="text-center">
                    <div className="mb-4"><FileText className="w-16 h-16 text-gray-400 mx-auto" /></div>
                    <h1 className="text-xl font-bold text-gray-800 mb-2">{error || 'המסמך לא נמצא'}</h1>
                    <p className="text-gray-500 text-sm">ייתכן שהקישור אינו תקין או שהמסמך כבר לא קיים.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 overflow-y-auto" dir="rtl">
            {/* Print styles */}
            <style>{`
                @media print {
                    body, html, #root { overflow: visible !important; height: auto !important; background: white !important; }
                    .no-print { display: none !important; }
                    .print-doc { box-shadow: none !important; border: none !important; border-radius: 0 !important; }
                    .min-h-screen { min-height: auto !important; background: white !important; }
                }
            `}</style>
            <div className="max-w-2xl mx-auto p-4 sm:p-8 pb-12">
                {/* Header */}
                <div className="text-center mb-6 flex items-center justify-between">
                    <button
                        onClick={() => window.print()}
                        className="no-print flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        הורד PDF
                    </button>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex-1 text-center">{document.title}</h1>
                    <div className="w-[100px] no-print" />
                </div>

                {/* Document Card */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="p-6 sm:p-8 space-y-6">
                        {/* Logo */}
                        {document.content.logoUrl && (
                            <div className="flex justify-center">
                                <img src={document.content.logoUrl} alt="Logo" className="max-h-16 max-w-[200px] object-contain" />
                            </div>
                        )}
                        {/* Header sections */}
                        {(document.content.headerRight || document.content.headerLeft) && (
                            <div className="flex justify-between items-start gap-6">
                                <div className="whitespace-pre-wrap text-sm text-gray-700 flex-1">
                                    {replaceDynamicFields(document.content.headerRight)}
                                </div>
                                <div className="whitespace-pre-wrap text-sm text-gray-700 text-left flex-1">
                                    {replaceDynamicFields(document.content.headerLeft)}
                                </div>
                            </div>
                        )}

                        {/* Body */}
                        {document.content.body && (
                            <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed border-t border-gray-100 pt-6">
                                {replaceDynamicFields(document.content.body)}
                            </div>
                        )}

                        {/* Signature Area */}
                        {document.content.showSignature && (
                            <div className="border-t border-gray-200 pt-6" id="signature-area">
                                {signed || document.status === 'signed' ? (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
                                        <h3 className="text-lg font-bold text-green-800">המסמך נחתם בהצלחה!</h3>
                                        <p className="text-sm text-green-700">
                                            נחתם על ידי: <strong>{document.signerName}</strong>
                                        </p>
                                        {document.signedAt && (
                                            <p className="text-xs text-green-600">
                                                {new Date(document.signedAt).toLocaleString('he-IL')}
                                            </p>
                                        )}
                                        {document.signatureDataUrl && (
                                            <div className="mt-3 border border-green-200 rounded-xl p-2 bg-white inline-block">
                                                <img src={document.signatureDataUrl} alt="חתימה" className="max-h-24" />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                            <PenTool className="w-5 h-5" /> חתימה ואישור
                                        </h3>
                                        <SignatureCanvas
                                            onSignatureChange={setSignatureData}
                                            disabled={false}
                                        />
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
                                            <input
                                                type="text"
                                                value={signerName}
                                                onChange={e => setSignerName(e.target.value)}
                                                placeholder="הזן את שמך המלא"
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-100 flex items-start gap-2">
                                            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" /> לחיצה על "אשר וחתום" מהווה אישור מחייב על תוכן מסמך זה.
                                        </div>
                                        <button
                                            onClick={handleSign}
                                            disabled={!signatureData || !signerName.trim() || signing}
                                            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-base"
                                        >
                                            {signing ? 'שומר...' : <><CheckCircle className="w-5 h-5 inline-block ml-1" /> אשר וחתום</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
