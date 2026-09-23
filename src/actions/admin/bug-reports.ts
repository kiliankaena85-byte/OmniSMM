'use server';

import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { auditAdmin } from '@/lib/admin-audit';

export interface BugReportPayload {
  title: string;
  description: string;
  priority: 'CRITICAL' | 'NORMAL' | 'LOW';
  url: string;
  tenantId: string;
  role: string;
  viewport: string;
  userAgent: string;
  checkoutMode?: string;
  consoleLogs?: string[];
  screenshot?: string; // Base64 data URL
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sends bug report and screenshot directly to admin Telegram chat
 */
async function sendBugReportToTelegram(payload: BugReportPayload) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!botToken || !adminChatId) return;

    const safeTitle = escapeHtml(payload.title);
    const safeUrl = escapeHtml(payload.url);
    const safeTenant = escapeHtml(payload.tenantId.toUpperCase());
    const safeRole = escapeHtml(payload.role);
    const safeViewport = escapeHtml(payload.viewport);
    const safeDescription = escapeHtml(payload.description.slice(0, 700));

    const caption = `🚨 <b>НОВЫЙ БАГ-РЕПОРТ С ТЕСТОВОГО СТЕНДА!</b>\n\n` +
      `<b>📌 Заголовок:</b> ${safeTitle}\n` +
      `<b>Приоритет:</b> ${payload.priority === 'CRITICAL' ? '🔴 КРИТИЧЕСКИЙ' : payload.priority === 'NORMAL' ? '🟡 СРЕДНИЙ' : '🟢 МИНОРНЫЙ'}\n` +
      `<b>🌐 URL:</b> <code>${safeUrl}</code>\n` +
      `<b>🏢 Бренд:</b> <code>${safeTenant}</code>\n` +
      `<b>👤 Роль:</b> ${safeRole}\n` +
      `<b>📱 Экран:</b> ${safeViewport}\n\n` +
      `<b>📝 Описание:</b>\n${safeDescription}`;

    if (payload.screenshot && payload.screenshot.startsWith('data:image/')) {
      const base64Data = payload.screenshot.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const formData = new FormData();
      formData.append('chat_id', adminChatId);
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
      const blob = new Blob([buffer], { type: 'image/png' });
      formData.append('photo', blob, 'screenshot.png');

      await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
    } else {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: caption,
          parse_mode: 'HTML',
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
    }
  } catch (err) {
    console.error('[BugReport] Failed to send Telegram alert:', err);
  }
}

export async function submitBugReportAction(payload: BugReportPayload) {
  try {
    const session = await verifySession();
    const userId = session?.userId ?? null;
    const user = userId ? await db.user.findUnique({ where: { id: userId }, select: { email: true } }) : null;

    const formattedContent = `
### Баг-репорт: ${payload.title}
**Приоритет:** ${payload.priority}
**URL страницы:** ${payload.url}
**Бренд (Тенант):** ${payload.tenantId}
**Роль пользователя:** ${payload.role} (User ID: ${userId || 'Аноним'})
**Разрешение экрана:** ${payload.viewport}
**Режим чекаута:** ${payload.checkoutMode || 'Не указан'}
**User-Agent:** ${payload.userAgent}
**Скриншот:** ${payload.screenshot ? 'Прикреплен' : 'Отсутствует'}

#### Описание проблемы:
${payload.description}

${payload.consoleLogs && payload.consoleLogs.length > 0 ? `#### Ошибки консоли JS:\n\`\`\`\n${payload.consoleLogs.join('\n')}\n\`\`\`` : ''}
    `.trim();

    // 1. Audit Admin log in PostgreSQL
    if (userId) {
      auditAdmin({
        adminId: userId,
        adminEmail: user?.email || 'unknown@smmplan.pro',
        action: 'BUG_REPORT',
        target: payload.url,
        targetType: 'BugReport',
        newValue: { title: payload.title, priority: payload.priority, url: payload.url, hasScreenshot: Boolean(payload.screenshot) },
      });
    }

    // 2. Direct Telegram Alert to Admin
    sendBugReportToTelegram(payload).catch(() => null);

    // 3. Sync to GraphRAG Memory if reachable
    try {
      await fetch('http://localhost:8100/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[BUG] ${payload.title}`,
          content: formattedContent,
          category: 'incidents',
        }),
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      // audit-ignore: non-blocking background sync if GraphRAG container is offline
    }

    return {
      success: true,
      message: 'Баг-репорт со скриншотом сохранен и отправлен администратору в Telegram!',
      markdown: formattedContent,
    };
  } catch (error) {
    console.error('Failed to submit bug report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Не удалось сохранить баг-репорт',
    };
  }
}
