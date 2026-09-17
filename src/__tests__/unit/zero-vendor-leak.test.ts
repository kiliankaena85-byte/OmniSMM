import { describe, it, expect } from 'vitest';
import { getCustomerFacingOrderError } from '@/utils/order-customer-error';

describe('Zero Vendor Leak & Error Sanitization Gate (RAC-2026 / CWE-209)', () => {
  it('strictly returns null for orders in PENDING_CHECK, PENDING, or PROVISIONING', () => {
    const rawError = '[GATEWAY_SSRF_BLOCKED] Ошибка поставщика [Поставщик: Vexboost]: Private IP blocked. Проверьте корректность URL шлюза поставщика в админке, DNS-резолв или работу сетевого прокси-сервера Clash/Mihomo.';
    
    expect(getCustomerFacingOrderError('PENDING_CHECK', rawError)).toBeNull();
    expect(getCustomerFacingOrderError('PENDING', rawError)).toBeNull();
    expect(getCustomerFacingOrderError('PROVISIONING', rawError)).toBeNull();
  });

  it('completely strips vendor name, tags, and internal network instructions from ERROR orders', () => {
    const rawErrors = [
      '[GATEWAY_SSRF_BLOCKED] Ошибка поставщика [Поставщик: Vexboost]: Private IP blocked. Проверьте корректность URL шлюза поставщика в админке, DNS-резолв или работу сетевого прокси-сервера Clash/Mihomo.',
      '[INSUFFICIENT_PROVIDER_BALANCE] Провайдер временно исчерпал баланс [Поставщик: Soc-Rocket]. Заказ ожидает автоматического пополнения баланса и запустится сразу после поступления средств. (insufficient balance)',
      '[PRICE_DRIFT_HOLD] Превышение себестоимости: себестоимость превышает сумму оплаты клиента. [Поставщик: Likedrom]',
      '[NETWORK_TIMEOUT] Ошибка поставщика [Поставщик: SmmPrime]: socket hang up. Повторите попытку в панели оператора.',
    ];

    const forbiddenWords = [
      'vexboost',
      'soc-rocket',
      'likedrom',
      'smmprime',
      'поставщик',
      'провайдер',
      'clash',
      'mihomo',
      'ssrf',
      'админк',
      'dns-резолв',
      'панели оператора',
      'себестоимость',
    ];

    for (const raw of rawErrors) {
      const sanitized = getCustomerFacingOrderError('ERROR', raw);
      expect(sanitized).not.toBeNull();
      const lower = sanitized!.toLowerCase();

      for (const word of forbiddenWords) {
        expect(lower).not.toContain(word);
      }
    }
  });

  it('translates genuine user actionable issues into clean friendly messages', () => {
    // Private account / channel
    const privError = 'Target account is private. Cannot fulfill order.';
    const privResult = getCustomerFacingOrderError('ERROR', privError);
    expect(privResult).toContain('закрыт');

    // Invalid link
    const linkError = 'Invalid link format for instagram post';
    const linkResult = getCustomerFacingOrderError('ERROR', linkError);
    expect(linkResult).toContain('ссылк');

    // Deleted / Not found
    const notFoundError = 'Post not found or deleted (404)';
    const notFoundResult = getCustomerFacingOrderError('ERROR', notFoundError);
    expect(notFoundResult).toContain('не найден');
  });

  it('handles null, undefined, or empty error strings safely', () => {
    expect(getCustomerFacingOrderError('ERROR', null)).toBeNull();
    expect(getCustomerFacingOrderError('ERROR', undefined)).toBeNull();
    expect(getCustomerFacingOrderError('ERROR', '')).toBeNull();
  });
});
