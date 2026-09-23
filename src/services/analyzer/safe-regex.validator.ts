/**
 * Safe RegExp Validator & ReDoS Detector for SMMplan Link Analyzer
 * Prevents catastrophic backtracking and validates pattern syntax.
 */

export interface ValidationResult {
  isValid: boolean;
  isSafe: boolean;
  error?: string;
  warning?: string;
  executionTimeMs?: number;
  extractedGroups?: string[];
  isMatch?: boolean;
}

// Patterns that typically indicate catastrophic exponential backtracking (ReDoS)
const REDOS_PATTERNS = [
  /\([^)]*(\+|\*)[^)]*\)[+*]/,          // (a+)+ or (x+x+)+ or (a*)*
  /\([^)]*(\+|\*)[^)]*\)\{/i,          // (a+){2,}
  /\([a-z0-9_.\-\\s|]+\+[|][^)]+\)\+/i, // (a+|b)+
  /\([a-z0-9_.\-\\s|]+\*[|][^)]+\)\*/i, // (a*|b)*
  /\(\.\*\)\+/,                   // (.*)+
  /\(\.\+\)\+/,                   // (.+)+
  /\(\.\*\)\*/,                   // (.*)*
  /\([^)]*\|[^)]*\)[+*]/,         // (a|aa)+
  /\(\.\*[^)]*\)\{\d+,?\}/,       // (.*a){10}
];

export class SafeRegexValidator {
  /**
   * Statically inspects a regex string for common ReDoS vulnerability patterns
   */
  static staticAudit(patternString: string): { isSafe: boolean; reason?: string } {
    if (!patternString || typeof patternString !== 'string') {
      return { isSafe: false, reason: 'Паттерн не может быть пустым' };
    }

    // Limit maximum regex length to prevent parser exhaustion
    if (patternString.length > 300) {
      return { isSafe: false, reason: 'Слишком длинное регулярное выражение (макс. 300 символов)' };
    }

    for (const dangerous of REDOS_PATTERNS) {
      if (dangerous.test(patternString)) {
        return {
          isSafe: false,
          reason: 'Обнаружена потенциальная ReDoS уязвимость (вложенные квантификаторы вроде (a+)+ или (.*)+)'
        };
      }
    }

    return { isSafe: true };
  }

  /**
   * Compiles and safely tests a regex with execution time measurement
   */
  static testPattern(patternString: string, sampleUrl: string, flags: string = 'i'): ValidationResult {
    // 0. Input payload length guard (prevents event-loop freezing on massive strings)
    if (sampleUrl && sampleUrl.length > 512) {
      return {
        isValid: false,
        isSafe: false,
        error: 'Длина проверяемой ссылки превышает лимит безопасности (максимум 512 символов)'
      };
    }

    // 1. Static security audit
    const audit = this.staticAudit(patternString);
    if (!audit.isSafe) {
      return {
        isValid: false,
        isSafe: false,
        error: audit.reason
      };
    }

    // 2. Syntax compilation check
    let regex: RegExp;
    try {
      regex = new RegExp(patternString, flags);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      return {
        isValid: false,
        isSafe: false,
        error: `Синтаксическая ошибка в RegEx: ${err}`
      };
    }

    // 3. Execution with high-resolution performance timer
    const startTime = performance.now();
    let match: RegExpMatchArray | null = null;
    try {
      match = sampleUrl ? sampleUrl.match(regex) : null;
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      return {
        isValid: true,
        isSafe: false,
        error: `Ошибка выполнения RegEx: ${err}`
      };
    }
    const endTime = performance.now();
    const durationMs = Number((endTime - startTime).toFixed(3));

    // If execution takes over 25ms on a short string, flag as slow/hazardous
    const isSlow = durationMs > 25;

    const extractedGroups: string[] = [];
    if (match) {
      // Collect capture groups (skip index 0 full match)
      for (let i = 1; i < match.length; i++) {
        if (match[i] !== undefined) {
          extractedGroups.push(match[i]);
        }
      }
    }

    return {
      isValid: true,
      isSafe: !isSlow,
      warning: isSlow ? `Внимание: Выполнение заняло ${durationMs} мс. Оптимизируйте шаблон.` : undefined,
      executionTimeMs: durationMs,
      isMatch: Boolean(match),
      extractedGroups
    };
  }

  /**
   * Helper to convert user-friendly masks like `t.me/{channel}/{postId}` into safe RegExp
   */
  static maskToRegex(mask: string): string {
    if (!mask) return '';

    let escaped = mask.trim();

    // Escape dots and slashes
    escaped = escaped.replace(/\./g, '\\.').replace(/\//g, '\\/');

    // Replace placeholders with regex groups using safe character class placement
    escaped = escaped
      .replace(/\{username\}/gi, '([-_a-zA-Z0-9.]+)')
      .replace(/\{channel\}/gi, '([-_a-zA-Z0-9.]+)')
      .replace(/\{postId\}/gi, '(\\d+)')
      .replace(/\{id\}/gi, '([-_a-zA-Z0-9]+)')
      .replace(/\{videoId\}/gi, '([-_a-zA-Z0-9]{6,15})')
      .replace(/\{slug\}/gi, '([-_a-zA-Z0-9]+)');

    return escaped;
  }

  /**
   * Runs a suite of smoke test URLs against a regex to verify both safety and functional matching accuracy
   */
  static runSmokeTestSuite(
    patternString: string,
    smokeCases: { url: string; expectedMatch: boolean }[],
    flags: string = 'i'
  ): { passed: boolean; failedCases: { url: string; expected: boolean; actual: boolean }[]; error?: string } {
    const audit = this.staticAudit(patternString);
    if (!audit.isSafe) {
      return { passed: false, failedCases: [], error: audit.reason };
    }

    let regex: RegExp;
    try {
      regex = new RegExp(patternString, flags);
    } catch (e: unknown) {
      return { passed: false, failedCases: [], error: e instanceof Error ? e.message : String(e) };
    }

    const failedCases: { url: string; expected: boolean; actual: boolean }[] = [];
    for (const testCase of smokeCases) {
      const match = Boolean(testCase.url.match(regex));
      if (match !== testCase.expectedMatch) {
        failedCases.push({ url: testCase.url, expected: testCase.expectedMatch, actual: match });
      }
    }

    return {
      passed: failedCases.length === 0,
      failedCases,
      error: failedCases.length > 0 ? `Не прошло ${failedCases.length} smoke-тестов` : undefined
    };
  }
}

