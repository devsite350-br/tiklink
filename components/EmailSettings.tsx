import React, { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { EmailSettings as EmailSettingsType } from '../types';
import { db } from '../firebaseConfig';
import { api } from '../utils/apiClient';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';

const inputClass =
  'w-full px-3 py-2 border rounded-md bg-white dark:bg-base-900/50 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 focus:ring-primary focus:border-primary outline-none';

type ConnectionType = 'resend' | 'gmail' | 'smtp';

interface GmailConnection {
  email: string;
  refreshToken: string;
  connectedAt: any;
}

export const EmailSettings: React.FC = () => {
  const { emailSettings, updateEmailSettings, effectiveUserId } = useAppContext();
  const hasSmtp = !!(emailSettings?.smtpHost && emailSettings?.smtpUser && emailSettings?.smtpPass);
  const hasResend = !!(emailSettings?.resendApiKey && emailSettings?.resendFromEmail);

  const [gmailConnection, setGmailConnection] = useState<GmailConnection | null>(null);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState('');
  const [showResendKey, setShowResendKey] = useState(false);
  const [resendSaving, setResendSaving] = useState(false);
  const [resendSavedAt, setResendSavedAt] = useState<number | null>(null);

  const [selectedType, setSelectedType] = useState<ConnectionType>('resend');

  // Listen to Gmail connection
  useEffect(() => {
    if (!effectiveUserId) return;
    const unsub = onSnapshot(doc(db, 'users', effectiveUserId, 'settings', 'gmailConnection'), snap => {
      setGmailConnection(snap.exists() ? (snap.data() as GmailConnection) : null);
    });
    return () => unsub();
  }, [effectiveUserId]);

  // Set initial selected type based on existing configuration
  useEffect(() => {
    if (gmailConnection) {
      setSelectedType('gmail');
    } else if (hasSmtp) {
      setSelectedType('smtp');
    } else {
      setSelectedType('resend');
    }
  }, [gmailConnection, hasSmtp]);

  // Handle Gmail OAuth callback
  useEffect(() => {
    const handleGmailCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const stateRaw = urlParams.get('state');
      if (!code || !stateRaw) return;

      let state: any;
      try { state = JSON.parse(stateRaw); } catch { return; }
      if (state?.flow !== 'gmail') return;

      setIsConnectingGmail(true);
      try {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        await api('gmail', { action: 'callback', code, redirectUri: cleanUrl });
      } catch (err: any) {
        console.error('Gmail Auth Callback Error:', err);
        setGmailError(err.message || 'שגיאה בחיבור Gmail');
      } finally {
        setIsConnectingGmail(false);
      }
    };
    handleGmailCallback();
  }, []);

  const handleConnectGmail = async () => {
    setIsConnectingGmail(true);
    setGmailError(null);
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      const data = await api<{ url: string }>('gmail', { action: 'auth-url', redirectUri: cleanUrl });
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Error getting Gmail auth url:', err);
      setGmailError(err.message || 'שגיאה בקבלת כתובת ההתחברות');
      setIsConnectingGmail(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!effectiveUserId) return;
    try {
      await deleteDoc(doc(db, 'users', effectiveUserId, 'settings', 'gmailConnection'));
    } catch (err: any) {
      console.error('Error disconnecting Gmail:', err);
    }
  };

  useEffect(() => {
    setSmtpHost(emailSettings?.smtpHost || '');
    setSmtpPort(String(emailSettings?.smtpPort || 587));
    setSmtpUser(emailSettings?.smtpUser || '');
    setSmtpPass(emailSettings?.smtpPass || '');
    setSmtpSecure(emailSettings?.smtpSecure ?? false);
    setResendApiKey(emailSettings?.resendApiKey || '');
    setResendFromEmail(emailSettings?.resendFromEmail || '');
  }, [emailSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: EmailSettingsType = {
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort) || 587,
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim(),
        smtpSecure,
        resendApiKey: emailSettings?.resendApiKey || '',
        resendFromEmail: emailSettings?.resendFromEmail || '',
      };
      await updateEmailSettings(data);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleResendSave = async () => {
    setResendSaving(true);
    try {
      const data: EmailSettingsType = {
        smtpHost: emailSettings?.smtpHost || '',
        smtpPort: emailSettings?.smtpPort || 587,
        smtpUser: emailSettings?.smtpUser || '',
        smtpPass: emailSettings?.smtpPass || '',
        smtpSecure: emailSettings?.smtpSecure ?? false,
        resendApiKey: resendApiKey.trim(),
        resendFromEmail: resendFromEmail.trim(),
      };
      await updateEmailSettings(data);
      setResendSavedAt(Date.now());
      setTimeout(() => setResendSavedAt(null), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setResendSaving(false);
    }
  };

  const handleTest = async () => {
    if (!smtpHost.trim() || !smtpUser.trim() || !smtpPass.trim()) {
      setTestState('error');
      setTestMessage('יש למלא ולשמור את כל פרטי החיבור לפני בדיקה.');
      return;
    }
    setTestState('testing');
    setTestMessage('');
    try {
      const port = Number(smtpPort);
      if (!port || port < 1 || port > 65535) {
        setTestState('error');
        setTestMessage('פורט לא תקין');
        return;
      }
      setTestState('ok');
      setTestMessage('ההגדרות נשמרו. שלח מייל דרך אוטומציה כדי לבדוק שהחיבור עובד.');
    } catch (e: any) {
      setTestState('error');
      setTestMessage(e?.message || 'שגיאה בלתי ידועה');
    }
  };

  return (
    <div className="space-y-4">
      {/* Connection Type Selector - Horizontal Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {/* Resend */}
        <button
          type="button"
          onClick={() => setSelectedType('resend')}
          className={`relative rounded-xl border-2 p-3 transition-all text-center ${
            selectedType === 'resend'
              ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-base-800 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black ${
              selectedType === 'resend'
                ? 'bg-primary/10 text-primary'
                : 'bg-gray-100 dark:bg-base-900/50 text-gray-600 dark:text-gray-300'
            }`}>
              Re
            </div>
            <span className={`text-xs font-bold leading-tight ${
              selectedType === 'resend' ? 'text-primary' : 'text-gray-700 dark:text-gray-300'
            }`}>Resend</span>
            {hasResend && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">מחובר</span>}
          </div>
        </button>

        {/* Gmail */}
        <button
          type="button"
          onClick={() => setSelectedType('gmail')}
          className={`relative rounded-xl border-2 p-3 transition-all text-center ${
            selectedType === 'gmail'
              ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-base-800 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              selectedType === 'gmail' ? 'bg-primary/10' : 'bg-gray-100 dark:bg-base-900/50'
            }`}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
            </div>
            <span className={`text-xs font-bold leading-tight ${
              selectedType === 'gmail' ? 'text-primary' : 'text-gray-700 dark:text-gray-300'
            }`}>Gmail</span>
            {gmailConnection && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">מחובר</span>}
          </div>
        </button>

        {/* SMTP */}
        <button
          type="button"
          onClick={() => setSelectedType('smtp')}
          className={`relative rounded-xl border-2 p-3 transition-all text-center ${
            selectedType === 'smtp'
              ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-base-800 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              selectedType === 'smtp' ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-base-900/50 text-gray-500 dark:text-gray-400'
            }`}>
              <Mail width={20} height={20} />
            </div>
            <span className={`text-xs font-bold leading-tight ${
              selectedType === 'smtp' ? 'text-primary' : 'text-gray-700 dark:text-gray-300'
            }`}>SMTP</span>
            {hasSmtp && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">מוגדר</span>}
          </div>
        </button>
      </div>

      {/* Resend Settings */}
      {selectedType === 'resend' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-base-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3"
               style={{ background: 'linear-gradient(135deg, rgba(47,143,116,0.08), rgba(47,143,116,0.01))' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black text-white"
                 style={{ background: 'linear-gradient(135deg, #3bb491, #234a63)' }}>
              Re
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">חיבור Resend</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">שלח מיילים מהדומיין שלך באמצעות Resend.</p>
            </div>
          </div>

          <div className="px-5 pt-4 pb-2">
            <div className="rounded-lg border border-teal-100 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4 space-y-2 text-xs text-teal-800 dark:text-teal-300">
              <p className="font-bold text-sm text-teal-900 dark:text-teal-200">איך להתחיל עם Resend?</p>
              <ol className="space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>היכנס לאתר <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-teal-600">resend.com</a> וצור חשבון חינמי.</li>
                <li>עבור ל-<b>Domains</b> וחבר את הדומיין שלך (נדרשת הוספת רשומות DNS אצל ספק הדומיין שלך).</li>
                <li>לאחר אימות הדומיין, עבור ל-<a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-teal-600">resend.com/api-keys</a> וצור API Key חדש.</li>
                <li>הזן את ה-API Key ואת כתובת השולח (חייבת להיות מהדומיין שחיברת) למטה.</li>
              </ol>
            </div>
          </div>

          <div className="p-5 pt-3 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">כתובת מייל שולח *</label>
              <input
                type="email"
                value={resendFromEmail}
                onChange={e => setResendFromEmail(e.target.value)}
                placeholder="noreply@yourdomain.com"
                className={inputClass}
                dir="ltr"
              />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">חייבת להיות מהדומיין שחיברת ב-Resend.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Resend API Key *</label>
              <div className="relative">
                <input
                  type={showResendKey ? 'text' : 'password'}
                  value={resendApiKey}
                  onChange={e => setResendApiKey(e.target.value)}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                  className={inputClass + ' pl-10'}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowResendKey(s => !s)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                  title={showResendKey ? 'הסתר' : 'הצג'}
                >
                  {showResendKey ? '\u{1F648}' : '\u{1F441}'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                את ה-API Key תמצא ב-<a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline text-teal-500 hover:text-teal-700">resend.com/api-keys</a>
              </p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleResendSave}
                disabled={resendSaving || !resendApiKey.trim() || !resendFromEmail.trim()}
                className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-opacity-90 disabled:opacity-50"
              >
                {resendSaving ? 'שומר...' : 'שמור הגדרות'}
              </button>
              {resendSavedAt && <span className="text-xs text-emerald-600 dark:text-emerald-400">&#x2713; נשמר</span>}
            </div>
          </div>
        </div>
      )}

      {/* Gmail Connection */}
      {selectedType === 'gmail' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-base-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3"
               style={{ background: 'linear-gradient(135deg, rgba(234,67,53,0.06), rgba(66,133,244,0.06))' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                 style={{ background: 'linear-gradient(135deg, #EA4335, #4285F4)', color: 'white' }}>
              <Mail width={18} height={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">חיבור Gmail</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">חבר חשבון Gmail בלחיצת כפתור. מיילים יישלחו ישירות מהחשבון שלך.</p>
            </div>
          </div>
          <div className="p-5">
            {gmailConnection ? (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-lg font-bold">
                    {gmailConnection.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100" dir="ltr">{gmailConnection.email}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">מחובר</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectGmail}
                  className="px-4 py-2 rounded-md border border-red-300 dark:border-red-600 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  נתק Gmail
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={handleConnectGmail}
                  disabled={isConnectingGmail}
                  className="flex items-center gap-3 px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-base-900/50 hover:bg-gray-50 dark:hover:bg-base-900 transition-colors shadow-sm disabled:opacity-50"
                >
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {isConnectingGmail ? 'מתחבר...' : 'התחבר עם Google'}
                  </span>
                </button>
                {gmailError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{gmailError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SMTP Settings */}
      {selectedType === 'smtp' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-base-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3"
               style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(59,130,246,0.01))' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-lg"
                 style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}>
              <Mail width={18} height={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">חיבור שרת SMTP</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">חבר SMTP כמו SendGrid או Brevo.</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">SMTP Host *</label>
                <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className={inputClass} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">SMTP Port *</label>
                <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" className={inputClass} dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">שם משתמש (User) *</label>
                <input type="text" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="you@gmail.com" className={inputClass} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">סיסמה / App Password *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="סיסמת SMTP או App Password" className={inputClass + ' pl-10'} dir="ltr" />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs" title={showPass ? 'הסתר' : 'הצג'}>
                    {showPass ? '\u{1F648}' : '\u{1F441}'}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={smtpSecure} onChange={e => setSmtpSecure(e.target.checked)} className="rounded border-gray-300" />
                SSL/TLS (פורט 465). השאר ללא סימון עבור STARTTLS (פורט 587).
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="button" onClick={handleSave} disabled={saving || !smtpHost.trim() || !smtpUser.trim() || !smtpPass.trim()} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-opacity-90 disabled:opacity-50">
                {saving ? 'שומר...' : 'שמור הגדרות'}
              </button>
              <button type="button" onClick={handleTest} disabled={testState === 'testing'} className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-base-900/50 disabled:opacity-50">
                {testState === 'testing' ? 'בודק...' : 'בדוק הגדרות'}
              </button>
              {savedAt && <span className="text-xs text-emerald-600 dark:text-emerald-400">&#x2713; נשמר</span>}
              {testState === 'ok' && <span className="text-xs text-emerald-600 dark:text-emerald-400">{testMessage}</span>}
              {testState === 'error' && <span className="text-xs text-red-600 dark:text-red-400">{testMessage}</span>}
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-base-900/30 text-xs text-gray-600 dark:text-gray-400 leading-relaxed space-y-1">
            <p><b>SendGrid:</b> Host: smtp.sendgrid.net, Port: 587, User: apikey, Pass: המפתח שלך.</p>
            <p><b>Brevo (חינמי):</b> Host: smtp-relay.brevo.com, Port: 587. עד 300 מיילים ביום בחינם.</p>
          </div>
        </div>
      )}
    </div>
  );
};
