import { describe, it, expect } from 'vitest';
import { getVolumeTier, USER_SORT_FIELDS, type UserSortField } from '@/services/admin/user.service';

describe('Admin Clients & Financial Liability Integrity (Step 9)', () => {
  it('should correctly classify user spending into volume tiers', () => {
    // Under 1,000 RUB (100,000 cents) -> REGULAR
    expect(getVolumeTier(0).name).toBe('REGULAR');
    expect(getVolumeTier(99_999).name).toBe('REGULAR');

    // 1,000 RUB to 4,999 RUB -> BRONZE
    expect(getVolumeTier(100_000).name).toBe('BRONZE');
    expect(getVolumeTier(499_999).name).toBe('BRONZE');

    // 5,000 RUB to 24,999 RUB -> SILVER
    expect(getVolumeTier(500_000).name).toBe('SILVER');
    expect(getVolumeTier(2_499_999).name).toBe('SILVER');

    // 25,000 RUB to 99,999 RUB -> GOLD
    expect(getVolumeTier(2_500_000).name).toBe('GOLD');
    expect(getVolumeTier(9_999_999).name).toBe('GOLD');

    // 100,000 RUB and above -> PLATINUM
    expect(getVolumeTier(10_000_000).name).toBe('PLATINUM');
    expect(getVolumeTier(50_000_000).name).toBe('PLATINUM');
  });

  it('should validate allowed sort fields whitelist against parameter tampering', () => {
    // Whitelist must strictly contain all expected safe fields
    const expectedSortFields = ['createdAt', 'balance', 'totalSpent', 'orders', 'email', 'role'];
    expect(USER_SORT_FIELDS).toEqual(expectedSortFields);

    function validateSortField(rawField: string | undefined): UserSortField {
      return (rawField && USER_SORT_FIELDS.includes(rawField as UserSortField))
        ? (rawField as UserSortField)
        : 'createdAt';
    }

    // Valid fields
    expect(validateSortField('balance')).toBe('balance');
    expect(validateSortField('totalSpent')).toBe('totalSpent');
    expect(validateSortField('orders')).toBe('orders');

    // Malicious or invalid parameters fallback to createdAt
    expect(validateSortField('password')).toBe('createdAt');
    expect(validateSortField("'; DROP TABLE users; --")).toBe('createdAt');
    expect(validateSortField(undefined)).toBe('createdAt');
  });

  it('should calculate platform balance liability safely and format for display', () => {
    // Aggregation of user balances in kopecks (BigInt)
    const mockBalancesKopecks = [
      BigInt(150_000), // 1,500.00 RUB
      BigInt(450_000), // 4,500.00 RUB
      BigInt(0),       // 0.00 RUB
      BigInt(100_000), // 1,000.00 RUB
    ];

    const totalLiabilityKopecks = mockBalancesKopecks.reduce((acc, val) => acc + val, BigInt(0));
    expect(totalLiabilityKopecks).toBe(BigInt(700_000));

    const totalLiabilityRub = Math.round(Number(totalLiabilityKopecks) / 100);
    expect(totalLiabilityRub).toBe(7000);

    const formatted = totalLiabilityRub.toLocaleString('ru-RU');
    expect(formatted).toBe('7\u00A0000'); // Non-breaking space in ru-RU locale
  });

  it('should verify API filter detection logic', () => {
    type UserStub = {
      inn: string | null;
      companyName: string | null;
      apiConfig: { isApiEnabled: boolean } | null;
    };

    function isApiEnabledClient(user: UserStub): boolean {
      return Boolean(user.apiConfig?.isApiEnabled || user.inn || user.companyName);
    }

    // Normal client
    expect(isApiEnabledClient({ inn: null, companyName: null, apiConfig: null })).toBe(false);

    // API flag set
    expect(isApiEnabledClient({ inn: null, companyName: null, apiConfig: { isApiEnabled: true } })).toBe(true);

    // Has legal entity INN
    expect(isApiEnabledClient({ inn: '7701234567', companyName: null, apiConfig: null })).toBe(true);

    // Has company name
    expect(isApiEnabledClient({ inn: null, companyName: 'ООО Ромашка', apiConfig: null })).toBe(true);
  });
});
