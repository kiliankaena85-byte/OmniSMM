import { describe, it, expect } from 'vitest';
import { parseActionableError } from '@/lib/errors/actionable-error';

describe('parseActionableError Root-Cause Shield Tests', () => {
  it('classifies network connection failure as ERR_NETWORK_DISCONNECTED and NOT as link error', () => {
    const errorMsg = 'Сетевая ошибка: Не удалось установить соединение с сервером провайдера. Пожалуйста, проверьте корректность URL-адреса API в настройках провайдеров или статус сети.';
    const result = parseActionableError(errorMsg);
    expect(result.code).toBe('ERR_NETWORK_DISCONNECTED');
    expect(result.category).toBe('CLIENT_DEVICE');
    expect(result.action?.type).toBe('RETRY');
    expect(result.action?.label).toBe('Повторить попытку');
  });

  it('classifies connect timeout error as ERR_NETWORK_DISCONNECTED', () => {
    const errorMsg = 'ConnectTimeoutError: Connect Timeout Error (timeout: 10000ms)';
    const result = parseActionableError(errorMsg);
    expect(result.code).toBe('ERR_NETWORK_DISCONNECTED');
    expect(result.action?.type).toBe('RETRY');
  });

  it('classifies YooKassa payment gateway error as FINANCE_GATEWAY', () => {
    const errorMsg = 'Ошибка соединения со шлюзом ЮKassa. Сервер оплаты временно недоступен — попробуйте СБП или CryptoBot.';
    const result = parseActionableError(errorMsg);
    expect(result.code).toBe('ERR_GATEWAY_CREDENTIALS_MISCONFIGURED');
    expect(result.category).toBe('FINANCE_GATEWAY');
    expect(result.action?.type).toBe('SWITCH_GATEWAY');
  });

  it('preserves full informative message for real link compatibility errors (>120 chars)', () => {
    const longLinkError = 'Услуга «🔥Telegram Подписчики» предназначена для привлечения подписчиков в канал/группу. Пожалуйста, укажите ссылку на сам канал (например, https://t.me/channel), а не на отдельную публикацию.';
    const result = parseActionableError(longLinkError);
    expect(result.code).toBe('ERR_LINK_INVALID_FORMAT');
    expect(result.category).toBe('VALIDATION');
    expect(result.message).toBe(longLinkError);
    expect(result.action?.type).toBe('FIX_LINK');
  });

  it('handles private link errors correctly', () => {
    const privateErr = 'Ссылка ведет на приватный закрытый канал (t.me/+abc)';
    const result = parseActionableError(privateErr);
    expect(result.code).toBe('ERR_PRIVATE_TARGET_INVITE_LINK');
    expect(result.category).toBe('VALIDATION');
    expect(result.action?.type).toBe('CHOOSE_ANALOG');
  });

  it('handles drip-feed floor errors correctly', () => {
    const dripErr = 'Для Drip-feed количество на один запуск (10) не может быть меньше минимального (100)';
    const result = parseActionableError(dripErr);
    expect(result.code).toBe('ERR_DRIP_FEED_FLOOR_UNDERFLOW');
    expect(result.category).toBe('VALIDATION');
  });
});
