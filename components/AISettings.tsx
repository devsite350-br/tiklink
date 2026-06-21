import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { api } from '../utils/apiClient';
import { ShieldCheck, EyeOff, Eye } from 'lucide-react';

export const AISettings: React.FC = () => {
    const { userId } = useAppContext();
    const [aiEnabled, setAiEnabled] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [maskedKey, setMaskedKey] = useState('');
    const [hasExistingKey, setHasExistingKey] = useState(false);
    const [isEditingKey, setIsEditingKey] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [showKey, setShowKey] = useState(false);
    const keyInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!userId) return;
            try {
                const data = await api<{ aiEnabled: boolean; maskedKey: string; hasKey: boolean }>('ai/settings', undefined, 'GET');
                setAiEnabled(data.aiEnabled || false);
                setMaskedKey(data.maskedKey || '');
                setHasExistingKey(data.hasKey || false);
            } catch (error) {
                console.error("Error fetching AI settings:", error);
                setMessage({ text: 'שגיאה בטעינת הנתונים', type: 'error' });
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [userId]);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const payload: { aiEnabled: boolean; apiKey?: string } = { aiEnabled };
            // Send the key if the user typed anything in the key field
            if (apiKey.trim()) {
                payload.apiKey = apiKey.trim();
            }
            const data = await api<{ success: boolean; maskedKey: string; aiEnabled: boolean }>('ai/settings', payload, 'POST');
            setMaskedKey(data.maskedKey || '');
            setHasExistingKey(!!data.maskedKey);
            setApiKey('');
            setIsEditingKey(false);
            setShowKey(false);
            setMessage({ text: 'ההגדרות נשמרו בהצלחה', type: 'success' });
        } catch (error) {
            console.error("Error saving AI settings:", error);
            setMessage({ text: 'שגיאה בשמירת הנתונים', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleStartEditing = () => {
        setIsEditingKey(true);
        setApiKey('');
        setShowKey(false);
        setTimeout(() => keyInputRef.current?.focus(), 0);
    };

    const handleCancelEditing = () => {
        setIsEditingKey(false);
        setApiKey('');
        setShowKey(false);
    };

    if (loading) {
        return <div className="text-center py-4 text-gray-400">טוען הגדרות...</div>;
    }

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-8" dir="rtl">
            <div>
                <h2 className="text-2xl font-bold mb-2">הגדרות AI</h2>
                <p className="text-gray-500">
                    כאן תוכל להגדיר עיבוד אוטומטי של פניות נכנסות באמצעות בינה מלאכותית (Gemini).
                </p>
            </div>

            <div className="bg-white dark:bg-base-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 space-y-6">

                {/* Enable Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">הפעל עיבוד AI</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            כאשר מופעל, פניות חדשות יעברו ניתוח אוטומטי לתיוג וסיכום.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={aiEnabled}
                            onChange={(e) => setAiEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                </div>

                {/* API Key Section */}
                {aiEnabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            מפתח API של Gemini (Google AI Studio)
                        </label>

                        {/* Show masked key if exists and not editing */}
                        {hasExistingKey && !isEditingKey ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-base-900/50" dir="ltr">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
                                        <span className="font-mono text-sm text-gray-600 dark:text-gray-300 tracking-wider truncate">
                                            {maskedKey || '••••••••••••••••••••'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleStartEditing}
                                        className="px-3 py-1.5 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors whitespace-nowrap shrink-0"
                                    >
                                        החלף מפתח
                                    </button>
                                </div>
                                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 justify-end">
                                    <span>המפתח מוצפן ומאובטח</span>
                                </p>
                            </div>
                        ) : (
                            /* Input for new key */
                            <div className="space-y-2">
                                <div className="relative" dir="ltr">
                                    <input
                                        ref={keyInputRef}
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="הדבק את המפתח כאן (AIza...)"
                                        className="w-full px-4 py-2 pl-12 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-base-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all font-mono text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowKey(!showKey);
                                            setTimeout(() => keyInputRef.current?.focus(), 0);
                                        }}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
                                        title={showKey ? 'הסתר מפתח' : 'הצג מפתח'}
                                    >
                                        {showKey ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                {hasExistingKey && isEditingKey && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEditing}
                                        className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                    >
                                        ביטול - השאר מפתח קיים
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="text-sm text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-500/30">
                            <p className="font-semibold mb-1">איך משיגים מפתח?</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>היכנס ל- <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">Google AI Studio</a>.</li>
                                <li>לחץ על <strong>Create API Key</strong>.</li>
                                <li>בחר ב-<strong>Create API key in new project</strong> (הכי פשוט).</li>
                                <li>העתק את המפתח שנוצר והדבק אותו כאן.</li>
                            </ol>
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                    {message && (
                        <span className={`text-sm font-medium ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                            {message.text}
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`mr-auto px-6 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {saving ? 'שומר...' : 'שמור הגדרות'}
                    </button>
                </div>

            </div>
        </div>
    );
};
