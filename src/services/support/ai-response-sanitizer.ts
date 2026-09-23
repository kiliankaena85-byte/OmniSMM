/**
 * AiResponseSanitizer — Strict Fail-Closed Sanitizer for AI-Generated Support Responses.
 *
 * Strips all internal reasoning, technical markers, speaker prefixes,
 * markdown wraps, and system leakages before the draft is presented to the operator or sent to the client.
 */

export class AiResponseSanitizer {
  /**
   * Sanitizes raw AI output to produce clean, customer-facing text.
   */
  static sanitize(raw: string | undefined | null): string {
    if (!raw || typeof raw !== 'string') return '';

    let text = raw;

    // 1. Strip reasoning / thinking XML tags (e.g. <think>...</think> from reasoning models)
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    text = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    text = text.replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, '');
    text = text.replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, '');

    // 2. Strip JSON fences or markdown codeblock wrappers
    text = text.replace(/^```(?:markdown|text|json)?\s*\n?([\s\S]*?)\n?```$/gi, '$1');

    // 3. Strip internal security spotlighting markers & RAG tags
    text = text.replace(/\[\/?UNTRUSTED_USER_INPUT\]/gi, '');
    text = text.replace(/\[\/?SYSTEM_DATA\]/gi, '');
    text = text.replace(/\[\/?GROUNDED_KNOWLEDGE(?:_START|_END)?\]/gi, '');
    text = text.replace(/\[\/?INTERNAL_NOTE\]/gi, '');
    text = text.replace(/\[\/?RAW_INPUT\]/gi, '');

    // 4. Strip role / speaker prefixes (e.g. "[Оператор]:", "Оператор поддержки:", "AI:", "Черновик ответа:")
    const prefixRegex = /^(?:\[?(?:Оператор|Консультант|Ассистент|Поддержка|Менеджер|Служба заботы|Служба поддержки|AI|Bot|Gemini|Система|Staff|Agent|Assistant)\]?:\s*)+/gim;
    text = text.replace(prefixRegex, '');

    const metaLabelRegex = /^(?:(?:Черновик ответа|Ответ клиенту|Готовый ответ|Предлагаемый ответ|Рекомендуемый ответ|Вариант ответа|Текст ответа|Ответ):\s*)+/gim;
    text = text.replace(metaLabelRegex, '');

    // 5. Handle accidental JSON string leakage
    const trimmed = text.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('{\n') && trimmed.endsWith('\n}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.draft_reply === 'string') {
          text = parsed.draft_reply;
        } else if (parsed && typeof parsed.message === 'string') {
          text = parsed.message;
        }
      } catch {
        // keep as is
      }
    }

    // 6. Clean multiple consecutive newlines / leading trailing whitespace
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text;
  }
}
