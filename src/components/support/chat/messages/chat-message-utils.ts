/**
 * Deterministic gradient picker for avatars based on string hash
 */
export const getAvatarGradient = (str: string): string => {
  const gradients = [
    'from-destructive to-warning',
    'from-success to-info',
    'from-primary to-info',
    'from-info to-primary',
    'from-destructive to-primary',
    'from-info to-success',
    'from-warning to-primary',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

/**
 * Derives avatar initials for user or staff/internal
 */
export const getInitials = (sender: string, email?: string): string => {
  if (sender === 'USER') {
    if (email) {
      const parts = email.split('@')[0];
      return parts.substring(0, 2).toUpperCase();
    }
    return 'CL';
  }
  if (sender === 'INTERNAL') return '🔒';
  return 'OP';
};

/**
 * Formats sticky chat date divider (Сегодня, Вчера, или локализованная дата)
 */
export const formatChatDateDivider = (dateStr: string | Date): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Сегодня';
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  }
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

/**
 * Checks whether two messages were sent on different calendar days
 */
export const isDifferentChatDay = (d1Str?: string | Date, d2Str?: string | Date): boolean => {
  if (!d1Str || !d2Str) return true;
  const d1 = new Date(d1Str);
  const d2 = new Date(d2Str);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return d1.toDateString() !== d2.toDateString();
};
