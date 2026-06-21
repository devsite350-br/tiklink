
import React, { useState } from 'react';

export const BulkTaskModal: React.FC<{
    onClose: () => void;
    onAdd: (title: string, itemsText: string) => void;
}> = ({ onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [itemsText, setItemsText] = useState('');

    const handleSubmit = () => {
        if (!title.trim()) return;
        onAdd(title.trim(), itemsText);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" dir="rtl">
                <h3 className="text-xl font-bold mb-4">הוספת משימת צ'קליסט</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">צור משימה אחת שמכילה רשימת תתי-משימות. כל שורה הופכת לפריט נפרד בצ'קליסט.</p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">כותרת משימה</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-2 border rounded bg-white text-gray-900 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="לדוגמה: הכנת קמפיין שיווק"
                        autoFocus
                    />
                </div>

                <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">פריטי צ'קליסט</label>
                    <textarea
                        value={itemsText}
                        onChange={(e) => setItemsText(e.target.value)}
                        className="w-full h-40 p-2 border rounded bg-white text-gray-900 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="פריט 1&#10;פריט 2&#10;פריט 3"
                        aria-label="פריטי צ'קליסט"
                    />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500">ביטול</button>
                    <button onClick={handleSubmit} disabled={!title.trim()} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">צור צ'קליסט</button>
                </div>
            </div>
        </div>
    );
};
