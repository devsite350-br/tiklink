
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { DefaultLogo } from './components/DefaultLogo';
import { ClientGrid } from './components/ClientGrid';
import { ClientTable } from './components/ClientTable';
import { TasksPage } from './components/TasksPage';
import { MeetingsPage } from './components/MeetingsPage';
import { Client, UNASSOCIATED_CLIENT_ID } from './types';
import { ClientFormModal } from './components/ClientFormModal';
import { ManageFieldsPage } from './components/ManageFieldsPage';
import { auth } from './firebaseConfig';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { Login } from './components/Login';
import { ProfilePage } from './components/ProfilePage';
import { TeamSettings } from './components/TeamSettings';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ClientExportModal } from './components/ClientExportModal';
import { ClientImportModal } from './components/ClientImportModal';
import { UserAvatar } from './components/UserAvatar';
import { PublicDocumentPage } from './components/PublicDocumentPage';
import { PublicChecklistPage } from './components/PublicChecklistPage';
import { Users, ClipboardList, Calendar, Settings, Sun, Moon, User as UserIcon, ChevronDown, Search, ArrowUpDown, SortAsc, SortDesc, Filter, Tag, Upload, Download, LayoutGrid, List, Plus, AlertTriangle, LogOut, Menu, X, SlidersHorizontal } from 'lucide-react';
import { NotificationCenter } from './components/NotificationCenter';
import { useNotifications } from './hooks/useNotifications';
import { CrmNotification } from './types';
const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

const SupportBar: React.FC<{ targetEmail: string }> = ({ targetEmail }) => (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-sm flex items-center justify-between px-4 py-2 shadow-lg">
        <span className="font-medium">מצב תמיכה — {targetEmail}</span>
        <button
            onClick={() => { signOut(auth); }}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
        >
            יציאה
        </button>
    </div>
);

// Reads config/owner and auto-enters the CRM as the owner.
const SuperAdminGateway: React.FC = () => {
    const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const ownerSnap = await getDoc(doc(db, 'config', 'owner'));
                if (!ownerSnap.exists()) { setError('אין חשבון רשום במערכת זו עדיין.'); return; }
                const uid = ownerSnap.data().uid as string;
                const userSnap = await getDoc(doc(db, 'users', uid));
                const email = userSnap.exists() ? (userSnap.data().email || uid) : uid;
                setOwnerId(uid);
                setOwnerEmail(email);
                sessionStorage.setItem('impersonatedUserId', uid);
                sessionStorage.setItem('impersonatedUserEmail', email);
                window.location.replace('/');
            } catch {
                setError('שגיאה בקריאת נתוני החשבון.');
            }
        })();
    }, []);

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-gray-500">
            <p>{error}</p>
            <button onClick={() => signOut(auth)} className="text-sm text-red-500 underline">יציאה</button>
        </div>
    );
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
        </div>
    );
};

type View = 'clients' | 'tasks' | 'meetings' | 'settings' | 'team' | 'profile';
type ClientView = 'grid' | 'table';

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-full w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
);

const Header: React.FC<{
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onAddClientClick: () => void;
    view: View;
    onViewChange: (view: View) => void;
    clientView: ClientView;
    onClientViewChange: (view: ClientView) => void;
    user: User;
    onExportClick: () => void;
    onImportClick: () => void;
    filterStatus: string;
    setFilterStatus: (s: string) => void;
    filterLabelId: string;
    setFilterLabelId: (s: string) => void;
    sortDirection: 'desc' | 'asc';
    setSortDirection: (d: 'desc' | 'asc') => void;
    onToggleMobileSidebar: () => void;
    hasActiveFilters: boolean;
    notificationProps: {
        notifications: CrmNotification[];
        unreadCount: number;
        settings: import('./types').NotificationSettings;
        onMarkAsRead: (id: string) => void;
        onMarkAllAsRead: () => void;
        onDismiss: (id: string) => void;
        onUpdateSettings: (settings: import('./types').NotificationSettings) => void;
        onNotificationClick?: (notification: CrmNotification) => void;
    };
}> = ({ searchTerm, setSearchTerm, onAddClientClick, view, onViewChange, clientView, onClientViewChange, user, onExportClick, onImportClick, filterStatus, setFilterStatus, filterLabelId, setFilterLabelId, sortDirection, setSortDirection, onToggleMobileSidebar, hasActiveFilters, notificationProps }) => {

    const { isSyncing, dbError, statuses, labels, visibilitySettings, entityLabels, logoUrl } = useAppContext();

    const [isDark, setIsDark] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const profileMenuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
                setProfileMenuOpen(false);
            }
        };
        if (profileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [profileMenuOpen]);

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        } else {
            document.documentElement.classList.remove('dark');
            setIsDark(false);
        }
    }, []);

    const toggleTheme = () => {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setIsDark(false);
        } else {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDark(true);
        }
    };

    const navItems: { id: View, label: string, icon: React.ReactNode }[] = [
        { id: 'clients', label: entityLabels.plural, icon: <Users className="w-5 h-5" /> },
        ...(visibilitySettings?.tasks?.enabled !== false ? [{ id: 'tasks' as View, label: 'משימות', icon: <ClipboardList className="w-5 h-5" /> }] : []),
        { id: 'settings', label: 'הגדרות', icon: <Settings className="w-5 h-5" /> },
    ];

    return (
        <header className="sticky top-0 z-30 w-full backdrop-blur-xl bg-white/80 dark:bg-base-950/80 border-b border-gray-200 dark:border-white/5 transition-colors duration-300">
            {dbError && (
                <div className="bg-red-500/10 backdrop-blur border-b border-red-500/20 text-red-600 dark:text-red-400 text-sm p-2 flex justify-center items-center gap-4">
                    <span>{dbError}</span>
                    <button onClick={() => window.location.reload()} className="underline font-bold hover:text-red-700 dark:hover:text-red-300">טען מחדש</button>
                </div>
            )}

            <div className="max-w-[1920px] mx-auto px-2 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
                {/* Logo */}
                <div className="flex items-center shrink-0">
                    {/* Desktop Logo */}
                    <button
                        onClick={() => onViewChange('clients')}
                        className="hidden md:flex items-center gap-2 hover:opacity-80 transition-opacity text-left cursor-pointer"
                        title="חזרה לעמוד הראשי"
                    >
                        {logoUrl
                            ? <img src={logoUrl} alt="לוגו המערכת" className="h-9 w-auto max-w-[180px] object-contain" />
                            : <DefaultLogo className="h-9 w-auto" />}
                    </button>

                    {/* Mobile Toggle Button (replacing logo on mobile) */}
                    <button
                        onClick={onToggleMobileSidebar}
                        className="relative md:hidden flex items-center justify-center p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title="תפריט פילטרים וחיפוש"
                    >
                        <div className="relative">
                            <SlidersHorizontal className="w-5 h-5 text-primary" />
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                </span>
                            )}
                        </div>
                    </button>
                </div>

                {/* Mobile Menu */}
                <div className="flex-1 flex min-w-0 md:hidden">
                    <div className="flex items-center gap-0.5 bg-gray-100/50 dark:bg-white/5 p-1 rounded-2xl border border-gray-200/50 dark:border-white/5 w-full">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onViewChange(item.id)}
                                className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-1 rounded-xl transition-all duration-200 ${view === item.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                                    }`}
                                title={item.label}
                            >
                                {item.icon}
                                <span className="text-[9px] leading-none">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-1 bg-gray-100/50 dark:bg-white/5 p-1 rounded-2xl border border-gray-200/50 dark:border-white/5">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${view === item.id
                                ? 'bg-white dark:bg-base-800 text-primary shadow-sm shadow-gray-200/50 dark:shadow-none'
                                : 'text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                                }`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Right Actions */}
                <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                    <NotificationCenter
                        notifications={notificationProps.notifications}
                        unreadCount={notificationProps.unreadCount}
                        settings={notificationProps.settings}
                        onMarkAsRead={notificationProps.onMarkAsRead}
                        onMarkAllAsRead={notificationProps.onMarkAllAsRead}
                        onDismiss={notificationProps.onDismiss}
                        onUpdateSettings={notificationProps.onUpdateSettings}
                        onNotificationClick={notificationProps.onNotificationClick}
                    />

                    <button
                        onClick={toggleTheme}
                        className="hidden md:block p-1 sm:p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        title={isDark ? "מצב יום" : "מצב לילה"}
                    >
                        {isDark ? (
                            <Sun className="w-5 h-5 text-amber-400" />
                        ) : (
                            <Moon className="w-5 h-5 text-sky-400" />
                        )}
                    </button>

                    <div className="h-8 w-[1px] bg-gray-200 dark:bg-white/10 hidden md:block"></div>

                    <div className="relative" ref={profileMenuRef}>
                        {/* Desktop: avatar + name */}
                        <button
                            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                            className="hidden lg:flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-white/5 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                            <UserAvatar
                                name={user.displayName || user.email?.split('@')[0] || ''}
                                photoUrl={user.photoURL || ''}
                                size="sm"
                                showTooltip={false}
                            />
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.displayName || user.email?.split('@')[0]}</span>
                                <span className="text-[10px] text-gray-400">{user.email}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {/* Mobile: avatar only */}
                        <button
                            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                            className="lg:hidden p-1 rounded-full"
                            title="תפריט"
                        >
                            <UserAvatar
                                name={user.displayName || user.email?.split('@')[0] || ''}
                                photoUrl={user.photoURL || ''}
                                size="sm"
                                showTooltip={false}
                            />
                        </button>
                        {/* Dropdown Menu */}
                        {profileMenuOpen && (
                            <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-48 bg-white dark:bg-base-800 rounded-xl shadow-xl border border-gray-200 dark:border-white/10 py-1 z-50 animate-in fade-in slide-in-from-top-1">
                                <button
                                    onClick={() => { onViewChange('profile'); setProfileMenuOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-right"
                                >
                                    <UserIcon className="w-4 h-4 text-gray-400" />
                                    עריכת פרופיל
                                </button>
                                <button
                                    onClick={() => { toggleTheme(); setProfileMenuOpen(false); }}
                                    className="md:hidden w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-right"
                                >
                                    {isDark ? (
                                        <>
                                            <Sun className="w-4 h-4 text-amber-400" />
                                            מצב יום
                                        </>
                                    ) : (
                                        <>
                                            <Moon className="w-4 h-4 text-sky-400" />
                                            מצב לילה
                                        </>
                                    )}
                                </button>
                                <div className="border-t border-gray-100 dark:border-white/5 my-1"></div>
                                <button
                                    onClick={() => { signOut(auth); setProfileMenuOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-right"
                                >
                                    <LogOut className="w-4 h-4" />
                                    יציאה
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Menu & Search/Filter Bar */}
            <div className="hidden md:block px-4 pb-4">


                {view === 'clients' && (
                    <div className="flex gap-3 mt-2">
                        <div className="relative flex-1 group">
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                                <Search className="w-5 h-5" />
                            </div>
                            <input
                                type="search"
                                placeholder="חיפוש..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full pr-10 ${searchTerm ? 'pl-9' : 'pl-4'} py-2.5 bg-gray-100/50 dark:bg-base-900/50 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white placeholder-gray-400 transition-all shadow-inner`}
                                disabled={!!dbError}
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-red-500 cursor-pointer"
                                    title="איפוס חיפוש"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">

                            {/* Sort Button */}
                            <button
                                onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                                className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 w-[42px] sm:w-auto h-[42px] px-0 sm:px-3 bg-gray-100/50 dark:bg-base-900/50 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors border border-transparent"
                                title={sortDirection === 'desc' ? 'מיון: מחדש לישן' : 'מיון: מישן לחדש'}
                            >
                                <span className="hidden sm:inline text-gray-700 dark:text-gray-300 text-sm">יצירה</span>
                                {sortDirection === 'desc' ? (
                                    <SortDesc className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500" />
                                ) : (
                                    <SortAsc className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500" />
                                )}
                                <span className="sm:hidden text-[9px] leading-none text-gray-500 dark:text-gray-400">מיון</span>
                            </button>

                            {/* Status Filter - hidden in grid view */}
                            {clientView !== 'grid' && (
                                <div className="relative w-[42px] h-[42px] sm:w-auto sm:h-[42px] sm:min-w-[120px]">
                                    {/* Below sm view */}
                                    {filterStatus ? (
                                        <button
                                            onClick={() => setFilterStatus('')}
                                            className="absolute inset-0 flex sm:hidden flex-col items-center justify-center gap-0.5 bg-red-500/10 dark:bg-red-500/20 text-red-500 rounded-xl z-20 cursor-pointer"
                                            title="איפוס סטטוס"
                                        >
                                            <X className="w-4 h-4" />
                                            <span className="text-[9px] leading-none">אפס</span>
                                        </button>
                                    ) : (
                                        <div className="absolute inset-0 flex sm:hidden flex-col items-center justify-center gap-0.5 bg-gray-100/50 dark:bg-base-900/50 rounded-xl pointer-events-none">
                                            <Filter className="w-5 h-5 text-gray-500" />
                                            <span className="text-[9px] leading-none text-gray-500 dark:text-gray-400">סטטוס</span>
                                        </div>
                                    )}

                                    {/* Above sm view */}
                                    {filterStatus ? (
                                        <button
                                            onClick={() => setFilterStatus('')}
                                            className="hidden sm:flex absolute inset-y-0 left-3 items-center justify-center text-gray-400 hover:text-red-500 z-20 cursor-pointer"
                                            title="איפוס סטטוס"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    ) : (
                                        <div className="hidden sm:flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none">
                                            <Filter className="w-4 h-4 text-gray-400" />
                                        </div>
                                    )}

                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="block w-full h-full opacity-0 sm:opacity-100 sm:static absolute inset-0 z-10 sm:pl-9 sm:pr-3 sm:py-2.5 text-sm rounded-xl border-transparent bg-gray-100/50 dark:bg-base-900/50 dark:text-gray-300 appearance-none focus:ring-0 focus:border-transparent cursor-pointer"
                                        aria-label="סינון לפי סטטוס"
                                    >
                                        <option value="">כל הסטטוסים</option>
                                        {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Label/Tag Filter */}
                            <div className="relative w-[42px] h-[42px] sm:w-auto sm:h-[42px] sm:min-w-[120px]">
                                {/* Below sm view */}
                                {filterLabelId ? (
                                    <button
                                        onClick={() => setFilterLabelId('')}
                                        className="absolute inset-0 flex sm:hidden flex-col items-center justify-center gap-0.5 bg-red-500/10 dark:bg-red-500/20 text-red-500 rounded-xl z-20 cursor-pointer"
                                        title="איפוס תגית"
                                    >
                                        <X className="w-4 h-4" />
                                        <span className="text-[9px] leading-none">אפס</span>
                                    </button>
                                ) : (
                                    <div className="absolute inset-0 flex sm:hidden flex-col items-center justify-center gap-0.5 bg-gray-100/50 dark:bg-base-900/50 rounded-xl pointer-events-none">
                                        <Tag className="w-5 h-5 text-gray-500" />
                                        <span className="text-[9px] leading-none text-gray-500 dark:text-gray-400">תגית</span>
                                    </div>
                                )}

                                {/* Above sm view */}
                                {filterLabelId ? (
                                    <button
                                        onClick={() => setFilterLabelId('')}
                                        className="hidden sm:flex absolute inset-y-0 left-3 items-center justify-center text-gray-400 hover:text-red-500 z-20 cursor-pointer"
                                        title="איפוס תגית"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                ) : (
                                    <div className="hidden sm:flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none">
                                        <Tag className="w-4 h-4 text-gray-400" />
                                    </div>
                                )}

                                <select
                                    value={filterLabelId}
                                    onChange={(e) => setFilterLabelId(e.target.value)}
                                    className="block w-full h-full opacity-0 sm:opacity-100 sm:static absolute inset-0 z-10 sm:pl-9 sm:pr-3 sm:py-2.5 text-sm rounded-xl border-transparent bg-gray-100/50 dark:bg-base-900/50 dark:text-gray-300 appearance-none focus:ring-0 focus:border-transparent cursor-pointer"
                                    aria-label="סינון לפי תגית"
                                >
                                    <option value="">כל התגיות</option>
                                    {labels.filter(l => !l.module || l.module === 'client').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>

                            <button
                                onClick={onImportClick}
                                disabled={!!dbError}
                                className="hidden sm:flex flex-col items-center justify-center gap-0.5 w-[42px] h-[42px] bg-white dark:bg-base-800 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-white rounded-xl shadow-sm hover:shadow transition-all"
                                title="ייבא מאקסל"
                            >
                                <Upload className="w-5 h-5" />
                                <span className="text-[9px] leading-none">ייבוא</span>
                            </button>
                            <button
                                onClick={onExportClick}
                                disabled={!!dbError}
                                className="hidden sm:flex flex-col items-center justify-center gap-0.5 w-[42px] h-[42px] bg-white dark:bg-base-800 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-white rounded-xl shadow-sm hover:shadow transition-all"
                                title="ייצא לאקסל"
                            >
                                <Download className="w-5 h-5" />
                                <span className="text-[9px] leading-none">ייצוא</span>
                            </button>
                            <div className="flex p-1 bg-gray-100/50 dark:bg-base-900/50 rounded-xl">
                                <button onClick={() => onClientViewChange('grid')} className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-all ${clientView === 'grid' ? 'bg-white dark:bg-base-800 shadow text-primary' : 'text-gray-400 hover:text-gray-600'}`} title="תצוגת כרטיסים">
                                    <LayoutGrid className="w-5 h-5" />
                                    <span className="text-[9px] leading-none">גריד</span>
                                </button>
                                <button onClick={() => onClientViewChange('table')} className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-all ${clientView === 'table' ? 'bg-white dark:bg-base-800 shadow text-primary' : 'text-gray-400 hover:text-gray-600'}`} title="תצוגת טבלה">
                                    <List className="w-5 h-5" />
                                    <span className="text-[9px] leading-none">טבלה</span>
                                </button>
                            </div>
                            <button
                                onClick={onAddClientClick}
                                disabled={!!dbError}
                                className="hidden sm:flex items-center gap-2 bg-primary hover:bg-primary/90 text-white pl-4 pr-3 h-[42px] rounded-xl font-medium shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-95 text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span>{entityLabels.addNew}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

        </header>
    );
};

const AppContent: React.FC<{ user: User; onUserRefresh: () => void }> = ({ user, onUserRefresh }) => {
    const { clients, statuses, labels, isLoading, dbError, addClient, plan, entityLabels, meetings, effectiveUserId, userId, logoUrl } = useAppContext();

    const {
        notifications: notifList,
        unreadCount: notifUnreadCount,
        settings: notifSettings,
        markAsRead: notifMarkAsRead,
        markAllAsRead: notifMarkAllAsRead,
        dismissNotification: notifDismiss,
        updateSettings: notifUpdateSettings,
    } = useNotifications(effectiveUserId, userId, meetings, clients);
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<View>('clients');
    const [clientView, setClientView] = useState<ClientView>(() => {
        const saved = localStorage.getItem('clientView');
        return (saved === 'grid' || saved === 'table') ? saved : 'grid';
    });
    const [filterStatus, setFilterStatus] = useState('');
    const [filterLabelId, setFilterLabelId] = useState('');
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const unassociatedCreated = useRef(false);

    useEffect(() => {
        localStorage.setItem('clientView', clientView);
    }, [clientView]);
    const [isClientModalOpen, setClientModalOpen] = useState(false);
    const [isExportModalOpen, setExportModalOpen] = useState(false);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

    const selectedClient = useMemo(() => {
        if (!selectedClientId) return null;
        return clients.find(c => c.id === selectedClientId) || null;
    }, [clients, selectedClientId]);

    useEffect(() => {
        const handleJoin = async () => {
            const params = new URLSearchParams(window.location.search);
            const joinId = params.get('join');
            const token = params.get('token');
            if (joinId && user) {
                if (joinId === user.uid) {
                    alert("לא ניתן להצטרף לצוות של עצמך.");
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return;
                }

                try {
                    // SECURITY CHECK
                    const ownerDoc = await getDoc(doc(db, 'users', joinId));
                    if (ownerDoc.exists()) {
                        const ownerData = ownerDoc.data();
                        if (ownerData.inviteToken && ownerData.inviteToken !== token) {
                            alert("קישור ההזמנה אינו תקין (טוקן לא תואם).");
                            window.history.replaceState({}, document.title, window.location.pathname);
                            return;
                        }
                    }

                    // 1. Add self to Owner's team_members
                    await setDoc(doc(db, 'users', joinId, 'team_members', user.uid), {
                        email: user.email,
                        joinedAt: Date.now()
                    });

                    // 2. Set organizationId in own profile
                    await setDoc(doc(db, 'users', user.uid), {
                        organizationId: joinId
                    }, { merge: true });

                    window.history.replaceState({}, document.title, window.location.pathname);
                    window.location.reload(); // Reload to refresh context
                } catch (error) {
                    console.error("Join Error:", error);
                    alert("שגיאה בהצטרפות לצוות. ייתכן שאין לך הרשאות או שהקישור שגוי.");
                }
            }
        };
        handleJoin();
    }, [user]);

    const handleNotificationClick = useCallback((notification: CrmNotification) => {
        notifMarkAsRead(notification.id);
        if (notification.relatedType === 'meeting') {
            setView('meetings');
        } else if (notification.relatedType === 'task') {
            if (notification.clientId) {
                const client = clients.find(c => c.id === notification.clientId);
                if (client) {
                    setSelectedClientId(client.id);
                    setClientModalOpen(true);
                    return;
                }
            }
            setView('tasks');
        }
    }, [clients, notifMarkAsRead]);

    // Listen for notification clicks — from custom events (desktop) and SW messages (mobile PWA)
    useEffect(() => {
        const handler = (e: Event) => {
            const notif = (e as CustomEvent).detail as CrmNotification;
            if (notif) handleNotificationClick(notif);
        };
        window.addEventListener('crm-notification-click', handler);

        const swHandler = (e: MessageEvent) => {
            if (e.data?.type === 'notification-click' && e.data.notification) {
                handleNotificationClick(e.data.notification as CrmNotification);
            }
        };
        navigator.serviceWorker?.addEventListener('message', swHandler);

        return () => {
            window.removeEventListener('crm-notification-click', handler);
            navigator.serviceWorker?.removeEventListener('message', swHandler);
        };
    }, [handleNotificationClick]);

    const openClientModal = (client: Client | null = null) => {
        setSelectedClientId(client ? client.id : null);
        setClientModalOpen(true);
    };

    const { updateClient } = useAppContext();

    // Migration: Backfill createdAt for existing clients (One-time fix)
    const attemptedBackfills = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!isLoading && clients.length > 0) {
            const defaultDate = new Date('2026-01-01').getTime();
            const clientsToFix = clients.filter(c => !c.createdAt && !attemptedBackfills.current.has(c.id));

            if (clientsToFix.length > 0) {
                console.log(`Backfilling createdAt for ${clientsToFix.length} clients...`);
                // Process to avoid infinite loop on permission failure
                clientsToFix.forEach(client => {
                    attemptedBackfills.current.add(client.id);
                    updateClient({ id: client.id, createdAt: defaultDate }).catch(console.error);
                });
            }
        }
    }, [clients, isLoading, updateClient]);

    useEffect(() => {
        if (!isLoading && statuses.length > 0) {
            const unassociated = clients.find(c => c.id === UNASSOCIATED_CLIENT_ID);
            if (!unassociated && !unassociatedCreated.current) {
                unassociatedCreated.current = true;
                updateClient({
                    id: UNASSOCIATED_CLIENT_ID,
                    name: 'משימות כלליות',
                    status: statuses[0].name,
                    tasks: [],
                    comments: [],
                    customFields: {},
                    labelIds: []
                });
            }
        }
    }, [clients, isLoading, statuses, updateClient]);

    const filteredClients = useMemo(() => {
        let result = (clients || []).filter(c => c.id !== UNASSOCIATED_CLIENT_ID);

        // Filter by status
        if (filterStatus) {
            result = result.filter(c => c.status === filterStatus);
        }

        // Filter by label/tag
        if (filterLabelId) {
            result = result.filter(c => c.labelIds && c.labelIds.includes(filterLabelId));
        }

        // Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(term) ||
                (c.notes && c.notes.toLowerCase().includes(term)) ||
                (c.customFields && Object.values(c.customFields).some(v => String(v).toLowerCase().includes(term)))
            );
        }

        return result;
    }, [clients, searchTerm, filterStatus, filterLabelId]);

    const clientsByStatus = useMemo(() => {
        const grouped: { [key: string]: Client[] } = {};
        if (statuses) statuses.forEach(s => grouped[s.name] = []);
        if (filteredClients) filteredClients.forEach(c => {
            if (grouped[c.status]) grouped[c.status].push(c);
            else if (statuses && statuses.length > 0) grouped[statuses[0].name].push(c);
        });

        // Sort each status group by createdAt
        Object.keys(grouped).forEach(key => {
            grouped[key].sort((a, b) => {
                const dateA = a.createdAt || 0;
                const dateB = b.createdAt || 0;
                return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
            });
        });

        return grouped;
    }, [filteredClients, statuses, sortDirection]);

    const sortedClientsForTable = useMemo(() => {
        if (!filteredClients || !statuses) return [];

        // Group by status first
        const grouped: { [key: string]: Client[] } = {};
        statuses.forEach(s => grouped[s.name] = []);
        const unknownStatus: Client[] = [];

        filteredClients.forEach(client => {
            if (grouped[client.status]) {
                grouped[client.status].push(client);
            } else {
                unknownStatus.push(client);
            }
        });

        // Sort each group by createdAt according to sortDirection
        const sortGroup = (arr: Client[]) => {
            return [...arr].sort((a, b) => {
                const dateA = a.createdAt || 0;
                const dateB = b.createdAt || 0;
                return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
            });
        };

        let result: Client[] = [];
        statuses.forEach(s => {
            if (grouped[s.name]) {
                result.push(...sortGroup(grouped[s.name]));
            }
        });

        result.push(...sortGroup(unknownStatus));

        return result;
    }, [filteredClients, statuses, sortDirection]);

    if (isLoading) {
        return <div className="h-screen bg-base-200 dark:bg-base-950 flex items-center justify-center"><LoadingSpinner /></div>;
    }

    const hasActiveFilters = !!filterStatus || !!filterLabelId || !!searchTerm.trim();

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            <Header
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onAddClientClick={() => openClientModal(null)}
                view={view}
                onViewChange={setView}
                clientView={clientView}
                onClientViewChange={setClientView}
                user={user}
                onExportClick={() => setExportModalOpen(true)}
                onImportClick={() => setImportModalOpen(true)}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterLabelId={filterLabelId}
                setFilterLabelId={setFilterLabelId}
                sortDirection={sortDirection}
                setSortDirection={setSortDirection}
                onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
                hasActiveFilters={hasActiveFilters}
                notificationProps={{
                    notifications: notifList,
                    unreadCount: notifUnreadCount,
                    settings: notifSettings,
                    onMarkAsRead: notifMarkAsRead,
                    onMarkAllAsRead: notifMarkAllAsRead,
                    onDismiss: notifDismiss,
                    onUpdateSettings: notifUpdateSettings,
                    onNotificationClick: handleNotificationClick,
                }}
            />
            <main className="flex-1 overflow-hidden p-3 sm:p-6 bg-base-200 dark:bg-base-950 transition-colors duration-300">
                {dbError ? (
                    <div className="flex items-center justify-center h-full text-center text-red-500">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">אופס, משהו השתבש</h2>
                            <p>{dbError}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {view === 'tasks' && <TasksPage onClientClick={openClientModal} isMobileSidebarOpen={isMobileSidebarOpen} onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)} />}
                        {view === 'meetings' && <MeetingsPage onClientClick={openClientModal} />}
                        {view === 'settings' && <div className="overflow-y-auto overflow-x-hidden h-full bg-white dark:bg-base-800 rounded-lg shadow"><ManageFieldsPage /></div>}
                        {view === 'profile' && <div className="overflow-y-auto h-full"><ProfilePage onProfileUpdate={onUserRefresh} /></div>}
                        {view === 'clients' && (
                            clientView === 'grid'
                                ? <ClientGrid clientsByStatus={clientsByStatus} onCardClick={openClientModal} />
                                : <div className="overflow-y-auto h-full"><ClientTable clients={sortedClientsForTable} onRowClick={openClientModal} /></div>
                        )}
                    </>
                )}
            </main>
            {view === 'clients' && (
                <button
                    onClick={() => openClientModal(null)}
                    className="sm:hidden fixed bottom-10 left-6 z-40 w-14 h-14 bg-primary text-white rounded-full shadow-glow flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl"
                    aria-label={entityLabels.addNew}
                >
                    <Plus className="w-8 h-8" />
                </button>
            )}
            <ClientFormModal isOpen={isClientModalOpen} onClose={() => setClientModalOpen(false)} clientToEdit={selectedClient} />
            <ClientExportModal isOpen={isExportModalOpen} onClose={() => setExportModalOpen(false)} />
            <ClientImportModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} />

            {/* Mobile Sidebar (Drawer) */}
            {isMobileSidebarOpen && view !== 'tasks' && (
                <div className="relative z-50 md:hidden animate-in fade-in duration-200" role="dialog" aria-modal="true">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-base-950/40 backdrop-blur-sm transition-opacity" 
                        onClick={() => setIsMobileSidebarOpen(false)}
                    />

                    {/* Drawer Panel */}
                    <div 
                        className="fixed inset-y-0 right-0 w-80 max-w-full bg-white dark:bg-base-900 shadow-2xl flex flex-col p-5 border-l border-gray-100 dark:border-white/5 animate-in slide-in-from-right duration-300"
                        dir="rtl"
                    >
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4 mb-4">
                            {/* Logo */}
                            <button
                                onClick={() => {
                                    setView('clients');
                                    setIsMobileSidebarOpen(false);
                                }}
                                className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left cursor-pointer"
                            >
                                {logoUrl
                                    ? <img src={logoUrl} alt="לוגו המערכת" className="h-9 w-auto max-w-[180px] object-contain" />
                                    : <DefaultLogo className="h-9 w-auto" />}
                            </button>

                            {/* Close Button */}
                            <button
                                onClick={() => setIsMobileSidebarOpen(false)}
                                className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                aria-label="סגור תפריט"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search & Filters */}
                        {view === 'clients' ? (
                            <div className="flex-1 overflow-y-auto space-y-6 pr-1 pl-1">
                                {/* View Toggle */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">תצוגה</span>
                                    <div className="flex p-1 bg-gray-100/50 dark:bg-base-950/50 rounded-xl w-full">
                                        <button 
                                            type="button"
                                            onClick={() => setClientView('grid')} 
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${clientView === 'grid' ? 'bg-white dark:bg-base-800 shadow text-primary font-medium' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                        >
                                            <LayoutGrid className="w-5 h-5" />
                                            <span className="text-xs">גריד</span>
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setClientView('table')} 
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${clientView === 'table' ? 'bg-white dark:bg-base-800 shadow text-primary font-medium' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                        >
                                            <List className="w-5 h-5" />
                                            <span className="text-xs">טבלה</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Search */}
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="mobile-search" className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">חיפוש לקוח</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                                            <Search className="w-5 h-5" />
                                        </div>
                                        <input
                                            id="mobile-search"
                                            type="search"
                                            placeholder="חיפוש..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className={`w-full pr-10 ${searchTerm ? 'pl-9' : 'pl-4'} py-2.5 bg-gray-100/50 dark:bg-base-950/50 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white placeholder-gray-400 transition-all shadow-inner`}
                                            disabled={!!dbError}
                                        />
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-red-500 cursor-pointer"
                                                title="איפוס חיפוש"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Sort Direction */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">סדר מיון (לפי תאריך יצירה)</span>
                                    <button
                                        onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                                        className="flex items-center justify-between w-full py-2.5 px-4 bg-gray-100/50 dark:bg-base-950/50 hover:bg-gray-200/50 dark:hover:bg-white/5 rounded-xl transition-colors text-right cursor-pointer"
                                    >
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {sortDirection === 'desc' ? 'מהחדש לישן' : 'מהישן לחדש'}
                                        </span>
                                        {sortDirection === 'desc' ? (
                                            <SortDesc className="w-5 h-5 text-primary" />
                                        ) : (
                                            <SortAsc className="w-5 h-5 text-primary" />
                                        )}
                                    </button>
                                </div>

                                {/* Status Filter */}
                                {clientView !== 'grid' && (
                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="mobile-status-filter" className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">סטטוס</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                                <Filter className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <select
                                                id="mobile-status-filter"
                                                value={filterStatus}
                                                onChange={(e) => setFilterStatus(e.target.value)}
                                                className={`block w-full pr-10 ${filterStatus ? 'pl-10' : 'pl-3'} py-2.5 text-sm rounded-xl border-transparent bg-gray-100/50 dark:bg-base-950/50 dark:text-gray-300 appearance-none focus:ring-0 focus:border-transparent cursor-pointer`}
                                            >
                                                <option value="">כל הסטטוסים</option>
                                                {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                            </select>
                                            {filterStatus && (
                                                <button
                                                    onClick={() => setFilterStatus('')}
                                                    className="absolute inset-y-0 left-3 flex items-center justify-center text-gray-400 hover:text-red-500 z-20 cursor-pointer"
                                                    title="איפוס סטטוס"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Label Filter */}
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="mobile-label-filter" className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">תגית</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                            <Tag className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <select
                                            id="mobile-label-filter"
                                            value={filterLabelId}
                                            onChange={(e) => setFilterLabelId(e.target.value)}
                                            className={`block w-full pr-10 ${filterLabelId ? 'pl-10' : 'pl-3'} py-2.5 text-sm rounded-xl border-transparent bg-gray-100/50 dark:bg-base-950/50 dark:text-gray-300 appearance-none focus:ring-0 focus:border-transparent cursor-pointer`}
                                        >
                                            <option value="">כל התגיות</option>
                                            {labels.filter(l => !l.module || l.module === 'client').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                        {filterLabelId && (
                                            <button
                                                onClick={() => setFilterLabelId('')}
                                                className="absolute inset-y-0 left-3 flex items-center justify-center text-gray-400 hover:text-red-500 z-20 cursor-pointer"
                                                title="איפוס תגית"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                                הסינונים והחיפוש זמינים רק במסך לקוחות.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        return onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
        });
    }, []);

    if (authLoading) return <div className="h-screen bg-base-200 dark:bg-base-900"><LoadingSpinner /></div>;

    // Public document page - accessible without login
    const path = window.location.pathname;
    if (path.startsWith('/doc/')) {
        const parts = path.replace('/doc/', '').split('/');
        if (parts.length >= 2) {
            const [docUserId, token] = parts;
            if (docUserId && token) return <PublicDocumentPage userId={docUserId} token={token} />;
        }
    }

    // Public checklist page - accessible without login
    if (path.startsWith('/task/')) {
        const parts = path.replace('/task/', '').split('/');
        if (parts.length >= 2) {
            const [taskUserId, token] = parts;
            if (taskUserId && token) return <PublicChecklistPage userId={taskUserId} token={token} />;
        }
    }

    if (!user) return <Login />;

    const refreshUser = async () => {
        if (auth.currentUser) {
            await auth.currentUser.reload();
            setUser({ ...auth.currentUser });
        }
    };

    const isSuperAdmin = SUPER_ADMIN_EMAIL && (user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;

    // Super admin: auto-impersonate the owner
    const impersonatedUserId = sessionStorage.getItem('impersonatedUserId');
    const impersonatedUserEmail = sessionStorage.getItem('impersonatedUserEmail') || '';

    if (isSuperAdmin && !impersonatedUserId) {
        return <SuperAdminGateway />;
    }

    const effectiveUserId = impersonatedUserId || user.uid;

    return (
        <>
            {isSuperAdmin && impersonatedUserId && (
                <SupportBar targetEmail={impersonatedUserEmail} />
            )}
            <div className={isSuperAdmin && impersonatedUserId ? 'pt-10' : ''}>
                <AppProvider userId={effectiveUserId}>
                    <AppContent user={user} onUserRefresh={refreshUser} />
                </AppProvider>
            </div>
        </>
    );
};

export default App;
