/**
 * (c) 2024-2026 OmniSMM 1.0. All rights reserved.
 * Order Triage & Support Alerting Service.
 *
 * Implements RAC-2026 Zero-Defect standards:
 * 1. Deterministic classification of provider errors (Balance vs Private vs Bad Link vs Limits).
 * 2. Actionable Telegram/Support guidance for operators.
 * 3. Safe HTML escaping and tenant-aware routing.
 */

import { sendAdminAlertSync } from '@/lib/notifications';
import { ErrorInterpreter } from '@/lib/telemetry/error-interpreter';

export type OrderErrorType =
  | 'INSUFFICIENT_PROVIDER_BALANCE'
  | 'PRIVATE_ACCOUNT'
  | 'INVALID_LINK'
  | 'LIMITS_VIOLATION'
  | 'SERVICE_DISABLED'
  | 'TIMEOUT_OR_NETWORK'
  | 'PRICE_DRIFT'
  | 'GENERAL_PROVIDER_ERROR';

export interface OrderErrorClassification {
  type: OrderErrorType;
  tag: string;
  title: string;
  explanation: string;
  supportAction: string;
  isBalanceRelated: boolean;
}

export interface OrderAlertContext {
  orderId: string;
  numericId: number;
  serviceName: string;
  categoryName?: string;
  networkName?: string;
  link: string;
  quantity: number;
  chargeKopecks: number | bigint;
  userEmail?: string;
  tenantId?: string | null;
  providerName?: string;
}

export class OrderTriageAlertService {
  /**
   * Deterministically classifies an error message returned by a provider or internal system.
   */
  static classifyError(errorMessage: string | null | undefined): OrderErrorClassification {
    const raw = String(errorMessage || '').trim();
    const lower = raw.toLowerCase();

    // 1. Balance Insufficiency
    if (
      lower.includes('not enough funds') ||
      lower.includes('not enough balance') ||
      lower.includes('low balance') ||
      lower.includes('balance too low') ||
      lower.includes('insufficient balance') ||
      lower.includes('insufficient_provider_balance') ||
      lower.includes('недостаточно средств') ||
      lower.includes('нет денег') ||
      lower.includes('недостаточно денег') ||
      lower.includes('пополните баланс') ||
      lower.includes('out of balance') ||
      lower.includes('error_not_enough_funds') ||
      lower.includes('not_enough_funds') ||
      lower.includes('not_enough_balance') ||
      (lower.includes('balance') && lower.includes('error'))
    ) {
      return {
        type: 'INSUFFICIENT_PROVIDER_BALANCE',
        tag: '[INSUFFICIENT_PROVIDER_BALANCE]',
        title: '💰 Закончился баланс у поставщика',
        explanation: 'На лицевом счёте внешнего поставщика закончились средства.',
        supportAction: 'Заказ ожидает автоматического пополнения баланса поставщика. После пополнения система автоматически запустит заказ без ручных действий.',
        isBalanceRelated: true,
      };
    }

    // 2. Private Profile / Restricted Content (strictly client/target social content)
    const isNetworkOrSsrf =
      lower.includes('private ip') ||
      lower.includes('ssrf') ||
      lower.includes('private network') ||
      lower.includes('blocked url') ||
      (lower.includes('private') && (lower.includes('ip') || lower.includes('host') || lower.includes('address') || lower.includes('gateway')));

    if (
      !isNetworkOrSsrf &&
      (lower.includes('account is private') ||
        lower.includes('profile is private') ||
        lower.includes('channel is private') ||
        lower.includes('group is private') ||
        lower.includes('target is private') ||
        lower.includes('is private') ||
        lower.includes('closed profile') ||
        lower.includes('profile is closed') ||
        lower.includes('hidden') ||
        lower.includes('приватный') ||
        lower.includes('закрытый') ||
        (lower.includes('restricted') && !lower.includes('ip')) ||
        (lower.includes('private') && !lower.includes('network') && !lower.includes('ip') && !lower.includes('host')) ||
        (lower.includes('closed') && !lower.includes('connection') && !lower.includes('socket')))
    ) {
      return {
        type: 'PRIVATE_ACCOUNT',
        tag: '[PRIVATE_ACCOUNT]',
        title: '🔒 Закрытый профиль / Приватный канал',
        explanation: 'Целевой аккаунт, канал или группа закрыты настройками приватности. Поставщик не может получить доступ к объекту.',
        supportAction: '1. Проверьте ссылку. 2. Свяжитесь с клиентом через тикет или Telegram: попросите открыть профиль/канал на время накрутки. 3. После открытия нажмите «Перезапустить заказ» в панели оператора.',
        isBalanceRelated: false,
      };
    }

    // 3. Invalid Link / Format Mismatch
    if (
      lower.includes('invalid link') ||
      lower.includes('bad link') ||
      lower.includes('link is broken') ||
      lower.includes('невалидная ссылка') ||
      lower.includes('некорректная ссылка') ||
      lower.includes('link format') ||
      lower.includes('invalid url') ||
      lower.includes('not a valid link') ||
      lower.includes('wrong link') ||
      lower.includes('post not found') ||
      lower.includes('not found') ||
      lower.includes('link_service_mismatch')
    ) {
      return {
        type: 'INVALID_LINK',
        tag: '[INVALID_LINK]',
        title: '🔗 Неверная ссылка / Объект не найден',
        explanation: 'Формат ссылки не соответствует требованиям услуги, либо объект (пост, профиль, видео) удалён или недоступен.',
        supportAction: '1. Проверьте правильность формата ссылки (например, ссылка на пост вместо профиля). 2. Уточните корректную ссылку у клиента через тикет. 3. Измените ссылку или нажмите «Перезапустить заказ».',
        isBalanceRelated: false,
      };
    }

    // 4. Quantity / Limits Violation
    if (
      lower.includes('min') ||
      lower.includes('max') ||
      lower.includes('quantity') ||
      lower.includes('limit') ||
      lower.includes('минимал') ||
      lower.includes('максимал') ||
      lower.includes('exceed') ||
      lower.includes('too small') ||
      lower.includes('too large')
    ) {
      return {
        type: 'LIMITS_VIOLATION',
        tag: '[LIMITS_VIOLATION]',
        title: '📏 Несоблюдение лимитов услуги (Min/Max)',
        explanation: 'Объём заказа не соответствует допустимым границам поставщика.',
        supportAction: '1. Проверьте текущие лимиты min/max в каталоге поставщика. 2. При необходимости разбейте заказ или скорректируйте параметры.',
        isBalanceRelated: false,
      };
    }

    // 5. Service Disabled / Maintenance
    if (
      lower.includes('disabled') ||
      lower.includes('maintenance') ||
      lower.includes('inactive') ||
      lower.includes('not available') ||
      lower.includes('service down') ||
      lower.includes('отключена') ||
      lower.includes('недоступна')
    ) {
      return {
        type: 'SERVICE_DISABLED',
        tag: '[SERVICE_DISABLED]',
        title: '⛔ Услуга временно недоступна у поставщика',
        explanation: 'Услуга поставщика находится на техническом обслуживании или временно отключена на стороне провайдера.',
        supportAction: '1. Проверьте наличие альтернативных провайдеров в панели маршрутов. 2. Переключите заказ на резервного поставщика через панель оператора.',
        isBalanceRelated: false,
      };
    }

    // 6. Network Timeout & SSRF Gateway Security Blocks
    if (
      lower.includes('timeout') ||
      lower.includes('etimedout') ||
      lower.includes('econnreset') ||
      lower.includes('socket hang up') ||
      lower.includes('eai_again') ||
      lower.includes('private ip') ||
      lower.includes('ssrf') ||
      lower.includes('blocked url') ||
      lower.includes('private network')
    ) {
      const isSsrf = lower.includes('private ip') || lower.includes('ssrf') || lower.includes('blocked url') || lower.includes('private network');
      return {
        type: 'TIMEOUT_OR_NETWORK',
        tag: isSsrf ? '[GATEWAY_SSRF_BLOCKED]' : '[NETWORK_TIMEOUT]',
        title: isSsrf ? '🛡️ Сетевая блокировка шлюза (SSRF / Private IP)' : '⏱️ Сетевой таймаут / Обрыв связи',
        explanation: isSsrf
          ? 'Запрос к шлюзу поставщика заблокирован встроенным экраном безопасности SSRF (адрес шлюза разрешается в закрытый/приватный IP).'
          : 'Поставщик не ответил за отведённое время (HTTP Timeout / Network Glitch).',
        supportAction: isSsrf
          ? 'Проверьте корректность URL шлюза поставщика в админке, DNS-резолв или работу сетевого прокси-сервера Clash/Mihomo.'
          : 'Заказ находится на проверке. Убедитесь в кабинете поставщика, что заказ не был создан, после чего повторите отправку.',
        isBalanceRelated: false,
      };
    }

    // 7. Price Drift Hold
    if (lower.includes('price_drift_hold') || lower.includes('себестоимость превышает')) {
      return {
        type: 'PRICE_DRIFT',
        tag: '[PRICE_DRIFT_HOLD]',
        title: '📈 Превышение себестоимости (Price Drift Hold)',
        explanation: 'Поставщик поднял тариф или изменился курс валют, себестоимость превысила сумму оплаты клиента.',
        supportAction: 'Проверьте тарифы поставщика в админке или смените поставщика на более выгодного.',
        isBalanceRelated: false,
      };
    }

    // 8. General Provider Error
    return {
      type: 'GENERAL_PROVIDER_ERROR',
      tag: '[PROVIDER_ERROR]',
      title: '⚠️ Технический отказ поставщика',
      explanation: 'Внешний поставщик вернул ошибку при создании заказа.',
      supportAction: 'Проверьте статус API поставщика в панели администрирования или повторите попытку запуска.',
      isBalanceRelated: false,
    };
  }

  /**
   * Generates a descriptive Russian error message to store in the Order record.
   */
  static formatOrderErrorMessage(classification: OrderErrorClassification, originalError: string, providerName?: string): string {
    const pName = providerName ? ` [Поставщик: ${providerName}]` : '';
    if (classification.isBalanceRelated) {
      return `${classification.tag} Провайдер временно исчерпал баланс${pName}. Заказ ожидает автоматического пополнения баланса и запустится сразу после поступления средств. (${originalError})`;
    }
    return `${classification.tag} Ошибка поставщика${pName}: ${originalError}. ${classification.supportAction}`;
  }

  /**
   * Sends a structured support alert to the Telegram admin/support channel.
   */
  static async sendOrderCheckAlert(order: OrderAlertContext, originalError: string, providerName?: string): Promise<void> {
    const classification = this.classifyError(originalError);
    const pName = providerName || order.providerName || 'Неизвестный поставщик';

    // 1. Balance Alert
    if (classification.isBalanceRelated) {
      const balanceMsg = [
        `⚠️ <b>[ЗАКОНЧИЛСЯ БАЛАНС У ПОСТАВЩИКА]</b>`,
        `🏢 <b>Поставщик:</b> <code>${ErrorInterpreter.escapeHtml(pName)}</code>`,
        `📦 <b>Заказ:</b> <code>#${order.numericId}</code> (Услуга: ${ErrorInterpreter.escapeHtml(order.serviceName)})`,
        `🌐 <b>Соцсеть:</b> ${ErrorInterpreter.escapeHtml(order.networkName || '—')} • ${ErrorInterpreter.escapeHtml(order.categoryName || '—')}`,
        '',
        `ℹ️ <b>Статус:</b> Заказ переведён в <code>PENDING_CHECK</code> и <b>НЕ отменяется</b>.`,
        `🔄 <b>Автоопрос:</b> Как только баланс поставщика будет пополнен, система автоматически запустит заказ без участия оператора.`,
        '',
        `🛠️ <a href="https://smmplan.pro/admin/providers">Открыть управление провайдерами</a>`,
      ].join('\n');

      await sendAdminAlertSync(balanceMsg, 'WARNING', order.tenantId).catch(() => {});
      return;
    }

    // 2. Non-Balance Support Alert (Bad Link, Private Profile, Limits, etc.)
    const chargeRub = (Number(order.chargeKopecks) / 100).toFixed(2);
    const operatorLink = `https://smmplan.pro/operator/orders?search=${order.numericId}`;

    const supportMsg = [
      `🚨 <b>[ТРЕБУЕТСЯ ПРОВЕРКА ЗАКАЗА — САППОРТ]</b>`,
      `📦 <b>Заказ:</b> <code>#${order.numericId}</code> (ID: <code>${order.orderId}</code>)`,
      `👤 <b>Клиент:</b> <code>${ErrorInterpreter.escapeHtml(order.userEmail || 'Гость')}</code>`,
      `🌐 <b>Соцсеть / Категория:</b> ${ErrorInterpreter.escapeHtml(order.networkName || '—')} • ${ErrorInterpreter.escapeHtml(order.categoryName || '—')}`,
      `📌 <b>Услуга:</b> ${ErrorInterpreter.escapeHtml(order.serviceName)}`,
      `💵 <b>Сумма:</b> ${chargeRub} ₽ (Кол-во: ${order.quantity.toLocaleString('ru-RU')} шт)`,
      `🔗 <b>Ссылка в заказе:</b> <code>${ErrorInterpreter.escapeHtml(order.link)}</code>`,
      `🏢 <b>Поставщик:</b> <code>${ErrorInterpreter.escapeHtml(pName)}</code>`,
      '',
      `⚠️ <b>Причина перевода на проверку:</b>`,
      `<b>${classification.title}</b>`,
      `<i>"${ErrorInterpreter.escapeHtml(originalError)}"</i>`,
      '',
      `💡 <b>Что произошло:</b>\n${classification.explanation}`,
      '',
      `🛠️ <b>Что сделать саппорту / оператору:</b>\n${classification.supportAction}`,
      '',
      `👉 <a href="${operatorLink}">Открыть заказ в панели оператора</a>`,
    ].join('\n');

    await sendAdminAlertSync(supportMsg, 'CRITICAL', order.tenantId).catch(() => {});
  }

  /**
   * Sends an informational notification when Auto-Flush successfully launches waiting orders after balance restoration.
   */
  static async sendBalanceAutoFlushAlert(params: {
    providerName: string;
    balanceRub: number;
    flushedCount: number;
    skippedCount: number;
  }): Promise<void> {
    if (params.flushedCount <= 0) return;

    const msg = [
      `🚀 <b>[АВТО-ЗАПУСК ЗАКАЗОВ]</b> Баланс поставщика <b>${ErrorInterpreter.escapeHtml(params.providerName)}</b> пополнен!`,
      '',
      `💰 <b>Текущий баланс поставщика:</b> ${params.balanceRub.toFixed(2)} ₽`,
      `📦 <b>Автоматически запущено заказов из очереди:</b> <b>${params.flushedCount} шт.</b>`,
      params.skippedCount > 0 ? `ℹ️ <b>Осталось на ручной проверке (другие ошибки):</b> ${params.skippedCount} шт.` : '',
      '',
      `<i>Заказы успешно переведены в статус выполнения (IN_PROGRESS).</i>`,
    ].filter(Boolean).join('\n');

    await sendAdminAlertSync(msg, 'INFO', null).catch(() => {});
  }
}
