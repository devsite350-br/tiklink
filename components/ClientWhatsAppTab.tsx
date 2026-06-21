import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Client, WhatsAppMessage } from '../types';
import { useAppContext } from '../context/AppContext';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Check, CheckCheck, MessageSquare, Copy, ClipboardCheck, Calendar, ArrowRight, ArrowLeft } from 'lucide-react';

interface Props {
    client: Client | null;
    onCopyToTask?: (text: string) => void;
    onCopyToMeeting?: (text: string) => void;
}

const formatTime = (ts: number) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
};

const formatDateLabel = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'היום';
    if (sameDay(d, yesterday)) return 'אתמול';
    return d.toLocaleDateString('he-IL');
};

const StatusIcon: React.FC<{ status?: string }> = ({ status }) => {
    if (status === 'read') {
        return <CheckCheck className="w-4 h-4 text-blue-400" />;
    }
    if (status === 'delivered') {
        return <CheckCheck className="w-4 h-4 text-gray-400" />;
    }
    if (status === 'sent') {
        return <Check className="w-4 h-4 text-gray-400" />;
    }
    return null;
};

export const ClientWhatsAppTab: React.FC<Props> = ({ client, onCopyToTask, onCopyToMeeting }) => {
    const { effectiveUserId, entityLabels } = useAppContext();
    const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleCopy = async (id: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(curr => (curr === id ? null : curr)), 1500);
        } catch (err) {
            console.error('Failed to copy text', err);
        }
    };

    useEffect(() => {
        if (!client || !effectiveUserId) {
            setMessages([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const ref = collection(db, 'users', effectiveUserId, 'clients', client.id, 'whatsappMessages');
        const q = query(ref, orderBy('timestamp', 'asc'));
        const unsub = onSnapshot(q, snap => {
            const msgs: WhatsAppMessage[] = snap.docs.map(d => ({
                id: d.id,
                ...(d.data() as Omit<WhatsAppMessage, 'id'>),
            }));
            setMessages(msgs);
            setLoading(false);
        }, err => {
            console.error('whatsapp messages snapshot error', err);
            setLoading(false);
        });
        return () => unsub();
    }, [client?.id, effectiveUserId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    // Group consecutive messages by date for separators
    const grouped = useMemo(() => {
        const groups: { dateLabel: string; items: WhatsAppMessage[] }[] = [];
        let lastLabel = '';
        for (const m of messages) {
            const label = formatDateLabel(m.timestamp);
            if (label !== lastLabel) {
                groups.push({ dateLabel: label, items: [m] });
                lastLabel = label;
            } else {
                groups[groups.length - 1].items.push(m);
            }
        }
        return groups;
    }, [messages]);

    if (!client) {
        return <div className="p-4 text-center text-gray-500">{`יש לשמור את ${entityLabels.theSingular} לפני צפייה בהודעות.`}</div>;
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12 text-gray-400 text-sm">
                טוען הודעות...
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="text-center py-12 px-6">
                <div className="text-5xl mb-3"><MessageSquare className="w-12 h-12 mx-auto text-gray-400" /></div>
                <p className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">אין הודעות וואטסאפ</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    {`כל הודעה שתישלח או תתקבל מטלפון ${entityLabels.theSingular} תופיע כאן אוטומטית. ודא שהאנדפוינט מוגדר ב-Green API ושהטלפון של ${entityLabels.theSingular} רשום נכון בכרטיס.`}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-220px)]">
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar p-4 rounded-xl"
                style={{
                    background: 'linear-gradient(180deg, #efeae2 0%, #e6dfd6 100%)',
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)',
                    backgroundSize: '20px 20px',
                }}
            >
                <div className="dark:hidden" />
                {grouped.map((group, gi) => (
                    <div key={gi}>
                        <div className="flex justify-center my-3">
                            <span className="text-[11px] px-3 py-1 rounded-full bg-white/80 text-gray-600 shadow-sm font-medium">
                                {group.dateLabel}
                            </span>
                        </div>
                        {group.items.map(msg => {
                            const isOut = msg.direction === 'outbound';
                            const content = msg.type === 'text' ? (msg.text || '') : (msg.placeholder || '[הודעה]');
                            const isPlaceholder = msg.type !== 'text';
                            const plainText = msg.type === 'text' ? (msg.text || '') : '';
                            const canAct = !isPlaceholder && !!plainText.trim();
                            return (
                                <div key={msg.id} className={`flex mb-2 ${isOut ? 'justify-start' : 'justify-end'}`}>
                                    <div
                                        className={`group relative max-w-[75%] px-3 py-2 rounded-lg shadow-sm ${isOut
                                            ? 'bg-[#d9fdd3] text-gray-900'
                                            : 'bg-white text-gray-900'
                                            }`}
                                        style={{
                                            borderRadius: isOut ? '12px 12px 12px 4px' : '12px 12px 4px 12px',
                                        }}
                                    >
                                        {canAct && (
                                            <div
                                                className={`absolute -top-3 ${isOut ? 'left-2' : 'right-2'} flex items-center gap-0.5 bg-white dark:bg-base-800 border border-gray-200 dark:border-white/10 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10`}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(msg.id, plainText)}
                                                    title={copiedId === msg.id ? 'הועתק!' : 'העתק'}
                                                    className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-50 dark:hover:bg-white/10 rounded-full transition-colors"
                                                >
                                                    {copiedId === msg.id ? (
                                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                                {onCopyToTask && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onCopyToTask(plainText)}
                                                        title="העתק למשימה"
                                                        className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-50 dark:hover:bg-white/10 rounded-full transition-colors"
                                                    >
                                                        <ClipboardCheck className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {onCopyToMeeting && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onCopyToMeeting(plainText)}
                                                        title="העתק לפגישה"
                                                        className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-50 dark:hover:bg-white/10 rounded-full transition-colors"
                                                    >
                                                        <Calendar className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <div className={`flex items-center gap-1 mb-1 text-[10px] font-bold uppercase tracking-wide ${isOut ? 'text-emerald-700' : 'text-blue-700'}`}>
                                            {isOut ? (
                                                <>
                                                    <ArrowRight className="w-3 h-3" />
                                                    יוצאת
                                                </>
                                            ) : (
                                                <>
                                                    <ArrowLeft className="w-3 h-3" />
                                                    נכנסת
                                                </>
                                            )}
                                        </div>
                                        <div
                                            className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${isPlaceholder ? 'italic text-gray-500' : ''}`}
                                        >
                                            {content || <span className="italic text-gray-400">(ריק)</span>}
                                        </div>
                                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-500">
                                            <span>{formatTime(msg.timestamp)}</span>
                                            {isOut && <StatusIcon status={msg.status} />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};
