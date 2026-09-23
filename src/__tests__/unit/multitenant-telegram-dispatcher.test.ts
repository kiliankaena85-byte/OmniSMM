import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { VaultService } from '@/lib/vault';
import { resolveTelegramToken, isValidTelegramToken } from '@/lib/telegram/token-resolver';
import { multiBotManager } from '@/bot/manager/multi-bot-manager';

describe('Multi-Tenant Telegram Bot Dispatcher (Phase 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token & Identity Resolution', () => {
    it('validates standard Telegram Bot API token formats', () => {
      expect(isValidTelegramToken('123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_12345678')).toBe(true);
      expect(isValidTelegramToken('dummy_token')).toBe(false);
      expect(isValidTelegramToken('your_token_here')).toBe(false);
      expect(isValidTelegramToken('')).toBe(false);
      expect(isValidTelegramToken(null)).toBe(false);
    });

    it('prioritizes active TelegramBotInstance over SystemSettings', async () => {
      const validBotToken = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_12345678';
      const encryptedToken = VaultService.encrypt(validBotToken);

      // Mock TelegramBotInstance hit
      vi.spyOn(db.telegramBotInstance, 'findFirst').mockResolvedValue({
        id: 'bot_alpha_1',
        tenantId: 'alpha-brand',
        tokenEncrypted: encryptedToken,
        isActive: true,
      } as any);

      const sysSettingsSpy = vi.spyOn(db.systemSettings, 'findUnique');

      const token = await resolveTelegramToken('alpha-brand');
      expect(token).toBe(validBotToken);
      // findFirst was called on telegramBotInstance
      expect(db.telegramBotInstance.findFirst).toHaveBeenCalled();
    });

    it('falls back to SystemSettings if no active TelegramBotInstance is found', async () => {
      const validSysToken = '987654321:XYZdefGHIjklMNOpqrSTUvwxYZ_98765432';
      const encryptedSysToken = VaultService.encrypt(validSysToken);

      // Mock TelegramBotInstance miss
      vi.spyOn(db.telegramBotInstance, 'findFirst').mockResolvedValue(null);

      // Mock SystemSettings hit
      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'beta-brand',
        telegramBotToken: encryptedSysToken,
      } as any);

      const token = await resolveTelegramToken('beta-brand');
      expect(token).toBe(validSysToken);
    });
  });

  describe('MultiBotManager Webhook Dispatcher', () => {
    it('provides handleWebhookUpdate method that resolves tenant bot and handles update', async () => {
      const validToken = '111222333:ABCdefGHIjklMNOpqrSTUvwxYZ_11122233';
      const encrypted = VaultService.encrypt(validToken);

      vi.spyOn(db.telegramBotInstance, 'findFirst').mockResolvedValue({
        id: 'bot_gamma_1',
        tenantId: 'gamma-brand',
        name: 'Gamma Bot',
        tokenEncrypted: encrypted,
        role: 'STORE_FULL',
        isActive: true,
        maintenanceMode: false,
      } as any);

      const dummyUpdate = { update_id: 10001, message: { text: '/start', chat: { id: 12345 } } };

      const mockBotInstance = {
        handleUpdate: vi.fn().mockResolvedValue(undefined),
        telegram: {
          deleteWebhook: vi.fn().mockResolvedValue(true),
          sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
        },
        use: vi.fn(),
        stop: vi.fn(),
      };

      vi.spyOn(multiBotManager, 'getBotForTenant').mockResolvedValue(mockBotInstance as any);

      const result = await multiBotManager.handleWebhookUpdate('gamma-brand', dummyUpdate);
      expect(result.success).toBe(true);
      expect(mockBotInstance.handleUpdate).toHaveBeenCalledWith(dummyUpdate);
    });

    it('fails gracefully when no bot or token is configured for tenant', async () => {
      vi.spyOn(multiBotManager, 'getBotForTenant').mockResolvedValue(null);

      const result = await multiBotManager.handleWebhookUpdate('unconfigured-brand', { update_id: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('не настроен');
    });

    it('sends outbound notification via tenant bot', async () => {
      const mockBotInstance = {
        telegram: {
          sendMessage: vi.fn().mockResolvedValue({ message_id: 42 }),
        },
      };

      vi.spyOn(multiBotManager, 'getBotForTenant').mockResolvedValue(mockBotInstance as any);

      const sent = await multiBotManager.sendTenantMessage('gamma-brand', '123456789', 'Тестовое уведомление');
      expect(sent).toBe(true);
      expect(mockBotInstance.telegram.sendMessage).toHaveBeenCalledWith(
        '123456789',
        'Тестовое уведомление',
        expect.any(Object)
      );
    });
  });

  describe('Multi-Tenant Webhook Request Security & Routing', () => {
    it('rejects unauthorized request missing secret token with 401', async () => {
      const { handleTelegramWebhookRequest } = await import('@/app/api/webhooks/telegram/_lib/webhook-handler');

      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'secure-brand',
        telegramWebhookSecret: VaultService.encrypt('my-super-secret-token'),
        telegramMaintenanceMode: false,
      } as any);

      const req = new Request('http://localhost:3000/api/webhooks/telegram/secure-brand', {
        method: 'POST',
        headers: {},
        body: JSON.stringify({ update_id: 1 }),
      });

      const res = await handleTelegramWebhookRequest(req as any, 'secure-brand');
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('rejects unauthorized request with secret token mismatch with 401', async () => {
      const { handleTelegramWebhookRequest } = await import('@/app/api/webhooks/telegram/_lib/webhook-handler');

      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'secure-brand',
        telegramWebhookSecret: VaultService.encrypt('my-super-secret-token'),
        telegramMaintenanceMode: false,
      } as any);

      const req = new Request('http://localhost:3000/api/webhooks/telegram/secure-brand', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'wrong-token-sent-by-attacker',
        },
        body: JSON.stringify({ update_id: 1 }),
      });

      const res = await handleTelegramWebhookRequest(req as any, 'secure-brand');
      expect(res.status).toBe(401);
    });

    it('returns 503 if tenant is in maintenance mode', async () => {
      const { handleTelegramWebhookRequest } = await import('@/app/api/webhooks/telegram/_lib/webhook-handler');

      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'maint-brand',
        telegramWebhookSecret: VaultService.encrypt('secret-123'),
        telegramMaintenanceMode: true,
      } as any);

      const req = new Request('http://localhost:3000/api/webhooks/telegram/maint-brand', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'secret-123',
        },
        body: JSON.stringify({ update_id: 1 }),
      });

      const res = await handleTelegramWebhookRequest(req as any, 'maint-brand');
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe('Maintenance mode');
    });

    it('rejects request with 403 if client IP is not in configured allowlist', async () => {
      const { handleTelegramWebhookRequest } = await import('@/app/api/webhooks/telegram/_lib/webhook-handler');

      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'ip-guarded-brand',
        telegramWebhookSecret: VaultService.encrypt('secret-123'),
        telegramAllowedIps: JSON.stringify(['91.108.4.1', '91.108.4.2']),
        telegramMaintenanceMode: false,
      } as any);

      const req = new Request('http://localhost:3000/api/webhooks/telegram/ip-guarded-brand', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'secret-123',
          'x-forwarded-for': '198.51.100.25', // Not in allowlist
        },
        body: JSON.stringify({ update_id: 1 }),
      });

      const res = await handleTelegramWebhookRequest(req as any, 'ip-guarded-brand');
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden IP');
    });

    it('accepts and dispatches valid webhook request with 200 OK', async () => {
      const { handleTelegramWebhookRequest } = await import('@/app/api/webhooks/telegram/_lib/webhook-handler');

      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'good-brand',
        telegramWebhookSecret: VaultService.encrypt('secret-123'),
        telegramMaintenanceMode: false,
      } as any);

      vi.spyOn(multiBotManager, 'handleWebhookUpdate').mockResolvedValue({ success: true });

      const dummyUpdate = { update_id: 42, message: { text: '/start' } };
      const req = new Request('http://localhost:3000/api/webhooks/telegram/good-brand', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'secret-123',
        },
        body: JSON.stringify(dummyUpdate),
      });

      const res = await handleTelegramWebhookRequest(req as any, 'good-brand');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(multiBotManager.handleWebhookUpdate).toHaveBeenCalledWith('good-brand', dummyUpdate);
    });
  });
});
