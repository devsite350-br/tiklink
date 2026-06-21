import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    mode?: 'center' | 'side';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, mode = 'center' }) => {
    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const containerClasses = mode === 'side'
        ? "fixed inset-0 bg-base-950/60 backdrop-blur-sm flex items-stretch justify-start z-50 transition-opacity duration-300"
        : "fixed inset-0 bg-base-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300";

    const contentClasses = mode === 'side'
        ? "bg-white dark:bg-base-900 shadow-2xl w-full md:w-1/2 h-full flex flex-col border-l border-gray-100 dark:border-white/10 overflow-hidden transform transition-all"
        : "bg-white dark:bg-base-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-white/10 overflow-hidden transform transition-all scale-100";

    return ReactDOM.createPortal(
        <div
            className={containerClasses}
            dir="rtl"
            onClick={handleBackdropClick}
        >
            <div className={contentClasses}>
                <header className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex-shrink-0">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all"
                        aria-label="סגור חלון"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>
                <main className="p-6 overflow-y-auto hide-scrollbar flex-grow">
                    {children}
                </main>
            </div>
        </div>,
        document.body
    );
};