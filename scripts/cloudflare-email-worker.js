/**
 * 📧 Cloudflare Email Routing Worker — OmniSMM 1.0 (SMMplan / SMMflux)
 * 
 * Инструкция по настройке в Cloudflare:
 * 1. Перейдите в Cloudflare Dashboard -> выберите домен (например, smmplan.pro или smmflux.ru).
 * 2. Раздел "Email Routing" -> Включите Email Routing (добавьте MX и TXT записи DNS в 1 клик).
 * 3. Раздел "Email Routing" -> "Email Workers" -> Создайте новый Worker и вставьте этот код.
 * 4. В настройках Worker -> "Variables" добавьте:
 *    - `WEBHOOK_URL`: https://smmplan.pro/api/webhooks/inbound-email (или ваш домен)
 *    - `WEBHOOK_SECRET`: ваш секретный ключ из админки (/admin/settings -> Интеграции)
 * 5. В разделе "Email Routing" -> "Routing Rules":
 *    - Создайте правило: "Catch-all" (или "Custom address" -> support@smmplan.pro, support+*@smmplan.pro)
 *    - Действие: "Send to Worker" -> выберите созданный Worker.
 */

import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    try {
      const parser = new PostalMime();
      const rawEmail = await new Response(message.raw).arrayBuffer();
      const parsed = await parser.parse(rawEmail);

      // Формируем вложения в base64
      const attachments = (parsed.attachments || []).map(att => ({
        name: att.filename || 'attachment',
        contentType: att.mimeType || 'application/octet-stream',
        content: bufferToBase64(att.content),
        size: att.content ? att.content.byteLength : 0
      }));

      // Формируем стандартизированный полезный payload
      const payload = {
        From: message.from,
        FromName: parsed.from ? parsed.from.name : undefined,
        To: message.to,
        Subject: parsed.subject || message.headers.get('subject') || 'Новое обращение по Email',
        TextBody: parsed.text || '',
        HtmlBody: parsed.html || '',
        Attachments: attachments,
        Date: message.headers.get('date') || new Date().toISOString(),
        MessageId: message.headers.get('message-id') || undefined
      };

      const webhookUrl = env.WEBHOOK_URL || 'https://smmplan.pro/api/webhooks/inbound-email';
      const webhookSecret = env.WEBHOOK_SECRET || '';

      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Timestamp': Date.now().toString()
      };

      if (webhookSecret) {
        headers['Authorization'] = `Bearer ${webhookSecret}`;
        headers['X-Webhook-Signature'] = webhookSecret;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Email Worker] Webhook delivery failed (${response.status}): ${errorText}`);
      } else {
        console.log(`[Email Worker] Email from ${message.from} successfully forwarded to ${webhookUrl}`);
      }
    } catch (err) {
      console.error('[Email Worker] Critical error processing email:', err);
    }
  }
};

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
