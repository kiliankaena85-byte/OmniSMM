import { describe, it, expect } from 'vitest';
import { AiResponseSanitizer } from '../ai-response-sanitizer';

describe('AiResponseSanitizer', () => {
  it('should strip thinking / reasoning XML blocks (<think>...</think>)', () => {
    const raw = '<think>\nUser is asking about refund.\nI need to check policy.\n</think>\nЗдравствуйте! Ваш возврат уже оформлен.';
    const cleaned = AiResponseSanitizer.sanitize(raw);
    expect(cleaned).toBe('Здравствуйте! Ваш возврат уже оформлен.');
  });

  it('should strip speaker prefixes like [Оператор]: and [Консультант]:', () => {
    const raw = '[Оператор]: Здравствуйте! Мы проверили статус вашего заказа.';
    const cleaned = AiResponseSanitizer.sanitize(raw);
    expect(cleaned).toBe('Здравствуйте! Мы проверили статус вашего заказа.');
  });

  it('should strip multiple prefixes and meta labels', () => {
    const raw = 'Черновик ответа:\n[Служба поддержки]: Добрый день! Пожалуйста, уточните ссылку на публикацию.';
    const cleaned = AiResponseSanitizer.sanitize(raw);
    expect(cleaned).toBe('Добрый день! Пожалуйста, уточните ссылку на публикацию.');
  });

  it('should strip internal security spotlighting markers', () => {
    const raw = '[UNTRUSTED_USER_INPUT]\nГде мои подписчики?\n[/UNTRUSTED_USER_INPUT]\nЗдравствуйте! Подписчики уже поступают на ваш канал.';
    const cleaned = AiResponseSanitizer.sanitize(raw);
    expect(cleaned).toBe('Где мои подписчики?\n\nЗдравствуйте! Подписчики уже поступают на ваш канал.');
  });

  it('should unwrap markdown fences if the whole response is fenced', () => {
    const raw = '```markdown\nЗдравствуйте! Средства успешно зачислены.\n```';
    const cleaned = AiResponseSanitizer.sanitize(raw);
    expect(cleaned).toBe('Здравствуйте! Средства успешно зачислены.');
  });

  it('should unwrap JSON draft_reply if entire JSON string was accidentally returned', () => {
    const raw = JSON.stringify({
      client_sentiment: 'NEUTRAL',
      internal_reasoning: 'Checking order',
      draft_reply: 'Здравствуйте! Заказ находится в обработке.'
    });
    const cleaned = AiResponseSanitizer.sanitize(raw);
    expect(cleaned).toBe('Здравствуйте! Заказ находится в обработке.');
  });
});
