// Normalize a phone number to the canonical international form expected by
// Green API (e.g. "972501234567"). Returns null when the input has no usable
// digits.
export const normalizePhoneForGreenApi = (raw: string | null | undefined): string | null => {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (hasPlus) return digits;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.substring(1);
  if (digits.length >= 10) return digits;
  return '972' + digits;
};

export const phoneToGreenApiChatId = (normalized: string): string => `${normalized}@c.us`;
