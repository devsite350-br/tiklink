import React from 'react';

interface DashboardWidgetWrapperProps {
    title: string;
    children: React.ReactNode;
}

export const DashboardWidgetWrapper: React.FC<DashboardWidgetWrapperProps> = ({ title, children }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">{title}</h3>
            </div>
            <div className="p-4 flex-1 min-h-0">
                {children}
            </div>
        </div>
    );
};
