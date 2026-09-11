import type { Context } from 'telegraf';
interface TelegramIncomingMessage {
  message_id?: number;
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string; file_size?: number }>;
  document?: { file_id: string; file_size?: number; mime_type?: string };
  voice?: { file_id: string; file_size?: number };
  reply_to_message?: { message_id?: number };
}

interface TelegramIncomingContext {
  message?: TelegramIncomingMessage;
  reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  react?: (reaction: unknown) => Promise<unknown>;
  telegram: {
    getFileLink: (fileId: string) => Promise<URL | string>;
  };
}

import { db } from '@/lib/db';
import { ticketService } from '@/services/support/ticket.service';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

class SupportBotService {
  private readonly UPLOAD_DIR_BASE = path.join(process.cwd(), 'private', 'uploads', 'tickets');

  constructor() {
    try {
      if (!fs.existsSync(this.UPLOAD_DIR_BASE)) {
        fs.mkdirSync(this.UPLOAD_DIR_BASE, { recursive: true });
      }
    } catch (err) {
      logger.warn('Could not create upload directory on init', { err });
    }
  }

  /**
   * INBOUND: Handle messages from Telegram Bot and save to Database
   */
    async handleIncomingMessage(ctx: Context, userId: string) {
    let text = '';
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    const msg = (ctx.message as unknown as TelegramIncomingMessage) || {};

    // 1. Text
    if (msg.text) {
      text = msg.text;
    }

    // Find or Create Active Ticket FIRST, because we need ticketId for media storage
    const subject = msg.text?.substring(0, 50) || msg.caption?.substring(0, 50) || 'Медиа сообщение';
    const ticket = await ticketService.getOrCreateTicket(userId, subject, 'TELEGRAM');

    // 2. Photo
    if (msg.photo && msg.photo.length > 0) {
      text = msg.caption || '';
      mediaType = 'image';
      const photo = msg.photo[msg.photo.length - 1];
      mediaUrl = await this.downloadTelegramFile(ctx, photo.file_id, 'jpg', ticket.id, photo.file_size);
      if (!mediaUrl) return; 
    }

    // 3. Document
    if (msg.document) {
      text = msg.caption || '';
      mediaType = 'document';
      const doc = msg.document;
      
      let ext = 'file';
      if (doc.mime_type === 'image/png') ext = 'png';
      else if (doc.mime_type === 'image/jpeg') ext = 'jpg';
      else if (doc.mime_type === 'application/pdf') ext = 'pdf';
      
      mediaUrl = await this.downloadTelegramFile(ctx, doc.file_id, ext, ticket.id, doc.file_size);
      if (!mediaUrl) return;
    }

    // 4. Voice
    if (msg.voice) {
      text = '🎤 Голосовое сообщение';
      mediaType = 'audio';
      mediaUrl = await this.downloadTelegramFile(ctx, msg.voice.file_id, 'ogg', ticket.id, msg.voice.file_size);
      if (!mediaUrl) return;
    }

    if (!text && !mediaUrl) {
      return ctx.reply('⚠️ Пустое сообщение. Пожалуйста, отправьте текст или файл.');
    }

    // 5. Detect Replies (Swipe to reply in Telegram)
    let replyToId: string | null = null;
    if (msg.reply_to_message?.message_id) {
      const originalTgMsgId = String(msg.reply_to_message.message_id);
      // Find internal message by telegramMsgId
      const originalMsg = await db.ticketMessage.findFirst({
        where: { telegramMsgId: originalTgMsgId }
      });
      if (originalMsg) {
        replyToId = originalMsg.id;
      }
    }

    // 7. Save Message to DB & Update Ticket Status via ticketService
    await ticketService.addMessage(
      ticket.id,
      'USER',
      text,
      mediaUrl || undefined,
      mediaType || undefined,
      replyToId || undefined,
      msg.message_id ? String(msg.message_id) : undefined
    );

    // 9. Client-Centric Reaction/Ack
    // If this is the FIRST message in this specific ticket from the user, or ticket just created
    const userMessageCount = await db.ticketMessage.count({
      where: { ticketId: ticket.id, sender: 'USER' }
    });

    if (userMessageCount <= 1) {
      await (ctx.reply as Function)('✅ Ваше сообщение передано в поддержку. Ожидайте ответа.', msg.message_id ? { reply_to_message_id: msg.message_id } : undefined).catch(() => {});
    } else {
      // For subsequent messages, just react to avoid spam
      try {
        if (ctx.react) await ctx.react('👨‍💻');
      } catch {
        // Ignored. Not all chats support reactions.
      }
    }
  }

  /**
   * Resolve Telegram Bot Token with dynamic .env fallback if running process lacked it on start.
   */
  private getBotToken(): string {
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'dummy_token') {
      return process.env.TELEGRAM_BOT_TOKEN;
    }
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        // audit-ignore: .env is a small static configuration file (< 5KB)
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('TELEGRAM_BOT_TOKEN=')) {
            let val = trimmed.slice('TELEGRAM_BOT_TOKEN='.length).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (val && val !== 'dummy_token') {
              process.env.TELEGRAM_BOT_TOKEN = val;
              return val;
            }
          }
        }
      }
    } catch { /* ignore */ }
    return '';
  }

  /**
   * Low-level Telegram Bot API call via native fetch.
   * Works reliably in both Next.js Server Actions and standalone bot process contexts.
   */
  private async tgCall(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: { message_id: number } }> {
    const token = this.getBotToken();
    if (!token || token === 'dummy_token') {
      logger.warn(`[SupportBot] tgCall ${method} skipped: TELEGRAM_BOT_TOKEN not set`);
      throw new Error('TELEGRAM_BOT_TOKEN not set');
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3500),
    });
    const json = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!json.ok) {
      logger.error(`[SupportBot] Telegram API [${method}] Error`, { description: json.description });
      throw new Error(`Telegram API [${method}]: ${json.description ?? 'unknown error'}`);
    }
    return json;
  }

  /**
   * OUTBOUND: Send reply from Admin panel to Telegram
   * Uses native fetch → works reliably in Next.js Server Action context.
   */
  async sendSupportReply(telegramId: string, text: string, replyToTgMsgId?: string, mediaUrl?: string, mediaType?: string): Promise<string | null> {
    const token = this.getBotToken();
    if (!token || token === 'dummy_token') {
      logger.warn('[SupportBot] sendSupportReply skipped: TELEGRAM_BOT_TOKEN not set');
      return null;
    }
    logger.info('[SupportBot] sendSupportReply', { chat: telegramId, text: text.slice(0, 40) });
    try {
      const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeText = escapeHtml(text);
      const caption = safeText;
      const plainCaption = text;

      const baseParams: Record<string, unknown> = { chat_id: telegramId, parse_mode: 'HTML' };
      if (replyToTgMsgId) baseParams.reply_to_message_id = Number(replyToTgMsgId);

      let messageId: number | null = null;

      if (mediaUrl) {
        // For file uploads still use bot.telegram (needs multipart form-data)
        try {
          const absolutePath = path.join(process.cwd(), 'private', 'uploads', mediaUrl);
          const source = fs.existsSync(absolutePath) ? { source: absolutePath } : mediaUrl;
          const { bot } = await import('@/bot');
                    const extra: Record<string, unknown> = { ...baseParams, caption };
          let msg;
          if (mediaType === 'image') msg = await bot.telegram.sendPhoto(telegramId, source, extra);
          else if (mediaType === 'audio') msg = await bot.telegram.sendAudio(telegramId, source, extra);
          else msg = await bot.telegram.sendDocument(telegramId, source, extra);
          messageId = msg?.message_id ?? null;
        } catch (mediaErr: unknown) {
          const errMsg = mediaErr instanceof Error ? mediaErr.message : String(mediaErr);
          logger.warn('[SupportBot] Media send failed, fallback text', { error: errMsg });
          const res = await this.tgCall('sendMessage', { chat_id: telegramId, text: plainCaption });
          messageId = res.result?.message_id ?? null;
        }
      } else {
        // Text-only via fetch — guaranteed Next.js Server Action compatibility
        try {
          const res = await this.tgCall('sendMessage', { ...baseParams, text: caption });
          messageId = res.result?.message_id ?? null;
        } catch (htmlErr: unknown) {
          const errMsg = htmlErr instanceof Error ? htmlErr.message : String(htmlErr);
          logger.warn('[SupportBot] HTML send failed, retrying plain', { error: errMsg });
          const res = await this.tgCall('sendMessage', { chat_id: telegramId, text: plainCaption });
          messageId = res.result?.message_id ?? null;
        }
      }

      logger.info('[SupportBot] sendSupportReply OK', { messageId });
      return messageId ? String(messageId) : null;
        } catch (e: unknown) {
      const err = e as Error;
      logger.error('[SupportBot] Failed to send to telegram', { error: err.message });
      if (err.message?.includes('message to reply not found') && replyToTgMsgId) {
        return this.sendSupportReply(telegramId, text, undefined, mediaUrl, mediaType);
      }
      return null;
    }
  }

  /**
   * EDIT: Admin edits message in Admin panel -> sync to Telegram
   */
  async editSupportReply(telegramId: string, telegramMsgId: string, newText: string): Promise<boolean> {
    try {
      const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      await this.tgCall('editMessageText', {
        chat_id: telegramId,
        message_id: Number(telegramMsgId),
        text: `${escapeHtml(newText)}\n\n<i>(изменено)</i>`,
        parse_mode: 'HTML',
      });
      return true;
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[SupportBot] Failed to edit telegram message:', err.message);
      if (err.message.includes('message is not modified')) return true; // It's fine
      throw err;
    }
  }

  /**
   * DELETE: Admin deletes message in Admin panel -> sync to Telegram
   */
  async deleteSupportReply(telegramId: string, telegramMsgId: string): Promise<boolean> {
    try {
      await this.tgCall('deleteMessage', {
        chat_id: telegramId,
        message_id: Number(telegramMsgId),
      });
      return true;
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[SupportBot] Failed to delete telegram message:', err.message);
      throw err;
    }
  }

  /**
   * CSAT: Send interactive rating buttons when ticket is closed
   */
  async sendTicketClosedRating(telegramId: string, ticketId: string): Promise<string | null> {
    try {
      let ratingText = '✅ <b>Ваш вопрос решён и тикет #{ticketId} закрыт.</b>\n\nПожалуйста, оцените качество работы службы поддержки:';
      try {
        const { BotSettingsService } = await import('@/bot/services/bot-settings.service');
        const templates = await BotSettingsService.getTemplates('smmplan');
        if (templates?.ticketClosedRating) {
          ratingText = templates.ticketClosedRating;
        }
      } catch { /* use default */ }

      ratingText = ratingText.replace(/{ticketId}/g, ticketId.slice(-6).toUpperCase());

      const res = await this.tgCall('sendMessage', {
        chat_id: telegramId,
        text: ratingText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⭐ 1', callback_data: `rate:${ticketId}:1` },
              { text: '⭐ 2', callback_data: `rate:${ticketId}:2` },
              { text: '⭐ 3', callback_data: `rate:${ticketId}:3` },
              { text: '⭐ 4', callback_data: `rate:${ticketId}:4` },
              { text: '⭐ 5', callback_data: `rate:${ticketId}:5` },
            ]
          ]
        }
      });
      return res.result ? String(res.result.message_id) : null;
    } catch (e) {
      console.error('[SupportBot] Failed to send CSAT rating:', e);
      return null;
    }
  }

  // --- Helper ---
    private async downloadTelegramFile(ctx: Context, fileId: string, ext: string, ticketId: string, fileSize?: number): Promise<string | null> {
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB (Reduced from 20MB for safety)
    if (fileSize && fileSize > MAX_SIZE) {
      await ctx.reply('⚠️ Файл слишком большой (макс. 10 МБ). Загрузите его на файлообменник и отправьте ссылку.');
      return null;
    }
    
    // Anti-Flood: Check if user uploaded too many files in last 24h
    try {
       const userRecentMediaCount = await db.ticketMessage.count({
          where: { 
            ticketId, 
            mediaUrl: { not: null },
            createdAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) } 
          }
       });
       if (userRecentMediaCount > 15) {
          await ctx.reply('⚠️ Прием медиафайлов временно ограничен (сработал антиспам). Опишите проблему текстом.');
          return null;
       }
    } catch (err) { logger.warn('[SupportBot] Notification failed', { error: err }); }

    try {
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const response = await fetch(fileLink.toString(), {
        signal: AbortSignal.timeout(15000), // Детерминированный таймаут 15с на скачивание файла
      });
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = `tg_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      
      const ticketDir = path.join(this.UPLOAD_DIR_BASE, ticketId);
      if (!fs.existsSync(ticketDir)) {
         fs.mkdirSync(ticketDir, { recursive: true });
      }
      
      const filePath = path.join(ticketDir, fileName);
      fs.writeFileSync(filePath, buffer);
      
      // Store relative path exactly as the API expects
      return `tickets/${ticketId}/${fileName}`;
    } catch (e) {
      logger.error('[SupportBot] File download error', { error: e });
      await ctx.reply('❌ Ошибка при скачивании файла сервером.');
      return null;
    }
  }
}

export const supportBotService = new SupportBotService();
