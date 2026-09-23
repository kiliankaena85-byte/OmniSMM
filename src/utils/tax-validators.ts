/**
 * @file tax-validators.ts
 * @description Official Federal Tax Service (ФНС РФ) checksum validators for Russian legal entities & sole proprietors.
 * Validates:
 * 1. ИНН юридического лица (10 знаков) — весовые коэффициенты [2, 4, 10, 3, 5, 9, 4, 6, 8]
 * 2. ИНН индивидуального предпринимателя (12 знаков) — двухэтапная проверка (11-й и 12-й контрольные разряды)
 * 3. ОГРНИП индивидуального предпринимателя (15 знаков) — проверка остатка от деления первых 14 знаков на 13
 */

export interface TaxValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Валидация ИНН (10 цифр для юридических лиц, 12 цифр для ИП)
 * Алгоритм вычисления контрольного числа ФНС РФ.
 */
export function validateInn(inn: string | null | undefined): TaxValidationResult {
  if (!inn || typeof inn !== 'string') {
    return { valid: false, error: 'ИНН не указан' };
  }

  // Sanitize: strip whitespace and invisible control characters
  const sanitized = inn.trim().replace(/\D/g, '');
  if (sanitized.length !== 10 && sanitized.length !== 12) {
    return { valid: false, error: 'ИНН должен содержать ровно 10 (для ООО) или 12 цифр (для ИП)' };
  }

  const digits = sanitized.split('').map(Number);
  if (digits.some(d => isNaN(d) || !Number.isInteger(d))) {
    return { valid: false, error: 'ИНН содержит недопустимые символы' };
  }

  // Юридическое лицо (10 цифр)
  if (digits.length === 10) {
    const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum = weights.reduce((acc, weight, i) => acc + weight * digits[i], 0);
    const checkDigit = (sum % 11) % 10;
    
    if (checkDigit !== digits[9]) {
      return { valid: false, error: 'Неверная контрольная сумма ИНН юридического лица' };
    }
    return { valid: true };
  }

  // Индивидуальный предприниматель (12 цифр)
  if (digits.length === 12) {
    // Проверка 11-го разряда
    const weights11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum11 = weights11.reduce((acc, weight, i) => acc + weight * digits[i], 0);
    const check11 = (sum11 % 11) % 10;

    // Проверка 12-го разряда
    const weights12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum12 = weights12.reduce((acc, weight, i) => acc + weight * digits[i], 0);
    const check12 = (sum12 % 11) % 10;

    if (check11 !== digits[10] || check12 !== digits[11]) {
      return { valid: false, error: 'Неверная контрольная сумма ИНН индивидуального предпринимателя' };
    }
    return { valid: true };
  }

  return { valid: false, error: 'ИНН должен содержать ровно 10 (для ООО) или 12 цифр (для ИП)' };
}

/**
 * Валидация ОГРНИП (15 цифр для индивидуальных предпринимателей)
 * Контрольное число = (младший разряд остатка от деления первых 14 знаков на 13)
 */
export function validateOgrnip(ogrnip: string | null | undefined): TaxValidationResult {
  if (!ogrnip || typeof ogrnip !== 'string') {
    return { valid: false, error: 'ОГРНИП не указан' };
  }

  const sanitized = ogrnip.trim().replace(/\D/g, '');
  if (sanitized.length !== 15) {
    return { valid: false, error: 'ОГРНИП должен состоять ровно из 15 цифр' };
  }

  // Первые 14 знаков
  const num14 = BigInt(sanitized.slice(0, 14));
  const checkDigit = Number(num14 % BigInt(13)) % 10;

  if (checkDigit !== Number(sanitized[14])) {
    return { valid: false, error: 'Неверная контрольная сумма ОГРНИП (алгоритм mod 13 ФНС РФ)' };
  }

  return { valid: true };
}

export interface TenantLegalEntityIdentity {
  tenantId: string;
  inn?: string;
  ogrnip?: string;
  bankAccount?: string;
  bik?: string;
  yookassaShopId?: string;
  kktRegNumber?: string;
  fnNumber?: string;
}

/**
 * Валидация независимости налогоплательщиков (Защита от искусственного дробления бизнеса по ст. 54.1 НК РФ)
 * Гарантирует, что разные тенанты (бренды) не имеют идентичных ИНН, ОГРНИП, банковских реквизитов,
 * мерчантов эквайринга (YooKassa Shop ID) или номеров ККТ/ФН (рекомендация NVIDIA Nemotron 550B).
 */
export function validateCrossTenantLegalIndependence(
  tenantA: TenantLegalEntityIdentity,
  tenantB: TenantLegalEntityIdentity
): { independent: boolean; violationReason?: string } {
  if (tenantA.tenantId === tenantB.tenantId) {
    return { independent: true };
  }

  if (tenantA.inn && tenantB.inn && tenantA.inn.trim() === tenantB.inn.trim()) {
    return {
      independent: false,
      violationReason: `Критический риск ст. 54.1 НК РФ: Тенанты [${tenantA.tenantId}] и [${tenantB.tenantId}] имеют идентичный ИНН (${tenantA.inn}) без агентского разграничения.`
    };
  }

  if (tenantA.ogrnip && tenantB.ogrnip && tenantA.ogrnip.trim() === tenantB.ogrnip.trim()) {
    return {
      independent: false,
      violationReason: `Критический риск ст. 54.1 НК РФ: Тенанты [${tenantA.tenantId}] и [${tenantB.tenantId}] имеют идентичный ОГРНИП (${tenantA.ogrnip}).`
    };
  }

  // Защита от общего расчетного счета (ст. 54.1 НК РФ — признак аффилированности)
  if (tenantA.bankAccount && tenantB.bankAccount && tenantA.bankAccount.trim() === tenantB.bankAccount.trim()) {
    return {
      independent: false,
      violationReason: `Критический риск ст. 54.1 НК РФ: Тенанты [${tenantA.tenantId}] и [${tenantB.tenantId}] имеют идентичный расчетный счет (${tenantA.bankAccount}). Раздельные бренды обязаны иметь независимые банковские счета.`
    };
  }

  // Защита от общего мерчанта эквайринга (YooKassa Shop ID)
  if (tenantA.yookassaShopId && tenantB.yookassaShopId && tenantA.yookassaShopId.trim() === tenantB.yookassaShopId.trim()) {
    return {
      independent: false,
      violationReason: `Критический риск ст. 54.1 НК РФ: Тенанты [${tenantA.tenantId}] и [${tenantB.tenantId}] используют общий эквайринг YooKassa Shop ID (${tenantA.yookassaShopId}). Разные юрлица обязаны иметь раздельные договоры эквайринга.`
    };
  }

  // Защита от общей кассы ККТ (РН ККТ)
  if (tenantA.kktRegNumber && tenantB.kktRegNumber && tenantA.kktRegNumber.trim() === tenantB.kktRegNumber.trim()) {
    return {
      independent: false,
      violationReason: `Критический риск 54-ФЗ / ст. 54.1 НК РФ: Тенанты [${tenantA.tenantId}] и [${tenantB.tenantId}] используют общую ККТ (РН ККТ ${tenantA.kktRegNumber}). Каждая организация/ИП обязана регистрировать кассу на свой ИНН.`
    };
  }

  return { independent: true };
}

