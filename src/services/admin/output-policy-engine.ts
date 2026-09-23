/**
 * Output Policy Engine — Детерминированный сканер ответов AI.
 * 
 * Проверяет draft_reply ПОСЛЕ парсинга JSON и ДО отправки оператору.
 * Гарантирует, что AI не пообещал невозможного, не перешел на другой язык
 * и не указал суммы, отличающиеся от реальных данных БД.
 * 
 * Стандарт: OWASP LLM Top 10 2025, EU AI Act (август 2026)
 */

const BLOCKED_PHRASES_RU = [
  'гарантирую', 'гарантируем', 'мы гарантируем',
  '100%', 'стопроцентн',
  'обязательно компенсир', 'возместим ущерб', 'компенсируем полностью',
  'переведу на вашу карту', 'отправил на карту', 'выплачу на карту', 'прямо сейчас переведу на карту',
  'вывод на стороннюю карту', 'выплатим наличными',
  'судебн', 'обратитесь в суд',
  'т-банк', 'тинькофф', 'тиньков', 'юмани', 'юmoney', 'usdt', 'trc20', 'криптовалют', 'stars', 'наличными',
];

const BLOCKED_PHRASES_EN = [
  'guarantee', 'we guarantee', 'i guarantee',
  'we confirm instant payout', 'i will transfer to your private card',
  'ignore previous', 'ignore your instructions', 'system override',
];

export interface PolicyViolation {
  rule: string;
  detail: string;
  severity: 'BLOCK' | 'WARN';
}

/**
 * Scans AI-generated draft_reply for policy violations.
 * Returns empty array if clean, or array of violations.
 */
export function scanDraftReply(
  draft: string,
  balanceFromDb: string,
  allowedContextAmounts: Array<number | string> = [],
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const lower = draft.toLowerCase();

  // Rule 1: Blocked phrases scan (RU + EN)
  for (const phrase of [...BLOCKED_PHRASES_RU, ...BLOCKED_PHRASES_EN]) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push({
        rule: 'BLOCKED_PHRASE',
        detail: `Обнаружена запрещенная фраза: "${phrase}"`,
        severity: 'BLOCK',
      });
    }
  }

  // Rule 2: Financial claim validator — AI must not invent monetary amounts
  // Normalize allowed amounts from DB (balance + order charges in ticket context)
  const allowedNumeric: number[] = [];
  const parsedDbBalance = parseFloat(balanceFromDb.replace(/[^\d.,]/g, '').replace(',', '.'));
  if (!isNaN(parsedDbBalance)) {
    allowedNumeric.push(parsedDbBalance);
  }
  for (const item of allowedContextAmounts) {
    const num = typeof item === 'number' ? item : parseFloat(String(item).replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(num)) {
      allowedNumeric.push(num);
    }
  }

  const moneyMatches = draft.match(/(?:[\$€£]\s*\d[\d\s,.]*|\d[\d\s,.]*\s*(?:₽|руб|rub|usd|usdt|евро|eur|\$|€))/gi) || [];
  for (const match of moneyMatches) {
    const digits = match.replace(/[^\d.,]/g, '').replace(',', '.');
    const claimVal = parseFloat(digits);
    if (!isNaN(claimVal) && claimVal > 0) {
      const isAllowed = allowedNumeric.some((allowed) => Math.abs(allowed - claimVal) < 0.01);
      if (!isAllowed) {
        violations.push({
          rule: 'UNVERIFIED_FINANCIAL_CLAIM',
          detail: `AI указал сумму "${digits}", но реальный баланс из БД: ${balanceFromDb} ₽`,
          severity: 'BLOCK',
        });
      }
    }
  }

  // Rule 3: Language check — response must be predominantly Russian (Cyrillic)
  const cyrillicCount = (draft.match(/[а-яА-ЯёЁ]/g) || []).length;
  const latinCount = (draft.match(/[a-zA-Z]/g) || []).length;
  if (latinCount > cyrillicCount && draft.length > 50) {
    violations.push({
      rule: 'WRONG_LANGUAGE',
      detail: `Ответ содержит больше латиницы (${latinCount}) чем кириллицы (${cyrillicCount}). Возможна языковая атака.`,
      severity: 'BLOCK',
    });
  }

  // Rule 4: System prompt leakage detection
  const leakageMarkers = [
    'ENTERPRISE ПРАВИЛА', 'ANTI-HALLUCINATION', 'ФОРМАТ ВЫВОДА СТРОГО',
    'КОНТЕКСТ (ИСТИНА', 'ЗАПРЕТ НА ВЫДУМЫВАНИЕ', 'ESCALATION LOOP',
    'systemInstruction', 'system_instruction',
  ];
  for (const marker of leakageMarkers) {
    if (draft.includes(marker)) {
      violations.push({
        rule: 'SYSTEM_PROMPT_LEAKAGE',
        detail: `Обнаружена утечка системного промпта: "${marker}"`,
        severity: 'BLOCK',
      });
    }
  }

  // Rule 5: Excessive length guard (> 2000 chars is suspicious)
  if (draft.length > 2000) {
    violations.push({
      rule: 'EXCESSIVE_LENGTH',
      detail: `Ответ слишком длинный (${draft.length} символов). Возможно, содержит инъектированный контент.`,
      severity: 'WARN',
    });
  }

  return violations;
}

/**
 * Returns true if any violation has severity BLOCK.
 */
export function hasBlockingViolation(violations: PolicyViolation[]): boolean {
  return violations.some((v) => v.severity === 'BLOCK');
}
