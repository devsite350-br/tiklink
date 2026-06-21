import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { webhookUrl } from '../utils/apiClient';
import { WhatsAppSettings as WhatsAppSettingsType } from '../types';
import { MessageSquare, EyeOff, Eye, CheckCircle2, XCircle, CheckCircle } from 'lucide-react';

const inputClass =
  'w-full px-3 py-2 border rounded-md bg-white dark:bg-base-900/50 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 focus:ring-primary focus:border-primary outline-none';

export const WhatsAppSettings: React.FC = () => {
  const { whatsappSettings, updateWhatsAppSettings, userId, entityLabels } = useAppContext();

  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIdInstance(whatsappSettings?.idInstance || '');
    setApiTokenInstance(whatsappSettings?.apiTokenInstance || '');
    setSenderPhone(whatsappSettings?.senderPhone || '');
  }, [whatsappSettings?.idInstance, whatsappSettings?.apiTokenInstance, whatsappSettings?.senderPhone]);

  const endpointUrl = webhookUrl('whatsapp/inbound', { userId });

  const handleCopy = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: WhatsAppSettingsType = {
        idInstance: idInstance.trim(),
        apiTokenInstance: apiTokenInstance.trim(),
        senderPhone: senderPhone.trim() || undefined,
      };
      await updateWhatsAppSettings(data);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!idInstance.trim() || !apiTokenInstance.trim()) {
      setTestState('error');
      setTestMessage('יש למלא ולשמור את פרטי החיבור לפני בדיקה.');
      return;
    }
    setTestState('testing');
    setTestMessage('');
    try {
      const url = `https://api.green-api.com/waInstance${idInstance.trim()}/getStateInstance/${apiTokenInstance.trim()}`;
      const res = await fetch(url);
      if (!res.ok) {
        setTestState('error');
        setTestMessage(`שגיאה: ${res.status} ${res.statusText}`);
        return;
      }
      const json = await res.json();
      const state = json?.stateInstance || 'unknown';
      if (state === 'authorized') {
        setTestState('ok');
        setTestMessage('החיבור תקין (authorized)');
      } else {
        setTestState('error');
        setTestMessage(`האינסטנס במצב: ${state}`);
      }
    } catch (e: any) {
      setTestState('error');
      setTestMessage(e?.message || 'שגיאה בלתי ידועה');
    }
  };

  return (
    <div className="space-y-5">
      {/* Endpoint block */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-base-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3"
             style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.06), rgba(37,211,102,0.01))' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-lg"
               style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Endpoint לקליטת הודעות וואטסאפ</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">העתק את הכתובת והדבק אותה בשדה "כתובת וובהוק" ב-Green API.</p>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-base-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 pl-3" dir="ltr">
            <div className="flex-1 text-xs font-mono text-gray-700 dark:text-gray-300 break-all select-all">{endpointUrl}</div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium text-white transition-colors"
              style={{ background: copied ? '#14BC88' : '#25D366' }}
            >
              {copied ? 'הועתק' : 'העתק'}
            </button>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-base-900/30 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          ב-Green API: <b>API → קבלת הודעות</b>, הדבק את הכתובת בשדה "כתובת וובהוק", והפעל את "קבל התראות וובהוק בעת קבלת הודעות נכנסות (כולל קבצים)" וגם "קבל וובהוק על הודעות שנשלחו ממכשיר הפלאפון". {`הודעות לטלפונים שמופיעים בכרטיסי ${entityLabels.plural} יתועדו אוטומטית בטאב "וואטסאפ" של אותם ${entityLabels.plural}.`}
        </div>
      </div>

      {/* Connection settings block */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-base-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">חיבור Green API לשליחת הודעות</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">פרטי האינסטנס מ-Green API. נדרש כדי לשלוח הודעות יוצאות (למשל באמצעות אוטומציה).</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">idInstance *</label>
              <input
                type="text"
                value={idInstance}
                onChange={e => setIdInstance(e.target.value)}
                placeholder="לדוגמא: 1101000001"
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">apiTokenInstance *</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={apiTokenInstance}
                  onChange={e => setApiTokenInstance(e.target.value)}
                  placeholder="הטוקן מ-Green API"
                  className={inputClass + ' pl-10'}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(s => !s)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                  title={showToken ? 'הסתר' : 'הצג'}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">טלפון השולח (אופציונלי)</label>
              <input
                type="text"
                value={senderPhone}
                onChange={e => setSenderPhone(e.target.value)}
                placeholder="להצגה בלוג בלבד"
                className={inputClass}
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !idInstance.trim() || !apiTokenInstance.trim()}
              className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-opacity-90 disabled:opacity-50"
            >
              {saving ? 'שומר…' : 'שמור הגדרות'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testState === 'testing'}
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-base-900/50 disabled:opacity-50"
            >
              {testState === 'testing' ? 'בודק…' : 'בדוק חיבור'}
            </button>
            {savedAt && <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> נשמר</span>}
            {testState === 'ok' && <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {testMessage}</span>}
            {testState === 'error' && <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {testMessage}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
