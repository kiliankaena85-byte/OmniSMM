import { describe, it, expect } from 'vitest';
import { OperatorVerificationGuard } from '../services/admin/operator-verification-guard.service';

describe('BLOCK 29: Anti-Automation Bias & Operator Verification Gatekeeper Suite', () => {

  // -----------------------------------------------------------------------
  // 1. Placeholder Detection
  // -----------------------------------------------------------------------
  it('Verification 1: Accurately identifies unedited operator placeholders in draft', () => {
    const draftWithPlaceholder =
      'Здравствуйте! Проверил ваш аккаунт. Пожалуйста, проверьте в настройках: [ОПЕРАТОР: УТОЧНИТЕ, СНЯТА ЛИ ГАЛОЧКА ПОМЕТИТЬ ДЛЯ ПРОВЕРКИ].';

    const placeholders = OperatorVerificationGuard.findUneditedPlaceholders(draftWithPlaceholder);
    expect(placeholders).toHaveLength(1);
    expect(placeholders[0]).toBe('[ОПЕРАТОР: УТОЧНИТЕ, СНЯТА ЛИ ГАЛОЧКА ПОМЕТИТЬ ДЛЯ ПРОВЕРКИ]');
  });

  // -----------------------------------------------------------------------
  // 2. Multiple Placeholder Types ([TODO], [ПРОВЕРИТЬ], [ВНИМАНИЕ])
  // -----------------------------------------------------------------------
  it('Verification 2: Catches varied placeholder formats ([ПРОВЕРИТЬ], [TODO], [ВНИМАНИЕ])', () => {
    const multiDraft =
      'Текст ответа. [ПРОВЕРИТЬ: ссылка на канал или пост] и еще [TODO: сверить остаток баланса].';

    const placeholders = OperatorVerificationGuard.findUneditedPlaceholders(multiDraft);
    expect(placeholders).toHaveLength(2);
    expect(placeholders).toContain('[ПРОВЕРИТЬ: ссылка на канал или пост]');
    expect(placeholders).toContain('[TODO: сверить остаток баланса]');
  });

  // -----------------------------------------------------------------------
  // 3. Absolute Submission Blocker
  // -----------------------------------------------------------------------
  it('Verification 3: Hard-blocks staff submission when unedited placeholder is present', () => {
    const draft = 'Здравствуйте! [ОПЕРАТОР: ВСТАВЬТЕ ССЫЛКУ НА ДОКРУТКУ]';

    const result = OperatorVerificationGuard.validateOperatorVerification({
      text: draft,
      isStaff: true,
      isInstagramOrder: true,
      hasAiDraftUsed: true,
    });

    expect(result.canSend).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain('незаполненный блок для оператора');
  });

  // -----------------------------------------------------------------------
  // 4. Clean Submission Approval
  // -----------------------------------------------------------------------
  it('Verification 4: Approves sending after operator manually edits and removes placeholder', () => {
    const cleanedDraft =
      'Здравствуйте! Проверил ваш профиль: страница открыта. Пожалуйста, проверьте в настройках Instagram -> Подписки и подписчики -> отключите "Пометить для проверки". Сумма уже на вашем балансе.';

    const result = OperatorVerificationGuard.validateOperatorVerification({
      text: cleanedDraft,
      isStaff: true,
      isInstagramOrder: true,
      hasAiDraftUsed: true,
      checklist: {
        linkOpened: true,
        profilePublic: true,
        instagramFlagChecked: true,
        targetTypeMatched: true,
      },
    });

    expect(result.canSend).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 5. Checklist Warning Diagnostics
  // -----------------------------------------------------------------------
  it('Verification 5: Generates specific warning when Instagram flag was not verified', () => {
    const cleanedDraft = 'Здравствуйте! Заказ отменен, деньги на балансе.';

    const result = OperatorVerificationGuard.validateOperatorVerification({
      text: cleanedDraft,
      isStaff: true,
      isInstagramOrder: true,
      hasAiDraftUsed: true,
      checklist: {
        linkOpened: true,
        profilePublic: true,
        instagramFlagChecked: false, // Missed checking flag!
        targetTypeMatched: true,
      },
    });

    expect(result.canSend).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Flag for Review');
  });
});
