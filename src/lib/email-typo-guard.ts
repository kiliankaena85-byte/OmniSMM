/**
 * src/lib/email-typo-guard.ts
 *
 * Proactive Email Typo Guard (NN/g Usability Heuristic #5: Error Prevention).
 * Suggests standard domains for common typos to prevent lost order access and support ticket overload.
 */

const COMMON_TYPOS: Record<string, string> = {
  // Gmail
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.ru': 'gmail.com',
  'gmai.ru': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gmai.co': 'gmail.com',

  // Yandex
  'yandx.ru': 'yandex.ru',
  'yadnex.ru': 'yandex.ru',
  'yande.ru': 'yandex.ru',
  'yanddex.ru': 'yandex.ru',
  'yandex.ry': 'yandex.ru',
  'yndex.ru': 'yandex.ru',
  'yandex.com': 'yandex.ru',

  // Mail.ru
  'mil.ru': 'mail.ru',
  'mial.ru': 'mail.ru',
  'mai.ru': 'mail.ru',
  'maill.ru': 'mail.ru',
  'mail.ry': 'mail.ru',

  // VK / Inbox / BK / List
  'inboxx.ru': 'inbox.ru',
  'inbx.ru': 'inbox.ru',
  'bk.com': 'bk.ru',
  'list.com': 'list.ru',

  // Apple & Microsoft
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outluk.com': 'outlook.com'
};

/**
 * Returns a suggested corrected email if the domain is a known common typo, or null if no typo detected.
 */
export function suggestEmailCorrection(email: string): string | null {
  if (!email || !email.includes('@')) return null;

  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;

  const [username, domain] = parts;
  if (!username || !domain) return null;

  const correctedDomain = COMMON_TYPOS[domain];
  if (correctedDomain && correctedDomain !== domain) {
    return `${username}@${correctedDomain}`;
  }

  return null;
}
