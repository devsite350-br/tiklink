import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { api } from '../utils/apiClient';
import { useConfirm } from './ConfirmDialog';

export const MeetingsSettings: React.FC = () => {
    const { connectedCalendars, deleteConnectedCalendar, visibilitySettings, updateVisibilitySettings, entityLabels } = useAppContext();
    const confirm = useConfirm();
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle Auth Callback
    useEffect(() => {
        const handleGoogleCallback = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (code) {
                setIsConnecting(true);
                try {
                    // Removing the query params from the URL cleanly
                    const cleanUrl = window.location.origin + '/';
                    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);

                    await api('calendar', { action: 'callback', code, redirectUri: cleanUrl });
                } catch (err: any) {
                    console.error('Google Auth Callback Error:', err);
                    setError(err.message || 'שגיאה בחיבור ליומן גוגל');
                } finally {
                    setIsConnecting(false);
                }
            }
        };

        handleGoogleCallback();
    }, []);

    const handleConnectClick = async () => {
        setIsConnecting(true);
        setError(null);
        try {
            const cleanUrl = window.location.origin + '/';
            const data = await api<{ url: string }>('calendar', { action: 'auth-url', redirectUri: cleanUrl });
            if (data && data.url) {
                window.location.href = data.url;
            }
        } catch (err: any) {
            console.error('Error getting auth url:', err);
            setError(err.message || 'שגיאה בקבלת כתובת ההתחברות');
            setIsConnecting(false);
        }
    };

    const handleVisibilityChange = (field: keyof typeof visibilitySettings.meetings, value: boolean) => {
        let updates: any = { [field]: value };
        if (field === 'enabled' && value) {
            updates.showInCard = true;
            updates.showInGrid = false;
            updates.showInList = false;
        }
        updateVisibilitySettings({
            ...visibilitySettings,
            meetings: { ...visibilitySettings.meetings, ...updates },
        });
    };

    return (
        <div className="space-y-6 relative">
            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-500/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3">הגדרות תצוגה - מודול יומן</h4>
                <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-2 cursor-pointer border-b border-blue-100 dark:border-blue-500/10 pb-4">
                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="toggle"
                                id="toggle-meetings"
                                checked={visibilitySettings.meetings?.enabled ?? true}
                                onChange={e => handleVisibilityChange('enabled', e.target.checked)}
                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out focus:outline-none focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                                style={{
                                    transform: (visibilitySettings.meetings?.enabled ?? true) ? 'translateX(-100%)' : 'translateX(0)',
                                    borderColor: (visibilitySettings.meetings?.enabled ?? true) ? '#3b82f6' : '#d1d5db',
                                    backgroundColor: (visibilitySettings.meetings?.enabled ?? true) ? '#3b82f6' : '#fff',
                                    right: 0
                                }}
                            />
                            <label
                                htmlFor="toggle-meetings"
                                className={`toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer transition-colors duration-200 ease-in-out disabled:opacity-50 ${(visibilitySettings.meetings?.enabled ?? true) ? 'bg-blue-200 dark:bg-blue-900' : 'bg-gray-300 dark:bg-gray-600'}`}
                            ></label>
                        </div>
                        <span className="text-gray-900 dark:text-gray-100 font-bold">הפעל מודול יומן</span>
                    </label>

                    <div className="flex flex-wrap items-center gap-4 text-sm mt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={visibilitySettings.meetings?.showInGrid ?? true} onChange={e => handleVisibilityChange('showInGrid', e.target.checked)} className="rounded text-primary focus:ring-primary" disabled={!(visibilitySettings.meetings?.enabled ?? true)} />
                            <span className={`text-gray-700 dark:text-gray-300 ${!(visibilitySettings.meetings?.enabled ?? true) ? 'opacity-50' : ''}`}>הצג בגריד</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={visibilitySettings.meetings?.showInList ?? true} onChange={e => handleVisibilityChange('showInList', e.target.checked)} className="rounded text-primary focus:ring-primary" disabled={!(visibilitySettings.meetings?.enabled ?? true)} />
                            <span className={`text-gray-700 dark:text-gray-300 ${!(visibilitySettings.meetings?.enabled ?? true) ? 'opacity-50' : ''}`}>הצג ברשימה</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={visibilitySettings.meetings?.showInCard ?? true} onChange={e => handleVisibilityChange('showInCard', e.target.checked)} className="rounded text-primary focus:ring-primary" disabled={!(visibilitySettings.meetings?.enabled ?? true)} />
                            <span className={`text-gray-700 dark:text-gray-300 ${!(visibilitySettings.meetings?.enabled ?? true) ? 'opacity-50' : ''}`}>{entityLabels.showInCard}</span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-base-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">חיבור ליומני גוגל (Google Calendar)</h3>
                <p className="text-sm text-gray-500 mb-6">
                    התחבר לחשבונות גוגל כדי לסנכרן אירועים מהמערכת ישירות ליומן שלך. ברגע שייווצר אירוע, הוא יישלח ליומנים המחוברים באופן אוטומטי.
                </p>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-200">
                        {error}
                    </div>
                )}

                <div className="space-y-4 mb-6">
                    {connectedCalendars.map((calendar) => (
                        <div key={calendar.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-base-950 border border-gray-200 dark:border-white/10 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-full shadow-sm">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                            <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                            <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.504 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.519 -19.444 63.239 -14.754 63.239 Z" />
                                            <path fill="#FBBC05" d="M -21.504 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.504 48.949 L -21.504 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.504 53.529 Z" />
                                            <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.959 -25.464 45.859 L -21.504 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                                        </g>
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-800 dark:text-white">{calendar.email}</h4>
                                    <span className="text-xs text-emerald-500 font-medium bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full inline-block mt-1">מחובר ופעיל</span>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (await confirm({ title: 'ניתוק יומן', message: 'האם אתה בטוח שברצונך לנתק חשבון זה?', confirmText: 'נתק' })) {
                                        deleteConnectedCalendar(calendar.id);
                                    }
                                }}
                                className="text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 p-2 rounded-xl text-sm font-medium transition-colors"
                            >
                                נתק יומן
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleConnectClick}
                    disabled={isConnecting}
                    className="flex justify-center flex-row-reverse items-center gap-3 w-full sm:w-auto px-6 py-3 bg-white border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 dark:bg-base-950 font-medium rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-base-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isConnecting ? (
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600 dark:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.504 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.519 -19.444 63.239 -14.754 63.239 Z" />
                                <path fill="#FBBC05" d="M -21.504 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.504 48.949 L -21.504 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.504 53.529 Z" />
                                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.959 -25.464 45.859 L -21.504 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                            </g>
                        </svg>
                    )}
                    <span>{isConnecting ? 'מתחבר למערכת...' : 'התחבר'}</span>
                </button>

            </div>
        </div>
    );
};
