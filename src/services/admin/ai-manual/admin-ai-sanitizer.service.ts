/**
 * Level 1 Service: Admin AI Sanitizer
 * Implements Zero-Leakage & OWASP PII Protection Invariants
 */

export class AdminAiSanitizerService {
  // Luhn-like or 13-19 digit credit card numbers
  private static readonly CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;

  // Phone numbers (+7/8...)
  private static readonly PHONE_REGEX = /(?:\+7|8)[\s\-(]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b/g;

  // Email addresses
  private static readonly EMAIL_REGEX = /\b([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g;

  // API keys, tokens, secret values in text
  private static readonly SECRET_PATTERNS = [
    /(?:[\w-]*(?:api[_-]?key|secret[_-]?key|token|password|auth[_-]?key|secret)|\bkey)\s*[:=]\s*["']?([a-zA-Z0-9_\-.~!@#$%^&*+=]{12,})["']?/gi,
    /(?:live_|test_|sk_|pk_)[a-zA-Z0-9]{20,}/g,
    /ey[a-zA-Z0-9_-]{20,}\.ey[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g, // JWT tokens
  ];

  /**
   * Sanitizes input text before feeding into LLM prompt
   */
  static sanitizeInput(rawText: string): string {
    if (!rawText) return '';

    let cleaned = rawText;

    // Mask Credit Cards
    cleaned = cleaned.replace(this.CARD_REGEX, (match) => {
      const digitsOnly = match.replace(/\D/g, '');
      if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
        return `[CARD_REDACTED_...${digitsOnly.slice(-4)}]`;
      }
      return match;
    });

    // Mask Phones
    cleaned = cleaned.replace(this.PHONE_REGEX, '[PHONE_REDACTED]');

    // Mask Emails (keep domain, mask local part)
    cleaned = cleaned.replace(this.EMAIL_REGEX, (_, user, domain) => {
      const maskedUser = user.length > 2 ? `${user[0]}***${user.slice(-1)}` : '***';
      return `${maskedUser}@${domain}`;
    });

    // Mask Tokens & Secrets
    for (const pattern of this.SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      cleaned = cleaned.replace(pattern, (match) => {
        if (/[:=]/.test(match)) {
          return match.replace(/[:=]\s*["']?.+["']?/, '="[REDACTED_SECRET]"');
        }
        return '[REDACTED_SECRET]';
      });
    }

    return cleaned;
  }

  /**
   * Sanitizes code snippets retrieved from vector store
   */
  static sanitizeCodeSnippet(snippet: string): string {
    if (!snippet) return '';
    let sanitized = snippet;

    // Redact hardcoded potential secrets in assignments
    sanitized = sanitized.replace(
      /(['"`])([a-f0-9]{32,}|AIzaSy[a-zA-Z0-9_-]{33}|[a-zA-Z0-9_-]{40,})\1/g,
      '"[REDACTED_SECRET]"'
    );

    return sanitized;
  }
}
