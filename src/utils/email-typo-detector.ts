/**
 * Email Typo Detector & Auto-Suggest Engine
 * Detects common user typos in email domains (e.g. gmail.ru, gmai.com, yandx.ru)
 * and provides instant suggestions for checkout & support operators.
 */

const POPULAR_DOMAINS = [
  'gmail.com',
  'yandex.ru',
  'yandex.com',
  'ya.ru',
  'mail.ru',
  'bk.ru',
  'inbox.ru',
  'list.ru',
  'rambler.ru',
  'icloud.com',
  'outlook.com',
  'hotmail.com',
  'proton.me',
  'protonmail.com'
];

const KNOWN_TYPO_MAP: Record<string, string> = {
  // Gmail typos
  'gmail.ru': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'googlemail.ru': 'googlemail.com',
  
  // Yandex typos
  'yandex.com.ru': 'yandex.ru',
  'yandx.ru': 'yandex.ru',
  'yadex.ru': 'yandex.ru',
  'yndx.ru': 'yandex.ru',
  'yandexx.ru': 'yandex.ru',
  'yandex.ry': 'yandex.ru',
  'ya.com': 'ya.ru',

  // Mail.ru typos
  'mail.com': 'mail.ru',
  'mai.ru': 'mail.ru',
  'mial.ru': 'mail.ru',
  'maill.ru': 'mail.ru',
  'mail.ry': 'mail.ru',
  'inbox.ry': 'inbox.ru',
  'bk.ry': 'bk.ru',
  'list.ry': 'list.ru',

  // Rambler typos
  'rambler.com': 'rambler.ru',
  'rmbler.ru': 'rambler.ru',

  // iCloud typos
  'icloud.ru': 'icloud.com',
  'icoud.com': 'icloud.com',
  'iclud.com': 'icloud.com',
};

/**
 * Levenshtein distance for fuzzy string matching
 */
function levenshtein(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1,    // insertion
            matrix[i - 1][j] + 1     // deletion
          )
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Check if the email has a likely typo in the domain and return a suggestion.
 * Returns null if the email domain looks valid and healthy.
 */
export function suggestCorrectEmail(rawEmail: string): string | null {
  if (!rawEmail || typeof rawEmail !== 'string') return null;
  const cleanEmail = rawEmail.trim().toLowerCase();
  
  const atIndex = cleanEmail.lastIndexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === cleanEmail.length - 1) {
    return null;
  }

  const userPart = cleanEmail.substring(0, atIndex);
  const domainPart = cleanEmail.substring(atIndex + 1);

  // 1. Direct match in dictionary
  if (KNOWN_TYPO_MAP[domainPart]) {
    return `${userPart}@${KNOWN_TYPO_MAP[domainPart]}`;
  }

  // 2. If it's already an exact match to a popular domain, it's valid
  if (POPULAR_DOMAINS.includes(domainPart)) {
    return null;
  }

  // 3. Fuzzy Levenshtein check (distance <= 1 or 2)
  for (const popular of POPULAR_DOMAINS) {
    const dist = levenshtein(domainPart, popular);
    if (dist === 1 || (domainPart.length > 7 && dist === 2)) {
      return `${userPart}@${popular}`;
    }
  }

  return null;
}
