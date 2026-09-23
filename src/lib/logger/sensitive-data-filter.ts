/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Sensitive Data Redactor (Log Masking Filter).
 */

export interface SensitivePatternRule {
  pattern: RegExp;
  replacement: string;
}

export const SENSITIVE_PATTERNS: SensitivePatternRule[] = [
  {
    pattern: /("?(?:apiKey|token|secret|password|twoFactorSecret|databaseUrl|redisUrl|appEncryptionKey|jwtSecret)"?\s*[:=]\s*)"([^"]+)"/gi,
    replacement: '$1"[REDACTED]"',
  },
  {
    pattern: /("?(?:apiKey|token|secret|password|twoFactorSecret|databaseUrl|redisUrl|appEncryptionKey|jwtSecret)"?\s*[:=]\s*)'([^']+)'/gi,
    replacement: '$1"[REDACTED]"',
  },
  {
    pattern: /(key=)([a-f0-9]{20,})/gi,
    replacement: '$1"[REDACTED]"',
  },
  {
    pattern: /(Bearer\s+)([a-zA-Z0-9_.-]{20,})/gi,
    replacement: '$1"[REDACTED]"',
  },
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
];

export function redactSensitiveTokens(logString: string): string {
  if (!logString || typeof logString !== 'string') return logString;

  let sanitized = logString;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
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

