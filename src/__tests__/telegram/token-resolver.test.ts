import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isPlaceholderToken,
  isValidTelegramToken,
  cleanTelegramUsername,
  cleanTelegramChannel,
  resolveTelegramToken,
} from '@/lib/telegram/token-resolver';
import { db } from '@/lib/db';
import { VaultService } from '@/lib/vault';

vi.mock('@/lib/db', () => ({
  db: {
    systemSettings: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/vault', () => ({
  VaultService: {
    decrypt: vi.fn((val: string) => val.replace('enc_', '')),
  },
}));

describe('Telegram Token & Identity Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  describe('isPlaceholderToken', () => {
    it('detects dummy placeholders', () => {
      expect(isPlaceholderToken(undefined)).toBe(true);
      expect(isPlaceholderToken(null)).toBe(true);
      expect(isPlaceholderToken('')).toBe(true);
      expect(isPlaceholderToken('dummy_token')).toBe(true);
      expect(isPlaceholderToken('YOUR_TELEGRAM_BOT_TOKEN_HERE')).toBe(true);
      expect(isPlaceholderToken('your_bot_token')).toBe(true);
      expect(isPlaceholderToken('••••••••••••••••')).toBe(true);
      expect(isPlaceholderToken('short')).toBe(true);
    });

    it('allows non-placeholder strings of sufficient length', () => {
      expect(isPlaceholderToken('123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_12345678')).toBe(false);
    });
  });

  describe('isValidTelegramToken', () => {
    it('validates official bot token format', () => {
      expect(isValidTelegramToken('123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_12345678')).toBe(true);
      expect(isValidTelegramToken('7123456789:AAGhjk-_1234567890abcdef123456789012')).toBe(true);
    });

    it('rejects invalid or placeholder tokens', () => {
      expect(isValidTelegramToken('YOUR_TELEGRAM_BOT_TOKEN_HERE')).toBe(false);
      expect(isValidTelegramToken('dummy_token')).toBe(false);
      expect(isValidTelegramToken('12345:short')).toBe(false);
      expect(isValidTelegramToken('not_a_token')).toBe(false);
      expect(isValidTelegramToken('123456789:abc')).toBe(false);
    });
  });

  describe('cleanTelegramUsername & cleanTelegramChannel', () => {
    it('strips leading @ and trims', () => {
      expect(cleanTelegramUsername('@SMMplansapport_bot')).toBe('SMMplansapport_bot');
      expect(cleanTelegramUsername('@@@bot_name ')).toBe('bot_name');
      expect(cleanTelegramUsername('clean_bot')).toBe('clean_bot');
      expect(cleanTelegramUsername('')).toBe('');

      expect(cleanTelegramChannel('@smmplan_news')).toBe('smmplan_news');
      expect(cleanTelegramChannel('smmplan_news')).toBe('smmplan_news');
    });
  });

  describe('resolveTelegramToken', () => {
    it('returns decrypted token from database when present and valid', async () => {
      const validToken = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_12345678';
      (db.systemSettings.findUnique as any).mockResolvedValue({
        telegramBotToken: `enc_${validToken}`,
      });

      const token = await resolveTelegramToken('smmplan');
      expect(token).toBe(validToken);
    });

    it('falls back to environment variable for smmplan if DB token is absent', async () => {
      const validToken = '987654321:ABCdefGHIjklMNOpqrSTUvwxYZ_12345678';
      (db.systemSettings.findUnique as any).mockResolvedValue(null);
      process.env.TELEGRAM_BOT_TOKEN = validToken;

      const token = await resolveTelegramToken('smmplan');
      expect(token).toBe(validToken);
    });

    it('does NOT fallback to environment variable if env contains placeholder', async () => {
      (db.systemSettings.findUnique as any).mockResolvedValue(null);
      process.env.TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN_HERE';

      const token = await resolveTelegramToken('smmplan');
      expect(token).toBeNull();
    });

    it('does NOT use smmplan env token for another tenant like flux', async () => {
      const validToken = '987654321:ABCdefGHIjklMNOpqrSTUvwxYZ_12345678';
      (db.systemSettings.findUnique as any).mockResolvedValue(null);
      process.env.TELEGRAM_BOT_TOKEN = validToken;

      const token = await resolveTelegramToken('flux');
      expect(token).toBeNull();
    });
  });
});
