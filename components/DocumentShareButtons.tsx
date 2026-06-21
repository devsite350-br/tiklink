
import React, { useState } from 'react';
import { Check, Copy, FileDown, Mail, Smartphone } from 'lucide-react';

interface DocumentShareButtonsProps {
    documentUrl: string;
    clientName: string;
    documentTitle: string;
    clientPhone?: string;
    clientEmail?: string;
}

export const DocumentShareButtons: React.FC<DocumentShareButtonsProps> = ({ documentUrl, clientName, documentTitle, clientPhone, clientEmail }) => {
    const [copied, setCopied] = useState(false);

    const shareMessage = `שלום ${clientName}, מצורף מסמך "${documentTitle}" לעיון ולחתימה:\n${documentUrl}`;
    const shareSubject = `מסמך: ${documentTitle}`;

    // Clean phone number for WhatsApp (remove spaces, dashes, leading 0 -> 972)
    const cleanPhone = (phone?: string) => {
        if (!phone) return '';
        let cleaned = phone.replace(/[\s\-()]/g, '');
        if (cleaned.startsWith('0')) cleaned = '972' + cleaned.substring(1);
        return cleaned;
    };

    const whatsappPhone = cleanPhone(clientPhone);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(documentUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const textArea = document.createElement('textarea');
            textArea.value = documentUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {/* Copy Link */}
            <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                title="העתק קישור"
            >
                {copied ? (
                    <>
                        <Check className="w-3.5 h-3.5" />
                        הועתק!
                    </>
                ) : (
                    <>
                        <Copy className="w-3.5 h-3.5" />
                        העתק
                    </>
                )}
            </button>

            {/* Download PDF */}
            <button
                onClick={() => {
                    const printWindow = window.open(documentUrl, '_blank');
                    if (printWindow) {
                        printWindow.addEventListener('load', () => {
                            setTimeout(() => printWindow.print(), 500);
                        });
                    }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                title="הורד PDF"
            >
                <FileDown className="w-3.5 h-3.5" />
                PDF
            </button>

            {/* WhatsApp */}
            <a
                href={whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(shareMessage)}` : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30 transition-all"
                title="שלח בוואטסאפ"
            >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                וואטסאפ
            </a>

            {/* Email */}
            <a
                href={`mailto:${clientEmail || ''}?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(shareMessage)}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-all"
                title="שלח באימייל"
            >
                <Mail className="w-3.5 h-3.5" />
                אימייל
            </a>

            {/* SMS */}
            <a
                href={`sms:${clientPhone || ''}?body=${encodeURIComponent(shareMessage)}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30 transition-all"
                title="שלח ב-SMS"
            >
                <Smartphone className="w-3.5 h-3.5" />
                SMS
            </a>
        </div>
    );
};
