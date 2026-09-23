import { describe, it, expect } from 'vitest';
import { globalSettingsSchema } from '../admin.validators';

describe('globalSettingsSchema legal company details validation', () => {
  it('should accept valid 10-digit INN and 13-digit OGRN', () => {
    const result = globalSettingsSchema.safeParse({
      legalCompanyInn: '7707083893', // Sberbank valid INN
      legalCompanyOgrnip: '1027700132195', // Sberbank valid OGRN
    });

    expect(result.success).toBe(true);
  });

  it('should accept valid 12-digit INN and 15-digit OGRN', () => {
    const result = globalSettingsSchema.safeParse({
      legalCompanyInn: '500100732259', // Mathematically valid 12-digit INN
      legalCompanyOgrnip: '319508100137571', // Mathematically valid 15-digit OGRNIP
    });

    expect(result.success).toBe(true);
  });

  it('should reject invalid 10-digit INN due to bad checksum', () => {
    const result = globalSettingsSchema.safeParse({
      legalCompanyInn: '7707083894', // Invalid checksum (ends with 4 instead of 3)
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('legalCompanyInn'));
      expect(issue?.message).toBe('Некорректная контрольная сумма ИНН');
    }
  });

  it('should reject invalid 12-digit INN due to bad checksum', () => {
    const result = globalSettingsSchema.safeParse({
      legalCompanyInn: '500100732258', // Invalid checksum (ends with 8 instead of 9)
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('legalCompanyInn'));
      expect(issue?.message).toBe('Некорректная контрольная сумма ИНН');
    }
  });

  it('should reject invalid 13-digit OGRN due to bad checksum', () => {
    const result = globalSettingsSchema.safeParse({
      legalCompanyOgrnip: '1027700132196', // Invalid checksum
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('legalCompanyOgrnip'));
      expect(issue?.message).toBe('Некорректная контрольная сумма ОГРН/ОГРНИП');
    }
  });

  it('should reject invalid 15-digit OGRN due to bad checksum', () => {
    const result = globalSettingsSchema.safeParse({
      legalCompanyOgrnip: '319508100137575', // Invalid checksum
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('legalCompanyOgrnip'));
      expect(issue?.message).toBe('Некорректная контрольная сумма ОГРН/ОГРНИП');
    }
  });

  it('should allow empty values or null values', () => {
    const result = globalSettingsSchema.safeParse({
      legalCompanyInn: '',
      legalCompanyOgrnip: null,
    });

    expect(result.success).toBe(true);
  });
});
