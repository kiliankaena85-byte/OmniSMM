import { z } from 'zod';
import { canonicalizeUrl } from '@/services/link-engine/link-canonicalizer';
import { getUnifiedLinkValidator, getUnifiedCustomValidator } from '@/services/link-engine/link-rules-registry';

/**
 * (c) 2026 SMMplan.
 * Link Mutators and Validators Facade Adapter.
 * Delegates all logic to LinkCanonicalizer and LinkRulesRegistry (SSOT).
 * Ensures 100% backward compatibility and zero client bundle pollution.
 */

export const mutateLink = (url: string, platform: string, targetType: string): string => {
  return canonicalizeUrl(url, platform, targetType);
};

export const getLinkValidator = (platform: string, targetType: string): z.ZodType<string> => {
  return getUnifiedLinkValidator(platform, targetType);
};

export const getCustomValidator = (customDataType?: string | null): z.ZodType<string> => {
  return getUnifiedCustomValidator(customDataType);
};

/**
 * Validates regular expression safety (ReDoS protection) and optionally runs smoke test URLs
 */
export function validateRegexSafetyAndSmoke(
  pattern: string,
  smokeCases?: { url: string; expectedMatch: boolean }[]
): { isValid: boolean; error?: string; warning?: string } {
  if (!pattern || !pattern.trim()) {
    return { isValid: false, error: 'Шаблон регулярного выражения не может быть пустым' };
  }

  // Length guard
  if (pattern.length > 300) {
    return { isValid: false, error: 'Слишком длинный шаблон регулярного выражения (макс. 300 символов)' };
  }

  // Nested quantifiers check (ReDoS)
  const redosDetectors = [
    /\([^)]*(\+|\*)[^)]*\)[+*]/,
    /\([^)]*(\+|\*)[^)]*\)\{/i,
    /\([a-z0-9_.\-\\s|]+\+[|][^)]+\)\+/i,
    /\([a-z0-9_.\-\\s|]+\*[|][^)]+\)\*/i,
    /\(\.\*\)\+/,
    /\(\.\+\)\+/,
    /\(\.\*\)\*/,
    /\([^)]*\|[^)]*\)[+*]/,
    /\(\.\*[^)]*\)\{\d+,?\}/,
  ];

  for (const dangerous of redosDetectors) {
    if (dangerous.test(pattern)) {
      return {
        isValid: false,
        error: 'Обнаружена потенциальная ReDoS уязвимость (вложенные квантификаторы вроде (a+)+ или (.*)+)'
      };
    }
  }

  // Compilation test
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'i');
  } catch (e: unknown) {
    return {
      isValid: false,
      error: `Синтаксическая ошибка в RegEx: ${e instanceof Error ? e.message : String(e)}`
    };
  }

  // Smoke test cases if provided
  if (smokeCases && smokeCases.length > 0) {
    for (const testCase of smokeCases) {
      const isMatch = Boolean(testCase.url.match(regex));
      if (isMatch !== testCase.expectedMatch) {
        return {
          isValid: false,
          error: `Smoke-тест не пройден для URL "${testCase.url}": ожидалось ${testCase.expectedMatch ? 'совпадение' : 'отклонение'}, получено ${isMatch ? 'совпадение' : 'отклонение'}`
        };
      }
    }
  }

  return { isValid: true };
}
