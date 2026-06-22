import React, { useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { uploadFile } from '../utils/apiClient';
import { DEFAULT_LOGO_URL, MAX_UPLOAD_BYTES } from '../types';
import { Image as ImageIcon, Upload, Trash2, Loader2 } from 'lucide-react';

// "מערכת" settings tab. Currently hosts the configurable system logo.
export const SystemSettings: React.FC = () => {
    const { logoUrl, updateLogoUrl } = useAppContext();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const effectiveLogo = logoUrl || DEFAULT_LOGO_URL;
    const usingDefault = !logoUrl;

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'ניתן להעלות קובצי תמונה בלבד (PNG, JPG, SVG וכו\').' });
            return;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            setMessage({ type: 'error', text: 'הקובץ גדול מדי. הגודל המרבי הוא 10MB.' });
            return;
        }

        setIsUploading(true);
        setMessage(null);
        try {
            const url = await uploadFile(file, 'system/logo');
            await updateLogoUrl(url);
            setMessage({ type: 'success', text: 'הלוגו עודכן בהצלחה.' });
        } catch (err: any) {
            console.error('Logo upload failed', err);
            setMessage({ type: 'error', text: 'שגיאה בהעלאת הלוגו: ' + (err?.message || 'נסה שוב') });
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemove = async () => {
        setIsUploading(true);
        setMessage(null);
        try {
            await updateLogoUrl(null);
            setMessage({ type: 'success', text: 'הלוגו הוסר. המערכת חזרה ללוגו ברירת המחדל.' });
        } catch (err: any) {
            console.error('Logo reset failed', err);
            setMessage({ type: 'error', text: 'שגיאה בהסרת הלוגו: ' + (err?.message || 'נסה שוב') });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="bg-white dark:bg-base-900 rounded-2xl border border-gray-100 dark:border-white/5 p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-1">
                    <ImageIcon className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">לוגו מערכת</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    הלוגו שיוצג בראש המערכת ובקישור המשימות החיצוני המשותף ללקוחות. אם מסירים את הקובץ, המערכת חוזרת אוטומטית ללוגו ברירת המחדל — כך שתמיד יוצג לוגו.
                </p>

                {/* Current logo preview */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
                    <div className="flex items-center justify-center h-28 w-full sm:w-80 rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3">
                        <img src={effectiveLogo} alt="לוגו המערכת" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {usingDefault
                            ? 'מוצג כעת לוגו ברירת המחדל.'
                            : 'מוצג כעת הלוגו שהעלית.'}
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFile}
                />

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {isUploading ? 'מעלה...' : 'העלאת לוגו'}
                    </button>

                    {!usingDefault && (
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={isUploading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="w-4 h-4" />
                            הסרת לוגו (חזרה לברירת מחדל)
                        </button>
                    )}
                </div>

                {message && (
                    <p className={`mt-4 text-sm ${message.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {message.text}
                    </p>
                )}
            </section>
        </div>
    );
};
