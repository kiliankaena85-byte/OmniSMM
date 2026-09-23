import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceAuditEngine } from '../../src/services/admin/audit-engine';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    service: {
      update: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
  },
}));

describe('ServiceAuditEngine Unit Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Text Cleaning (Sanitization)', () => {
    it('should remove competitor links and keep smmplan.pro', () => {
      const input = 'Check out http://competitor.ru and https://www.another-one.com or smmplan.pro for the best services.';
      const cleaned = ServiceAuditEngine.cleanText(input);
      expect(cleaned).not.toContain('http://competitor.ru');
      expect(cleaned).not.toContain('https://www.another-one.com');
      expect(cleaned).toContain('smmplan.pro');
    });

    it('should remove contact info like emails and telegram/vk links/usernames', () => {
      const input = 'Contact us at support@competitor.com, @competitor_tg, t.me/competitor, telegram.me/comp, or vk.com/comp.';
      const cleaned = ServiceAuditEngine.cleanText(input);
      expect(cleaned).not.toContain('support@competitor.com');
      expect(cleaned).not.toContain('@competitor_tg');
      expect(cleaned).not.toContain('t.me/competitor');
      expect(cleaned).not.toContain('telegram.me/comp');
      expect(cleaned).not.toContain('vk.com/comp');
    });

    it('should replace forbidden Cyrillic words case-insensitively', () => {
      const input = 'Качественная НАКРУТКА подписчиков. Как НАКРУТИТЬ лайки? Уже накручено 1000. Накрутки дешево.';
      const cleaned = ServiceAuditEngine.cleanText(input);
      expect(cleaned.toLowerCase()).toContain('продвижение');
      expect(cleaned.toLowerCase()).toContain('увеличить');
      expect(cleaned.toLowerCase()).toContain('активность');
      expect(cleaned.toLowerCase()).toContain('продвижения');
      expect(cleaned.toLowerCase()).not.toContain('накрутка');
      expect(cleaned.toLowerCase()).not.toContain('накрутить');
      expect(cleaned.toLowerCase()).not.toContain('накручено');
      expect(cleaned.toLowerCase()).not.toContain('накрутки');
    });
  });

  describe('auditAndFixService Markup & Price Correction', () => {
    it('should auto-correct markup and price when below MIN_MARKUP (3.0)', async () => {
      const mockService = {
        id: 'srv-1',
        name: 'Normal Service',
        description: 'No advertising here',
        markup: 1.5,
        pricePer1000Cents: 150,
        rate: 1.0,
        isActive: true,
        isQuarantined: false,
      };
      
      const mockExternal = {
        rate: '1.0',
      };

      const exchangeRate = 100.0;

      await ServiceAuditEngine.auditAndFixService(mockService as any, mockExternal, exchangeRate);

      expect(mockService.markup).toBe(3.0);
      expect(mockService.pricePer1000Cents).toBeGreaterThan(150);

      expect(db.service.update).toHaveBeenCalledWith({
        where: { id: 'srv-1' },
        data: expect.objectContaining({
          markup: 3.0,
          pricePer1000Cents: mockService.pricePer1000Cents,
        }),
      });

      expect(db.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'SERVICE_AUTO_FIX',
          target: 'srv-1',
          adminEmail: 'system@smmplan.pro',
        })
      });
    });

    it('should sanitize name and description in DB and log them if they change', async () => {
      const mockService = {
        id: 'srv-2',
        name: 'Накрутка подписчиков',
        description: 'Заказать накрутку на http://spam.ru. Писать @spam_tg',
        markup: 6.0,
        pricePer1000Cents: 60000,
        rate: 1.0,
        isActive: true,
        isQuarantined: false,
      };

      const mockExternal = {
        rate: '1.0',
      };

      await ServiceAuditEngine.auditAndFixService(mockService as any, mockExternal, 100.0);

      expect(db.service.update).toHaveBeenCalledWith({
        where: { id: 'srv-2' },
        data: expect.objectContaining({
          name: 'Продвижение подписчиков',
        }),
      });

      expect(mockService.name).toBe('Продвижение подписчиков');
      expect(mockService.description).not.toContain('http://spam.ru');
      expect(mockService.description).not.toContain('@spam_tg');

      expect(db.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'SERVICE_AUTO_FIX',
          target: 'srv-2',
          adminEmail: 'system@smmplan.pro',
        })
      });
    });

    it('should do nothing if name, description, and markup are already correct', async () => {
      const mockService = {
        id: 'srv-3',
        name: 'Продвижение подписчиков',
        description: 'Качественные услуги для вашего профиля',
        markup: 6.0,
        pricePer1000Cents: 60000,
        rate: 1.0,
        isActive: true,
        isQuarantined: false,
      };

      const mockExternal = {
        rate: '1.0',
      };

      await ServiceAuditEngine.auditAndFixService(mockService as any, mockExternal, 100.0);

      expect(db.service.update).not.toHaveBeenCalled();
      expect(db.adminAuditLog.create).not.toHaveBeenCalled();
    });
  });
});
