import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepInfrastructureClient } from '@/services/providers/deep-infrastructure-client';

describe('DeepInfrastructureClient (Tier-0 SMM Deep Underworld Infrastructure)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. HeroSMS / SMSHub Protocol (Virtual Numbers Engine)', () => {
    it('should successfully parse ACCESS_NUMBER response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ACCESS_NUMBER:98765432:79998887766'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await DeepInfrastructureClient.orderSmsNumber({
        apiUrl: 'https://hero-sms.com/stubs/handler_api.php',
        apiKey: 'test_sms_key',
        service: 'tg',
      });

      expect(result.id).toBe('98765432');
      expect(result.phone).toBe('79998887766');
      expect(result.status).toBe('WAIT_CODE');

      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(calledUrl.searchParams.get('action')).toBe('getNumber');
      expect(calledUrl.searchParams.get('service')).toBe('tg');
    });

    it('should throw an error on NO_NUMBERS pool exhaustion', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('NO_NUMBERS'),
        })
      );

      await expect(
        DeepInfrastructureClient.orderSmsNumber({
          apiUrl: 'https://smshub.org/stubs/handler_api.php',
          apiKey: 'test_sms_key',
          service: 'tg',
        })
      ).rejects.toThrow('NO_NUMBERS');
    });

    it('should throw an error on NO_BALANCE', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('NO_BALANCE'),
        })
      );

      await expect(
        DeepInfrastructureClient.orderSmsNumber({
          apiUrl: 'https://hero-sms.com/stubs/handler_api.php',
          apiKey: 'test_sms_key',
          service: 'tg',
        })
      ).rejects.toThrow('NO_BALANCE');
    });

    it('should check status and return received code', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('STATUS_OK:445566'),
        })
      );

      const status = await DeepInfrastructureClient.checkSmsCode({
        apiUrl: 'https://hero-sms.com/stubs/handler_api.php',
        apiKey: 'test_sms_key',
        activationId: '98765432',
      });

      expect(status.status).toBe('RECEIVED');
      expect(status.code).toBe('445566');
    });
  });

  describe('2. Fragment Smart Contract Direct Gateway (Stars & Premium)', () => {
    it('should execute direct Stars order with idempotency key', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            orderId: 'frag_tx_998877',
            totalCostTon: 0.75,
            status: 'CONFIRMED',
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await DeepInfrastructureClient.orderFragmentStars({
        apiUrl: 'https://api.fragmentapi.com/v1/stars/buy',
        apiKey: 'frag_secret_token',
        username: '@durov',
        starsCount: 100,
        idempotencyKey: 'idem_key_123',
      });

      expect(res.success).toBe(true);
      expect(res.username).toBe('durov');
      expect(res.starsCount).toBe(100);
      expect(res.orderId).toBe('frag_tx_998877');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Idempotency-Key']).toBe('idem_key_123');
    });

    it('should reject invalid star quantities or empty username', async () => {
      await expect(
        DeepInfrastructureClient.orderFragmentStars({
          apiUrl: 'https://api.fragmentapi.com/v1/stars/buy',
          apiKey: 'frag_secret_token',
          username: '',
          starsCount: 100,
          idempotencyKey: 'idem_key_123',
        })
      ).rejects.toThrow('Указан пустой username');

      await expect(
        DeepInfrastructureClient.orderFragmentStars({
          apiUrl: 'https://api.fragmentapi.com/v1/stars/buy',
          apiKey: 'frag_secret_token',
          username: 'durov',
          starsCount: -5,
          idempotencyKey: 'idem_key_123',
        })
      ).rejects.toThrow('Недопустимое количество звезд');
    });
  });

  describe('3. LiveSurf REST API (P2P Organic Traffic)', () => {
    it('should create behavioral view campaign', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              taskId: 'ls_camp_5544',
            }),
        })
      );

      const res = await DeepInfrastructureClient.createLiveSurfTask({
        apiUrl: 'https://api.livesurf.ru/v1/campaigns',
        apiKey: 'ls_api_token',
        payload: {
          url: 'https://youtube.com/watch?v=sample123',
          viewsLimit: 500,
          durationSeconds: 120,
        },
      });

      expect(res.success).toBe(true);
      expect(res.taskId).toBe('ls_camp_5544');
      expect(res.viewsAllocated).toBe(500);
    });
  });

  describe('4. Zelenka Market API (Telegram Sessions & TData Vault)', () => {
    it('should query available session+json pools', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              total: 1420,
              minPrice: 18.5,
              items: [
                {
                  id: 102938,
                  title: 'Telegram Session + JSON | 30 days aged | Clean',
                  price: 18.5,
                  format: 'session+json',
                },
              ],
            }),
        })
      );

      const res = await DeepInfrastructureClient.queryMarketTelegramSessions({
        apiUrl: 'https://api.zelenka.guru/market',
        apiKey: 'lzt_api_token',
        minAgeDays: 30,
      });

      expect(res.availableCount).toBe(1420);
      expect(res.minPriceRub).toBe(18.5);
      expect(res.sampleItem?.format).toBe('session+json');
    });
  });

  describe('5. SSRF Security Guard', () => {
    it('should reject local loopback or private network calls', async () => {
      await expect(
        DeepInfrastructureClient.orderSmsNumber({
          apiUrl: 'http://127.0.0.1:8080/stubs/handler_api.php',
          apiKey: 'key',
          service: 'tg',
        })
      ).rejects.toThrow();

      await expect(
        DeepInfrastructureClient.orderFragmentStars({
          apiUrl: 'http://192.168.1.1/api',
          apiKey: 'key',
          username: 'test',
          starsCount: 50,
          idempotencyKey: 'k',
        })
      ).rejects.toThrow();
    });
  });
});
