/**
 * security-auditor.ts
 * Офицер Информационной Безопасности & Red Team Pentest Auditor (SEC-GATE-2026).
 * 
 * Автономный модуль анализа кода на устойчивость к пентестам (OWASP Top 10:2025,
 * PCI DSS v4.0.1, ASVS 4.0.3), генерации векторов атак и требований защиты.
 */

import { SecurityThreatVector, SecurityAuditReport, ThreatCategory } from './types';

export class PentestSecurityAuditor {
  /**
   * Сканирует исходный код файла на известные векторы пентест-атак.
   */
  public static auditCode(filePath: string, content: string): SecurityThreatVector[] {
    const threats: SecurityThreatVector[] = [];
    const lines = content.split('\n');
    const isFinancialFile = /financial|payment|wallet|balance|billing|refund|ledger/i.test(filePath);
    const isServerAction = /'use server'|"use server"/.test(content);

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Игнорируем комментарии и тесты
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
      if (filePath.includes('.test.') || filePath.includes('.spec.')) return;

      // Вектор 1: Timing Attacks (Небезопасное сравнение токенов/подписей через ===)
      if (
        /(?:signature|secret|token|hash|apikey|webhooksecret)\s*(?:===|!==)/i.test(trimmed) &&
        !content.includes('timingSafeEqual')
      ) {
        threats.push({
          id: `SEC-TIMING-${lineNum}`,
          category: 'TIMING_ATTACK_CRYPTO',
          owaspReference: 'A02:2025 Cryptographic Failures',
          file: filePath,
          line: lineNum,
          attackScenario: 'Побайтовый перебор секрета через статистический замер времени ответа (Timing Attack).',
          mitigationRequirement: 'Используйте crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)) равной длины.',
          severity: 'CRITICAL',
        });
      }

      // Вектор 2: Financial Precision Leaks (Math.round / parseFloat в финансовых модулях)
      if (isFinancialFile && /\b(Math\.round|parseFloat|parseInt)\b/.test(trimmed) && !trimmed.includes('ExactMath')) {
        threats.push({
          id: `SEC-FIN-FLOAT-${lineNum}`,
          category: 'FINANCIAL_EXACT_MATH',
          owaspReference: 'A08:2025 Software and Data Integrity Failures',
          file: filePath,
          line: lineNum,
          attackScenario: 'Накопление ошибки округления IEEE-754 и кассовый разрыв при операциях с балансом.',
          mitigationRequirement: 'Используйте библиотеку ExactMath и нативный целочисленный тип BigInt (копейки).',
          severity: 'CRITICAL',
        });
      }

      // Вектор 3: Небезопасный сетевой вызов (SSRF)
      if (/\bfetch\s*\(/.test(trimmed) && !content.includes('safeFetch') && !trimmed.includes('safeFetch')) {
        threats.push({
          id: `SEC-SSRF-${lineNum}`,
          category: 'SSRF_INJECTION',
          owaspReference: 'A10:2025 Server-Side Request Forgery (SSRF)',
          file: filePath,
          line: lineNum,
          attackScenario: 'Атака на внутреннюю инфраструктуру (169.254.169.254 cloud metadata или localhost).',
          mitigationRequirement: 'Замените нативный fetch на safeFetch с фильтрацией приватных подсетей.',
          severity: 'HIGH',
        });
      }

      // Вектор 4: IDOR / Небезопасный вызов Server Action без сессии
      if (
        isServerAction &&
        /export\s+(?:async\s+)?function\s+\w+Action/.test(trimmed) &&
        !content.includes('verifySession') &&
        !content.includes('requireStaffPermission') &&
        !content.includes('RateLimitService')
      ) {
        threats.push({
          id: `SEC-IDOR-${lineNum}`,
          category: 'IDOR_ACCESS_CONTROL',
          owaspReference: 'A01:2025 Broken Access Control',
          file: filePath,
          line: lineNum,
          attackScenario: 'Неавторизованный вызов мутирующего серверного действия без проверки сессии или прав (IDOR).',
          mitigationRequirement: 'Внедрите обязательную проверку verifySession() или requireStaffPermission().',
          severity: 'CRITICAL',
        });
      }
    });

    // Вектор 5: Отсутствие Rate Limiting в публичных Server Actions
    if (isServerAction && !content.includes('RateLimitService') && !content.includes('verifySession')) {
      threats.push({
        id: `SEC-RATELIMIT-01`,
        category: 'RATE_LIMIT_DOS',
        owaspReference: 'A07:2025 Identification and Authentication Failures',
        file: filePath,
        line: 1,
        attackScenario: 'DoS-атака или брутфорс эндпоинта за счет неограниченного параллельного вызова.',
        mitigationRequirement: 'Подключите RateLimitService.checkCustomKey с ограничением по IP или идентификатору.',
        severity: 'HIGH',
      });
    }

    return threats;
  }

  /**
   * Формирует полный аудит-отчет с пентест-сьютом.
   */
  public static generateAuditReport(filePath: string, content: string): SecurityAuditReport {
    const threats = this.auditCode(filePath, content);
    const isImmune = threats.filter(t => t.severity === 'CRITICAL').length === 0;

    const requiredGuards = Array.from(new Set(threats.map(t => t.mitigationRequirement)));
    const pentestTestCases = threats.map(t => 
      `[PENTEST TEST] Проверить устойчивость к вектору ${t.category} (${t.owaspReference}): ${t.attackScenario}`
    );

    return {
      timestamp: new Date().toISOString(),
      threatsIdentified: threats,
      isImmune,
      requiredGuards,
      pentestTestCases,
    };
  }
}
