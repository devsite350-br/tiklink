// WhatsApp (Green API) helpers: phone normalization, webhook parsing, client matching.
import { adminDb } from './admin';

// Normalize a phone string to digits-only international form (assumes Israel).
export const normalizePhone = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.substring(1);
  if (digits.length >= 10) return digits;
  return '972' + digits;
};

const phoneFromChatId = (chatId?: string): string | null => {
  if (!chatId) return null;
  return normalizePhone(String(chatId).split('@')[0]);
};

const placeholderForType = (type?: string): string => {
  switch (type) {
    case 'audioMessage':
    case 'voiceMessage':
    case 'pttMessage': return '[הודעת קול]';
    case 'imageMessage': return '[תמונה]';
    case 'videoMessage': return '[וידאו]';
    case 'documentMessage':
    case 'fileMessage': return '[מסמך]';
    case 'locationMessage': return '[מיקום]';
    case 'contactMessage':
    case 'contactsArrayMessage': return '[איש קשר]';
    case 'stickerMessage': return '[סטיקר]';
    case 'reactionMessage': return '[ריאקציה]';
    default: return '[הודעת מדיה]';
  }
};

const mapMessageType = (typeMessage?: string): string => {
  if (!typeMessage) return 'unknown';
  if (typeMessage === 'textMessage' || typeMessage === 'extendedTextMessage') return 'text';
  if (typeMessage === 'audioMessage' || typeMessage === 'voiceMessage' || typeMessage === 'pttMessage') return 'voice';
  if (typeMessage === 'imageMessage') return 'image';
  if (typeMessage === 'videoMessage') return 'video';
  if (typeMessage === 'documentMessage' || typeMessage === 'fileMessage') return 'document';
  if (typeMessage === 'locationMessage') return 'location';
  if (typeMessage === 'contactMessage' || typeMessage === 'contactsArrayMessage') return 'contact';
  if (typeMessage === 'stickerMessage') return 'sticker';
  return 'media';
};

export interface ParsedMessage {
  idMessage: string;
  direction: 'inbound' | 'outbound';
  timestamp: number;
  type: string;
  text?: string;
  placeholder?: string;
  fromPhone?: string;
  toPhone?: string;
  matchedPhone: string | null;
  rawTypeWebhook: string;
  status: string;
}

// Parse a Green API webhook body. Returns null for non-message events.
export const parseGreenApiWebhook = (body: any): ParsedMessage | null => {
  if (!body || typeof body !== 'object') return null;
  const typeWebhook = body.typeWebhook;
  if (typeWebhook !== 'incomingMessageReceived'
    && typeWebhook !== 'outgoingMessageReceived'
    && typeWebhook !== 'outgoingAPIMessageReceived') {
    return null;
  }
  const direction = typeWebhook === 'incomingMessageReceived' ? 'inbound' : 'outbound';
  const idMessage = body.idMessage;
  if (!idMessage) return null;

  const senderData = body.senderData || {};
  const messageData = body.messageData || {};
  const typeMessage = messageData.typeMessage;
  const innerType = mapMessageType(typeMessage);

  let text: string | undefined;
  if (typeMessage === 'textMessage' && messageData.textMessageData) {
    text = messageData.textMessageData.textMessage;
  } else if (typeMessage === 'extendedTextMessage' && messageData.extendedTextMessageData) {
    text = messageData.extendedTextMessageData.text;
  }

  const chatId = senderData.chatId;
  if (chatId && String(chatId).endsWith('@g.us')) return null;
  const peerPhone = phoneFromChatId(chatId);

  return {
    idMessage,
    direction,
    timestamp: body.timestamp ? body.timestamp * 1000 : Date.now(),
    type: innerType,
    text: innerType === 'text' ? (text || '') : undefined,
    placeholder: innerType === 'text' ? undefined : placeholderForType(typeMessage),
    fromPhone: direction === 'inbound' ? (peerPhone || undefined) : undefined,
    toPhone: direction === 'outbound' ? (peerPhone || undefined) : undefined,
    matchedPhone: peerPhone,
    rawTypeWebhook: typeWebhook,
    status: direction === 'inbound' ? 'received' : 'sent',
  };
};

// Find clients owned by `userId` whose phone customFields match `normalizedPhone`.
export const findClientsByPhone = async (userId: string, normalizedPhone: string) => {
  const customFieldsSnap = await adminDb
    .collection('users').doc(userId).collection('customFields').get();
  const phoneFieldIds = customFieldsSnap.docs
    .filter(d => d.data().type === 'טלפון')
    .map(d => d.id);
  if (phoneFieldIds.length === 0) return [];

  const clientsSnap = await adminDb
    .collection('users').doc(userId).collection('clients').get();
  const matches: { id: string; ref: FirebaseFirestore.DocumentReference; name: string }[] = [];
  clientsSnap.docs.forEach(doc => {
    if (doc.id === 'unassociated_client_id') return;
    const data = doc.data();
    const cf = data.customFields || {};
    for (const fieldId of phoneFieldIds) {
      const candidate = normalizePhone(cf[fieldId]);
      if (candidate && candidate === normalizedPhone) {
        matches.push({ id: doc.id, ref: doc.ref, name: data.name });
        return;
      }
    }
  });
  return matches;
};
