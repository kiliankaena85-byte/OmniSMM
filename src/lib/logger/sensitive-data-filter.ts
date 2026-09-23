/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Sensitive Data Redactor (Log Masking Filter — PII-01 / PII-02).
 */

export interface SensitivePatternRule {
  pattern: RegExp;
  replacement: string | ((substring: string, ...args: any[]) => string);
}

/** Mask email address: user@example.com -> u***@example.com */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return email;
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (!local) return `@${domain}`;
  return `${local[0]}***@${domain}`;
}

export const SENSITIVE_PATTERNS: SensitivePatternRule[] = [
  // 1. Credentials, API keys, and auth tokens in JSON / key-value
  {
    pattern: /("?(?:apiKey|token|sessionToken|magicToken|authToken|accessToken|refreshToken|secret|password|twoFactorSecret|databaseUrl|redisUrl|appEncryptionKey|jwtSecret)"?\s*[:=]\s*)"([^"]+)"/gi,
    replacement: '$1"[REDACTED]"',
  },
  {
    pattern: /("?(?:apiKey|token|sessionToken|magicToken|authToken|accessToken|refreshToken|secret|password|twoFactorSecret|databaseUrl|redisUrl|appEncryptionKey|jwtSecret)"?\s*[:=]\s*)'([^']+)'/gi,
    replacement: '$1"[REDACTED]"',
  },

  // 2. Token query parameters in URLs (e.g. ?token=abc or &token=abc)
  {
    pattern: /([?&]token=)([^&\s"']+)/gi,
    replacement: '$1[REDACTED]',
  },

  // 3. Phone numbers in JSON / key-value fields
  {
    pattern: /("?(?:phone|phoneNumber|userPhone|mobile|telephone)"?\s*[:=]\s*)"([^"]+)"/gi,
    replacement: '$1"[REDACTED]"',
  },

  // 4. API keys and Bearer tokens in headers / query strings
  {
    pattern: /(key=)([a-f0-9]{20,})/gi,
    replacement: '$1"[REDACTED]"',
  },
  {
    pattern: /(Bearer\s+)([a-zA-Z0-9_.-]{20,})/gi,
    replacement: '$1"[REDACTED]"',
  },

  // 5. Database and Redis connection strings with credentials
  {
    pattern: /(DATABASE_URL\s*=\s*)([^\s]+)/gi,
    replacement: '$1"[REDACTED]"',
  },
  {
    pattern: /(REDIS_URL\s*=\s*)([^\s]+)/gi,
    replacement: '$1"[REDACTED]"',
  },
  {
    pattern: /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi,
    replacement: '$1*****$3',
  },
  {
    pattern: /(redis(?:s)?:\/\/[^:]+:)([^@]+)(@)/gi,
    replacement: '$1*****$3',
  },

  // 6. Emails in JSON / key-value fields (e.g. "email":"user@domain.com" -> "email":"u***@domain.com")
  {
    pattern: /("?(?:email|userEmail|clientEmail|recipient)"?\s*[:=]\s*)"([^"@]+)(@[^"]+)"/gi,
    replacement: (_m: string, prefix: string, local: string, domain: string) => {
      const firstChar = local && local[0] ? local[0] : '';
      return `${prefix}"${firstChar}***${domain}"`;
    },
  },

  // 7. Standalone email addresses in log message text
  {
    pattern: /\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*(@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/gi,
    replacement: '$1***$2',
  },
];

export function redactSensitiveTokens(logString: string): string {
  if (!logString || typeof logString !== 'string') return logString;

  let sanitized = logString;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    if (typeof replacement === 'function') {
      sanitized = sanitized.replace(pattern, replacement as any);
    } else {
      sanitized = sanitized.replace(pattern, replacement);
    }
  }

  return sanitized;
}

export function sanitizeLogObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  try {
    const str = JSON.stringify(obj);
    const sanitized = redactSensitiveTokens(str);
    return JSON.parse(sanitized) as T;
  } catch {
    return obj;
  }
}
