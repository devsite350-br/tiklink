
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { LogOut, RefreshCw, Search, ArrowLeft } from 'lucide-react';

const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  createdAt?: number;
  organizationId?: string;
}

export const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const currentUser = auth.currentUser;
  const isSuperAdmin = SUPER_ADMIN_EMAIL && (currentUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;

  useEffect(() => {
    if (!isSuperAdmin) {
      window.location.pathname = '/';
      return;
    }
    loadUsers();
  }, [isSuperAdmin]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const result: UserRecord[] = snap.docs
        .map(d => ({ uid: d.id, ...(d.data() as Omit<UserRecord, 'uid'>) }))
        .filter(u => (u.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL);
      result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUsers(result);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const loginAs = (uid: string, email: string) => {
    sessionStorage.setItem('impersonatedUserId', uid);
    sessionStorage.setItem('impersonatedUserEmail', email);
    window.location.replace('/');
  };

  if (!isSuperAdmin) return null;

  // Show only primary accounts (owners). Members share the owner's CRM.
  const owners = users.filter(u => !u.organizationId);
  const memberCountByOwner: Record<string, number> = {};
  users.filter(u => u.organizationId).forEach(u => {
    memberCountByOwner[u.organizationId!] = (memberCountByOwner[u.organizationId!] || 0) + 1;
  });

  const filtered = search
    ? owners.filter(u =>
        (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.displayName || '').toLowerCase().includes(search.toLowerCase())
      )
    : owners;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ניהול חשבונות</h1>
            <p className="text-sm text-gray-400 mt-0.5">מחובר כ: {currentUser?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadUsers}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              רענון
            </button>
            <button
              onClick={() => signOut(auth)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              יציאה
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="חיפוש לפי אימייל או שם..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">אימייל</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">שם</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">תאריך יצירה</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">חברי צוות</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400">אין חשבונות</td>
                  </tr>
                ) : filtered.map(u => (
                  <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-900 font-medium">{u.email}</td>
                    <td className="px-6 py-4 text-gray-600">{u.displayName || '-'}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('he-IL') : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {memberCountByOwner[u.uid] ? `+${memberCountByOwner[u.uid]}` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => loginAs(u.uid, u.email)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        כניסה
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
