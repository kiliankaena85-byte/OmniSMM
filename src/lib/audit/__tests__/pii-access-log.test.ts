import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { logPiiAccess, maskEmail, maskPhone, maskInn, maskAddress } from '../pii-access-log';

describe('PREM-06: PII Access Logging & Masking', () => {
  const testStaffId = 'staff_test_pii_123';
  const testStaffEmail = 'staff_auditor@smmplan.local';

  beforeEach(async () => {
    await db.piiAccessLog.deleteMany({ where: { staffId: testStaffId } });
  });

  afterEach(async () => {
    await db.piiAccessLog.deleteMany({ where: { staffId: testStaffId } });
  });

  describe('PII Masking Utilities', () => {
    it('masks email correctly', () => {
      expect(maskEmail('alexander@domain.com')).toBe('a***r@domain.com');
      expect(maskEmail('ed@domain.com')).toBe('e***@domain.com');
      expect(maskEmail('')).toBe('');
      expect(maskEmail(null)).toBe('');
    });

    it('masks phone numbers correctly', () => {
      const masked = maskPhone('+79991234567');
      expect(masked).toContain('***');
      expect(masked.endsWith('67')).toBe(true);
    });

    it('masks Russian INN correctly', () => {
      expect(maskInn('7701123456')).toBe('7701****56');
      expect(maskInn('')).toBe('');
    });

    it('masks addresses correctly', () => {
      expect(maskAddress('г. Москва, ул. Тверская 12, кв 45')).toBe('г. Москва, ул. ***');
    });
  });

  describe('logPiiAccess', () => {
    it('creates PII access log in database', async () => {
      await logPiiAccess({
        staffId: testStaffId,
        staffEmail: testStaffEmail,
        action: 'view-client-profile',
        targetId: 'client_target_999',
        targetType: 'client',
        fields: ['email', 'phone', 'inn'],
        ip: '198.51.100.99',
        userAgent: 'Staff Admin Console',
      });

      const logs = await db.piiAccessLog.findMany({
        where: { staffId: testStaffId },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('view-client-profile');
      expect(logs[0].targetId).toBe('client_target_999');
      expect(logs[0].targetType).toBe('client');
      expect(logs[0].fields).toEqual(['email', 'phone', 'inn']);
      expect(logs[0].ip).toBe('198.51.100.99');
    });
  });
});
