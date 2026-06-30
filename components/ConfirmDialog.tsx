import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
    title?: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Promise-based confirmation dialog — a styled drop-in replacement for window.confirm.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message, danger })) { ... }
 */
export const useConfirm = (): ConfirmFn => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        throw new Error('useConfirm must be used within a <ConfirmProvider>');
    }
    return ctx;
};

interface DialogState {
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<DialogState | null>(null);
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback<ConfirmFn>((options) => {
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
            setState({ options, resolve });
        });
    }, []);

    const close = useCallback((result: boolean) => {
        setState((current) => {
            current?.resolve(result);
            return null;
        });
    }, []);

    const opts = state?.options;
    const danger = opts?.danger ?? true;

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state && ReactDOM.createPortal(
                <div
                    dir="rtl"
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => close(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <h3 className="text-xl font-bold dark:text-white">
                                {opts?.title ?? 'אישור מחיקה'}
                            </h3>
                            <span
                                className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${
                                    danger
                                        ? 'bg-red-100 dark:bg-red-900/40 text-red-500'
                                        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-500'
                                }`}
                            >
                                <AlertTriangle className="w-5 h-5" />
                            </span>
                        </div>
                        <div className="text-gray-600 dark:text-gray-300 mb-6">
                            {opts?.message}
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => close(false)}
                                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                            >
                                {opts?.cancelText ?? 'ביטול'}
                            </button>
                            <button
                                type="button"
                                autoFocus
                                onClick={() => close(true)}
                                className={`px-4 py-2 rounded-lg text-white font-medium shadow-md transition-all hover:scale-105 active:scale-95 ${
                                    danger
                                        ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                        : 'bg-primary hover:bg-opacity-90 shadow-primary/20'
                                }`}
                            >
                                {opts?.confirmText ?? 'מחק'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </ConfirmContext.Provider>
    );
};
