import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { bot } from '@/bot';
import fs from 'fs';
import path from 'path';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    ticketMessage: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    ticket: {
      findFirst: vi.fn(),
      create: vi.fn(),
    }
  }
}));

vi.mock('@/bot', () => ({
  bot: {
    telegram: {
      getFileLink: vi.fn(),
      sendMessage: vi.fn(),
    }
  }
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
}));

// We must dynamically import the service AFTER mocks are set up
const getService = async () => {
  const mod = await import('../support-bot.service');
  return mod.supportBotService;
};

describe('SupportBotService', () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = await getService();
    // Default fetch mock
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
    });
  });

  describe('downloadTelegramFile', () => {
    const mockCtx = {
      reply: vi.fn(),
      telegram: {
        getFileLink: vi.fn().mockResolvedValue(new URL('https://api.telegram.org/file/bot123/doc.pdf'))
      }
    };

    it('should reject files larger than 10MB', async () => {
      const result = await service['downloadTelegramFile'](mockCtx, 'file123', 'pdf', 'ticket-1', 15 * 1024 * 1024);
      expect(result).toBeNull();
      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Файл слишком большой'));
    });

    it('should reject file if user sent more than 15 files in 24h (Anti-Spam)', async () => {
      vi.mocked(db.ticketMessage.count).mockResolvedValueOnce(16);
      
      const result = await service['downloadTelegramFile'](mockCtx, 'file123', 'jpg', 'ticket-1', 1024);
      
      expect(result).toBeNull();
      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Прием медиафайлов временно ограничен'));
    });

    it('should successfully download and save file within limits', async () => {
      vi.mocked(db.ticketMessage.count).mockResolvedValueOnce(5); // under limit
      
      const result = await service['downloadTelegramFile'](mockCtx, 'file123', 'png', 'ticket-1', 1024);
      
      expect(result).not.toBeNull();
      expect(result).toMatch(/^tickets\/ticket-1\/tg_.*\.png$/);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });
});
