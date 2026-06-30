
import React, { useState, useRef, useMemo } from 'react';
import { Client, Comment, ActivityEvent, Task, Meeting, CrmDocument } from '../types';
import LinkifiedContent from './LinkifiedContent';
import { auth, db } from '../firebaseConfig';
import { uploadFile } from '../utils/apiClient';
import { doc, getDoc } from 'firebase/firestore';
import { UserAvatar } from './UserAvatar';
import { useAppContext } from '../context/AppContext';
import { useConfirm } from './ConfirmDialog';
import { MessageSquare, ArrowUpDown, ClipboardCheck, Calendar, FileText, User, ArrowLeft, ArrowRight, Pencil, Trash2, MoveRight, X, Paperclip, Send, Clock } from 'lucide-react';

interface CommentsProps {
  client: Partial<Client>;
  setClient: (client: Partial<Client>) => void;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

const IconComment = () => <MessageSquare className="w-3.5 h-3.5" />;
const IconStatus = () => <ArrowUpDown className="w-3.5 h-3.5" />;
const IconTask = () => <ClipboardCheck className="w-3.5 h-3.5" />;
const IconMeeting = () => <Calendar className="w-3.5 h-3.5" />;
const IconDocument = () => <FileText className="w-3.5 h-3.5" />;
const IconWhatsAppIn = () => <ArrowLeft className="w-3.5 h-3.5" />;
const IconWhatsAppOut = () => <ArrowRight className="w-3.5 h-3.5" />;

// ─── Timeline Item Types ──────────────────────────────────────────────────────

type TLKind = 'comment' | 'status_change' | 'task_created' | 'meeting' | 'document' | 'user_assigned' | 'whatsapp_inbound' | 'whatsapp_outbound';

interface TLItem {
  id: string;
  kind: TLKind;
  timestamp: number;
  authorName?: string;
  authorPhotoUrl?: string;
  title: string;
  description?: string;
  fromStatus?: string;
  toStatus?: string;
  commentData?: Comment;
}

// ─── colour / icon mapping ────────────────────────────────────────────────────

const IconUser = () => <User className="w-3.5 h-3.5" />;

const KIND_META: Record<TLKind, { icon: React.ReactNode; dot: string; badge: string }> = {
  comment:           { icon: <IconComment />,     dot: 'bg-blue-500',     badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  status_change:     { icon: <IconStatus />,      dot: 'bg-amber-500',    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  task_created:      { icon: <IconTask />,        dot: 'bg-green-500',    badge: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  meeting:           { icon: <IconMeeting />,     dot: 'bg-sky-500',   badge: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  document:          { icon: <IconDocument />,    dot: 'bg-rose-500',     badge: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  user_assigned:     { icon: <IconUser />,        dot: 'bg-cyan-500',     badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  whatsapp_inbound:  { icon: <IconWhatsAppIn />,  dot: 'bg-emerald-500',  badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  whatsapp_outbound: { icon: <IconWhatsAppOut />, dot: 'bg-emerald-600',  badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
};

const KIND_LABEL: Record<TLKind, string> = {
  comment:           'הערה',
  status_change:     'שינוי סטטוס',
  task_created:      'משימה',
  meeting:           'פגישה',
  document:          'מסמך',
  user_assigned:     'שיוך משתמש',
  whatsapp_inbound:  'וואטסאפ נכנסת',
  whatsapp_outbound: 'וואטסאפ יוצאת',
};

// ─── CommentContent (expandable) ─────────────────────────────────────────────

const CommentContent: React.FC<{ comment: Comment }> = ({ comment }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const checkHeight = () => {
      if (contentRef.current) setNeedsExpand(contentRef.current.scrollHeight > 280);
    };
    setTimeout(checkHeight, 50);
    const img = contentRef.current?.querySelector('img');
    if (img) {
      img.addEventListener('load', checkHeight);
      return () => img.removeEventListener('load', checkHeight);
    }
  }, [comment.text, comment.imageUrl]);

  return (
    <div className="w-full flex flex-col">
      <div className="relative w-full">
        <div ref={contentRef} className={`space-y-2 overflow-hidden transition-all duration-300 ${!isExpanded ? 'max-h-[280px]' : ''}`}>
          {comment.text && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300">
              <LinkifiedContent content={comment.text} />
            </p>
          )}
          {comment.imageUrl && (
            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 max-w-sm bg-black/5">
              <img
                src={comment.imageUrl}
                alt="Comment attachment"
                className="w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                onClick={() => window.open(comment.imageUrl, '_blank')}
              />
            </div>
          )}
        </div>
        {needsExpand && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-[#2e3134] to-transparent pointer-events-none" />
        )}
      </div>
      {needsExpand && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-1.5 py-0.5 px-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors self-start border border-blue-200 dark:border-blue-800/30"
        >
          {isExpanded ? 'הסתר' : 'קרא עוד'}
        </button>
      )}
    </div>
  );
};

// ─── Single Timeline Row ──────────────────────────────────────────────────────

const TimelineRow: React.FC<{
  item: TLItem;
  isLast: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  editingComment?: Comment | null;
  onEditChange?: (c: Comment) => void;
  onEditSave?: () => void;
  onEditCancel?: () => void;
}> = ({ item, isLast, onEdit, onDelete, editingComment, onEditChange, onEditSave, onEditCancel }) => {
  const meta = KIND_META[item.kind];

  return (
    <div className="flex gap-3 group">
      {/* Left column: dot + line */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 28 }}>
        <div className={`w-7 h-7 rounded-full ${meta.dot} flex items-center justify-center text-white shadow-sm flex-shrink-0 z-10`}>
          {meta.icon}
        </div>
        {!isLast && <div className="flex-1 w-px bg-gray-200 dark:bg-white/10 mt-1" />}
      </div>

      {/* Right column: content */}
      <div className="flex-1 pb-5 min-w-0">
        {/* Header row: badge · title · author · time · edit/delete */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${meta.badge}`}>
            {KIND_LABEL[item.kind]}
          </span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug min-w-0">{item.title}</span>
          <span className="text-gray-300 dark:text-gray-600 text-[10px] flex-shrink-0">·</span>
          {item.authorName && (
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">{item.authorName}</span>
          )}
          <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
            {new Date(item.timestamp).toLocaleString('he-IL')}
          </span>
          {item.kind === 'comment' && onEdit && onDelete && (
            <div className="hidden group-hover:flex items-center gap-1 mr-1">
              <button type="button" onClick={onEdit} className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5">
                <Pencil className="h-3 w-3" />
                ערוך
              </button>
              <button type="button" onClick={onDelete} className="text-[11px] text-red-500 hover:underline flex items-center gap-0.5">
                <Trash2 className="h-3 w-3" />
                מחק
              </button>
            </div>
          )}
        </div>

        {/* Sub-info: status from→to */}
        {item.kind === 'status_change' && item.fromStatus && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 font-medium">{item.fromStatus}</span>
            <MoveRight className="w-3 h-3 flex-shrink-0" />
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 font-medium">{item.toStatus}</span>
          </div>
        )}

        {/* Comment body (editable) */}
        {item.kind === 'comment' && item.commentData && (
          editingComment && editingComment.id === item.commentData.id ? (
            <>
              <textarea
                value={editingComment.text}
                onChange={e => onEditChange?.({ ...editingComment, text: e.target.value })}
                className="w-full p-2 bg-white dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-1.5">
                <button type="button" onClick={onEditCancel} className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">בטל</button>
                <button type="button" onClick={onEditSave} className="px-3 py-1 text-xs rounded-lg bg-blue-500 text-white">שמור</button>
              </div>
            </>
          ) : (
            <CommentContent comment={item.commentData} />
          )
        )}

        {/* Optional description for non-comment events */}
        {item.kind !== 'comment' && item.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.description}</p>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Comments: React.FC<CommentsProps> = ({ client, setClient }) => {
  const { meetings, documents, canUploadFile, incrementFileCount, plan, effectiveUserId } = useAppContext();
  const confirm = useConfirm();

  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Build combined timeline ──────────────────────────────────────────────

  const timelineItems = useMemo<TLItem[]>(() => {
    const items: TLItem[] = [];

    // 1. Comments
    for (const c of client.comments || []) {
      items.push({
        id: `comment-${c.id}`,
        kind: 'comment',
        timestamp: c.timestamp,
        authorName: c.authorName,
        authorPhotoUrl: c.authorPhotoUrl,
        title: c.text ? (c.text.length > 60 ? c.text.slice(0, 60) + '…' : c.text) : (c.imageUrl ? 'תמונה צורפה' : 'הערה'),
        commentData: c,
      });
    }

    // 2. Explicit activity log (status changes, etc.)
    for (const ev of client.activityLog || []) {
      const kindMap: Record<string, TLKind> = {
        status_change:     'status_change',
        task_created:      'task_created',
        task_completed:    'task_created',
        user_assigned:     'user_assigned',
        whatsapp_inbound:  'whatsapp_inbound',
        whatsapp_outbound: 'whatsapp_outbound',
      };
      items.push({
        id: `activity-${ev.id}`,
        kind: kindMap[ev.type] ?? 'status_change',
        timestamp: ev.timestamp,
        authorName: ev.authorName,
        authorPhotoUrl: ev.authorPhotoUrl,
        title: ev.title,
        description: ev.description,
        fromStatus: ev.fromStatus,
        toStatus: ev.toStatus,
      });
    }

    // 3. Tasks created (derived from task.createdAt)
    for (const t of client.tasks || []) {
      if (t.createdAt) {
        items.push({
          id: `task-${t.id}`,
          kind: 'task_created',
          timestamp: t.createdAt,
          authorName: t.authorName,
          authorPhotoUrl: t.authorPhotoUrl,
          title: `משימה נוצרה: "${t.text}"`,
          description: t.isCompleted ? 'הושלמה' : undefined,
        });
      }
    }

    // 4. Meetings
    if (client.id) {
      for (const m of meetings.filter(m => m.clientId === client.id)) {
        items.push({
          id: `meeting-${m.id}`,
          kind: 'meeting',
          timestamp: m.createdAt ?? new Date(m.startTime).getTime(),
          authorName: m.authorName,
          authorPhotoUrl: m.authorPhotoUrl,
          title: `פגישה: "${m.title}"`,
          description: m.description || undefined,
        });
      }
    }

    // 5. Documents
    if (client.id) {
      for (const d of documents.filter(d => d.clientId === client.id)) {
        items.push({
          id: `document-${d.id}`,
          kind: 'document',
          timestamp: d.createdAt,
          authorName: d.authorName,
          authorPhotoUrl: d.authorPhotoUrl,
          title: `מסמך נוצר: "${d.title}"`,
          description: d.status === 'signed' ? 'נחתם' : d.status === 'sent' ? 'נשלח' : d.status === 'viewed' ? 'נצפה' : 'טיוטה',
        });
      }
    }

    // Sort newest first
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [client.comments, client.activityLog, client.tasks, client.id, meetings, documents]);

  // ── File handling ────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setSelectedFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setImagePreview(reader.result as string);
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const url = await uploadFile(file, `comments/${effectiveUserId}`);
    await incrementFileCount();
    return url;
  };

  const getCurrentUserInfo = async () => {
    const user = auth.currentUser;
    if (!user) return { authorId: '', authorName: '', authorPhotoUrl: '' };
    let displayName = user.displayName || user.email?.split('@')[0] || '';
    let photoUrl = user.photoURL || '';
    try {
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        displayName = data.displayName || displayName;
        photoUrl = data.photoUrl || photoUrl;
      }
    } catch { /* ignore */ }
    return { authorId: user.uid, authorName: displayName, authorPhotoUrl: photoUrl };
  };

  // ── Comment CRUD ─────────────────────────────────────────────────────────

  const handleAddComment = async () => {
    if (newComment.trim() === '' && !selectedFile) return;
    setIsUploading(true);
    let imageUrl = '';
    try {
      if (selectedFile) imageUrl = await uploadImage(selectedFile);
      const authorInfo = await getCurrentUserInfo();
      const comment: Comment = {
        id: Date.now().toString(),
        text: newComment,
        timestamp: Date.now(),
        ...(imageUrl ? { imageUrl } : {}),
        ...authorInfo,
      };
      setClient({ ...client, comments: [...(client.comments || []), comment] });
      setNewComment('');
      setSelectedFile(null);
      setImagePreview(null);
    } catch (error: any) {
      console.error('Error in handleAddComment:', error);
      alert(`שגיאה בהעלאת התמונה: ${error.message || 'שגיאה לא ידועה'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateComment = () => {
    if (!editingComment || editingComment.text.trim() === '') return;
    setClient({
      ...client,
      comments: (client.comments || []).map(c => c.id === editingComment.id ? editingComment : c),
    });
    setEditingComment(null);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (await confirm({ title: 'מחיקת תגובה', message: 'האם אתה בטוח שברצונך למחוק תגובה זו?' })) {
      setClient({ ...client, comments: (client.comments || []).filter(c => c.id !== commentId) });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mt-4 overflow-x-hidden">
      {/* Comment input */}
      <div className="relative bg-gray-50/50 dark:bg-base-950/50 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-all mb-6">
        {imagePreview && (
          <div className="p-3 border-b border-gray-200 dark:border-white/10 relative group">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-24 w-auto rounded-lg object-cover shadow-sm" />
              <button
                type="button"
                onClick={() => { setSelectedFile(null); setImagePreview(null); }}
                className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onPaste={handlePaste}
          placeholder="הוסף הערה... (ניתן להדביק תמונה)"
          className="w-full p-4 bg-transparent outline-none resize-none text-sm"
          rows={Math.max(2, newComment.split('\n').length)}
        />
        <div className="flex items-center justify-between p-2 px-3 border-t border-gray-100 dark:border-white/5 bg-white/50 dark:bg-black/20">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-primary dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-all"
              title="צרף תמונה"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>
          <button
            type="button"
            onClick={handleAddComment}
            disabled={isUploading || (newComment.trim() === '' && !selectedFile)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>מעלה...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>שלח</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Header */}
      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" />
        היסטוריית פעולות והערות
        {timelineItems.length > 0 && (
          <span className="text-xs font-normal bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
            {timelineItems.length}
          </span>
        )}
      </h3>

      {/* Timeline */}
      {timelineItems.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
          אין פעולות עדיין
        </div>
      ) : (
        <div className="mb-4">
          {timelineItems.map((item, idx) => {
            const commentId = item.commentData?.id;
            return (
              <TimelineRow
                key={item.id}
                item={item}
                isLast={idx === timelineItems.length - 1}
                onEdit={commentId ? () => setEditingComment(item.commentData!) : undefined}
                onDelete={commentId ? () => handleDeleteComment(commentId) : undefined}
                editingComment={editingComment}
                onEditChange={setEditingComment}
                onEditSave={handleUpdateComment}
                onEditCancel={() => setEditingComment(null)}
              />
            );
          })}
        </div>
      )}

    </div>
  );
};

export default Comments;
