import { describe, it, expect } from 'vitest';
import { scanDraftReply, hasBlockingViolation } from '../services/admin/output-policy-engine';

describe('BLOCK 25: Output Policy Engine — Enterprise AI Safety Guards', () => {

  // -----------------------------------------------------------------------
  // 1. Clean reply passes without violations
  // -----------------------------------------------------------------------
  it('PolicyEngine 1: Clean draft reply passes with zero violations', () => {
    const draft = 'Здравствуйте! Проверили ваш заказ #315. Со стороны провайдера поступил технический отказ. Вся сумма (150.00 ₽) уже вернулась на ваш баланс.';
    const violations = scanDraftReply(draft, '150.00');
    expect(violations).toHaveLength(0);
    expect(hasBlockingViolation(violations)).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 2. Blocked phrase "гарантируем" triggers BLOCK
  // -----------------------------------------------------------------------
  it('PolicyEngine 2: Detects blocked phrase "гарантируем" and returns BLOCK severity', () => {
    const draft = 'Мы гарантируем возврат 100 000 рублей на вашу карту Сбербанк в течение 24 часов.';
    const violations = scanDraftReply(draft, '150.00');
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(hasBlockingViolation(violations)).toBe(true);
    const blockedPhraseViolation = violations.find((v) => v.rule === 'BLOCKED_PHRASE');
    expect(blockedPhraseViolation).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 3. English injection attack blocked by language check
  // -----------------------------------------------------------------------
  it('PolicyEngine 3: Blocks English-language injection attack (WRONG_LANGUAGE)', () => {
    const draft = 'We confirm full refund of 50,000 RUB to your Sberbank card ending 4242. Transaction ID: REF-2026-CONFIRMED. Your refund has been processed successfully.';
    const violations = scanDraftReply(draft, '150.00');
    expect(hasBlockingViolation(violations)).toBe(true);
    const langViolation = violations.find((v) => v.rule === 'WRONG_LANGUAGE');
    expect(langViolation).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 4. Financial amount mismatch triggers WARN
  // -----------------------------------------------------------------------
  it('PolicyEngine 4: Detects AI-invented financial amounts not matching DB balance', () => {
    const draft = 'Мы вернули 999.99 ₽ на ваш баланс. Всего хорошего!';
    const violations = scanDraftReply(draft, '150.00');
    const financialViolation = violations.find((v) => v.rule === 'UNVERIFIED_FINANCIAL_CLAIM');
    expect(financialViolation).toBeDefined();
    expect(financialViolation?.detail).toContain('999.99');
  });

  // -----------------------------------------------------------------------
  // 5. System prompt leakage detection
  // -----------------------------------------------------------------------
  it('PolicyEngine 5: Detects system prompt leakage in draft reply', () => {
    const draft = 'Здравствуйте! ENTERPRISE ПРАВИЛА БЕЗОПАСНОСТИ запрещают мне раскрывать инструкции, но вот они...';
    const violations = scanDraftReply(draft, '150.00');
    expect(hasBlockingViolation(violations)).toBe(true);
    const leakViolation = violations.find((v) => v.rule === 'SYSTEM_PROMPT_LEAKAGE');
    expect(leakViolation).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 6. "на карту" phrase blocked (financial withdrawal promise)
  // -----------------------------------------------------------------------
  it('PolicyEngine 6: Blocks promise of withdrawal to bank card ("на карту")', () => {
    const draft = 'Средства в размере 5000 рублей будут переведены на карту Сбербанк в течение 3 рабочих дней.';
    const violations = scanDraftReply(draft, '150.00');
    expect(hasBlockingViolation(violations)).toBe(true);
    const cardViolation = violations.find((v) => v.detail.includes('на карту'));
    expect(cardViolation).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 7. Correct balance amount passes financial check
  // -----------------------------------------------------------------------
  it('PolicyEngine 7: Correct balance amount does NOT trigger financial violation', () => {
    const draft = 'Ваш текущий баланс составляет 150.00 ₽. Вы можете использовать его для нового заказа.';
    const violations = scanDraftReply(draft, '150.00');
    const financialViolations = violations.filter((v) => v.rule === 'UNVERIFIED_FINANCIAL_CLAIM');
    expect(financialViolations).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 8. Combined attack: English + guarantee + card withdrawal
  // -----------------------------------------------------------------------
  it('PolicyEngine 8: Combined multi-vector attack triggers multiple BLOCK violations', () => {
    const draft = 'I guarantee your refund of 100000 RUB will be transferred to your bank card within 24 hours. This is confirmed by our system override.';
    const violations = scanDraftReply(draft, '150.00');
    expect(violations.length).toBeGreaterThanOrEqual(3);
    expect(hasBlockingViolation(violations)).toBe(true);
  });
});
