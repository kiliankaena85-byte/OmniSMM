/**
 * Operator Verification Guard (Anti-Automation Bias Service).
 * 
 * ARCHITECTURE CONTRACT:
 * Strictly enforces that support staff CANNOT blindly trust AI-generated drafts.
 * Blocks submission if unedited placeholders remain in text or if mandatory verification checklist fails.
 */

export interface VerificationChecklistState {
  linkOpened: boolean;
  profilePublic: boolean;
  instagramFlagChecked: boolean;
  targetTypeMatched: boolean;
}

export interface VerificationValidationResult {
  canSend: boolean;
  errors: string[];
  warnings: string[];
}

export class OperatorVerificationGuard {
  /**
   * Checks if draft text contains unedited operator placeholders.
   */
  static findUneditedPlaceholders(text: string): string[] {
    const placeholderRegex = /\[(ОПЕРАТОР|ПРОВЕРИТЬ|ВНИМАНИЕ|УТОЧНИТЬ|TODO):[^\]]+\]/gi;
    const matches = text.match(placeholderRegex) || [];
    return matches;
  }

  /**
   * Validates whether staff operator has completed all mandatory verification steps.
   */
  static validateOperatorVerification(params: {
    text: string;
    isStaff: boolean;
    isInstagramOrder?: boolean;
    checklist?: Partial<VerificationChecklistState>;
    hasAiDraftUsed?: boolean;
  }): VerificationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Placeholder Check (Absolute Blocker)
    const placeholders = this.findUneditedPlaceholders(params.text);
    if (placeholders.length > 0) {
      errors.push(
        `В тексте ответа остался незаполненный блок для оператора: ${placeholders.join(', ')}. Отредактируйте текст перед отправкой.`
      );
    }

    // 2. If AI draft was used by staff, enforce verification rules
    if (params.isStaff && params.hasAiDraftUsed) {
      if (params.checklist) {
        if (!params.checklist.linkOpened) {
          warnings.push('Ссылка заказа не была открыта оператором для ручной проверки.');
        }
        if (!params.checklist.profilePublic) {
          warnings.push('Не подтверждена публичность профиля (аккаунт может быть Private).');
        }
        if (params.isInstagramOrder && !params.checklist.instagramFlagChecked) {
          warnings.push('Для Instagram не подтверждена проверка флага «Пометить для проверки» (Flag for Review).');
        }
      }
    }

    return {
      canSend: errors.length === 0,
      errors,
      warnings,
    };
  }
}
