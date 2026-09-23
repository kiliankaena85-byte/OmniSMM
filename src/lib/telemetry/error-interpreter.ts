/**
 * Human-Readable Error Translator & Incident Classifier.
 * Converts raw stack traces, database codes, and system errors
 * into clear, actionable business incidents for Telegram/Email alerts.
 * 
 * 100% deterministic, local, sub-millisecond execution (no external LLM latency).
 */

import { redactSensitiveTokens } from '@/lib/logger/sensitive-data-filter';
import { logger, getTraceId } from '@/lib/logger';
import { tenantStorage } from '@/lib/tenant-context';

export interface InterpretedIncident {
  category: 'DATABASE' | 'PAYMENT' | 'PROVIDER' | 'NETWORK' | 'AUTH' | 'CONFIG' | 'FINANCE' | 'DEV_NOISE' | 'GENERAL';
  title: string;
  whatHappened: string;
  impactOnUsers: string;
  actionPlan: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  technicalDetails?: string;
}

export interface UserFacingError {
  refCode: string; // Format: /^REF-[A-Z0-9]{4}-[A-Z0-9]{4}$/
  title: string;
  message: string;
  category: string;
  action?: {
    type: 'RETRY' | 'SWITCH_GATEWAY' | 'SUPPORT_CHAT' | 'CHOOSE_ANALOG' | 'FIX_LINK';
    label: string;
    targetGateway?: string;
    redirectUrl?: string;
  };
}

export interface ForensicReport {
  refCode: string;
  title?: string;
  traceId?: string;
  tenantId?: string;
  category: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  publicError: UserFacingError;
  sanitizedStack?: string;
  rawMessage: string;
  sanitizedRawMessage: string;
  timestamp: string;
}

export interface DualFacedResult {
  public: UserFacingError;
  forensic: ForensicReport;
}

/**
 * Generates a compact, unambiguous reference code safe for end-user display.
 * Format: REF-XXXX-YYYY (e.g., REF-DB01-8A2F, REF-PAYM-7B3K)
 */
export function generateRefCode(category: string = 'GENERAL'): string {
  const categoryPrefixMap: Record<string, string> = {
    DATABASE: 'DB01',
    PAYMENT: 'PAYM',
    PROVIDER: 'PROV',
    NETWORK: 'NETW',
    AUTH: 'AUTH',
    CONFIG: 'CONF',
    VALIDATION: 'VALD',
    DEV_NOISE: 'NOIS',
    FINANCE: 'FINC',
    GENERAL: 'SYST',
  };

  const prefix = categoryPrefixMap[category.toUpperCase()] || 'SYST';
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REF-${prefix}-${suffix}`;
}

export class DualFacedErrorSanitizer {
  /**
   * Transforms raw errors into dual-faced representations:
   * 1. Public safe user face (no internal paths, no SQL, no passwords, includes REF-XXXX-YYYY code)
   * 2. Internal forensic report (masked PII stack, full correlation context, auto-logged)
   */
  public static sanitize(
    rawError: unknown,
    context?: {
      traceId?: string;
      tenantId?: string;
      component?: string;
      defaultSeverity?: 'INFO' | 'WARNING' | 'CRITICAL';
    }
  ): DualFacedResult {
    let rawMessage = '';
    let rawStack: string | undefined = undefined;

    if (rawError instanceof Error) {
      const causeStr = rawError.cause instanceof Error
        ? rawError.cause.message
        : (typeof rawError.cause === 'string' ? rawError.cause : '');
      rawMessage = causeStr ? `${rawError.message} (Cause: ${causeStr})` : (rawError.message || String(rawError));
      rawStack = rawError.stack;
    } else if (typeof rawError === 'string') {
      rawMessage = rawError;
    } else if (rawError && typeof rawError === 'object') {
      try {
        rawMessage = JSON.stringify(rawError);
      } catch {
        rawMessage = String(rawError);
      }
    } else {
      rawMessage = 'Unknown system error';
    }

    const incident = ErrorInterpreter.interpret(rawMessage, context?.defaultSeverity || 'INFO');
    const refCode = generateRefCode(incident.category);
    const traceId = context?.traceId || getTraceId();
    const tenantId = context?.tenantId || tenantStorage.getStore()?.tenantId || 'smmplan';

    // Mask PII and secrets in internal traces
    const sanitizedRawMessage = redactSensitiveTokens(rawMessage);
    const sanitizedStack = rawStack ? redactSensitiveTokens(rawStack) : undefined;

    // Build user-facing presentation according to category
    let userTitle = 'Не удалось выполнить операцию';
    let userMessage = `Произошла системная ошибка при обработке запроса. Если ошибка повторяется, сообщите поддержке код: ${refCode}`;
    let userAction: UserFacingError['action'] = {
      type: 'RETRY',
      label: 'Повторить попытку',
    };

    switch (incident.category) {
      case 'DATABASE':
        userTitle = 'Временная задержка связи с базой данных';
        userMessage = `Сервер временно не смог выполнить запрос к базе данных. Пожалуйста, повторите попытку через минуту. Код ошибки для поддержки: ${refCode}`;
        userAction = { type: 'RETRY', label: 'Повторить попытку' };
        break;

      case 'PAYMENT':
        userTitle = 'Ошибка платежного шлюза';
        userMessage = `Платежный шлюз временно недоступен или отклонил транзакцию. Пожалуйста, выберите другой способ оплаты или обратитесь в поддержку с кодом: ${refCode}`;
        userAction = { type: 'SWITCH_GATEWAY', label: 'Выбрать другой способ' };
        break;

      case 'PROVIDER':
        userTitle = 'Тариф временно недоступен';
        userMessage = `Услуга временно приостановлена поставщиком для калибровки. Пожалуйста, выберите аналогичный тариф из каталога. Код: ${refCode}`;
        userAction = { type: 'CHOOSE_ANALOG', label: 'Выбрать другой тариф' };
        break;

      case 'NETWORK':
        userTitle = 'Ошибка сетевого соединения';
        userMessage = `Соединение с сервером прервано. Пожалуйста, проверьте подключение к интернету и повторите попытку. Код: ${refCode}`;
        userAction = { type: 'RETRY', label: 'Повторить попытку' };
        break;

      case 'AUTH':
        userTitle = 'Требуется авторизация';
        userMessage = `Срок действия сессии истек или запрос отклонен системой безопасности. Пожалуйста, войдите в систему заново. Код: ${refCode}`;
        userAction = { type: 'RETRY', label: 'Войти снова' };
        break;

      case 'FINANCE':
        userTitle = 'Операция отклонена политикой безопасности баланса';
        userMessage = `Операция отклонена системой финансовой защиты или проверкой неизменяемости баланса. Пожалуйста, обратитесь в поддержку с кодом: ${refCode}`;
        userAction = { type: 'SUPPORT_CHAT', label: 'Написать в поддержку' };
        break;

      case 'CONFIG':
        userTitle = 'Сервис временно настраивается';
        userMessage = `Некоторые функции временно обновляются администратором. Пожалуйста, повторите попытку через несколько минут. Код: ${refCode}`;
        userAction = { type: 'RETRY', label: 'Повторить попытку' };
        break;

      default:
        userTitle = 'Не удалось завершить операцию';
        userMessage = `Произошла непредвиденная системная ошибка. Пожалуйста, повторите попытку позже или обратитесь в поддержку с кодом: ${refCode}`;
        userAction = { type: 'SUPPORT_CHAT', label: 'Написать в поддержку' };
        break;
    }

    const publicError: UserFacingError = {
      refCode,
      title: userTitle,
      message: userMessage,
      category: incident.category,
      action: userAction,
    };

    const forensicReport: ForensicReport = {
      refCode,
      title: incident.title,
      traceId,
      tenantId,
      category: incident.category,
      severity: incident.severity,
      publicError,
      sanitizedStack,
      rawMessage: sanitizedRawMessage,
      sanitizedRawMessage,
      timestamp: new Date().toISOString(),
    };

    // Auto-record forensic log without exposing raw secrets to user
    logger.error(`[ForensicIncident] ${incident.title} (${refCode})`, {
      refCode,
      traceId,
      tenantId,
      component: context?.component || 'DualFacedErrorSanitizer',
      category: incident.category,
      sanitizedRawMessage,
      sanitizedStack,
    });

    return {
      public: publicError,
      forensic: forensicReport,
    };
  }
}

export class ErrorInterpreter {
  /**
   * Escape HTML special characters for Telegram HTML mode.
   */
  static escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Classify any raw error string or object into a structured incident.
   */
  static interpret(rawMessage: string, defaultSeverity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO'): InterpretedIncident {
    const text = String(rawMessage || '').trim();

    // 1. Prisma & Database Library / Connection Errors
    if (
      text.includes('libquery_engine') ||
      text.includes('PrismaClientInitializationError') ||
      text.includes('prisma.network.findMany') ||
      text.includes('libssl.so') ||
      text.includes('ECONNREFUSED 5432') ||
      text.includes("Can't reach database server")
    ) {
      return {
        category: 'DATABASE',
        title: 'Сбой подключения к базе данных (PostgreSQL/Prisma)',
        whatHappened: 'Веб-сервер временно не может выполнить запросы к базе данных из-за ошибки драйвера или соединения.',
        impactOnUsers: 'Посетители сайта временно не видят каталог услуг и не могут оформить заказ.',
        actionPlan: 'Проверьте состояние контейнеров: `docker ps` и перезапустите веб-сервер при необходимости.',
        severity: 'CRITICAL',
        technicalDetails: text,
      };
    }

    // 2. Concurrency & ACID Integrity (Finance / Ledger)
    if (
      text.includes('LedgerEntry') ||
      text.includes('immutability') ||
      text.toLowerCase().includes('balance negative') ||
      text.toLowerCase().includes('negative balance') ||
      text.includes('ExactMath') ||
      text.includes('CONCURRENCY_CONFLICT') ||
      text.toLowerCase().includes('deadlock detected') ||
      text.includes('NegativeBalanceError')
    ) {
      return {
        category: 'FINANCE',
        title: 'Нарушение финансовой целостности / Concurrency Conflict',
        whatHappened: 'Операция изменения баланса или проводки по леджеру заблокирована защитой целостности (ACID / ExactMath).',
        impactOnUsers: 'Финансовая операция отклонена для предотвращения потери или порчи средств.',
        actionPlan: 'Проверьте журнал admin_audit_log, параметры транзакции и баланс пользователя.',
        severity: 'CRITICAL',
        technicalDetails: text,
      };
    }

    // 3. YooKassa & Payment Gateway Configuration
    if (text.includes('MISCONFIGURED_WEBHOOK_SECRET') && text.toLowerCase().includes('yookassa')) {
      return {
        category: 'CONFIG',
        title: 'Требуется настройка вебхука ЮKassa',
        whatHappened: 'ЮKassa прислала подтверждение платежа, но в настройках сервера не указан секретный ключ вебхука.',
        impactOnUsers: 'Деньги с карты клиента списались, но автоматическое зачисление баланса ожидает настройки.',
        actionPlan: 'Укажите YOOKASSA_WEBHOOK_SECRET в панели управления или файле конфигурации .env.',
        severity: 'WARNING',
        technicalDetails: text,
      };
    }

    if (text.includes('Yookassa') || text.includes('yookassa') || text.includes('Robokassa') || text.includes('robokassa')) {
      if (text.includes('SIGNATURE_FAILED') || text.includes('HMAC mismatch')) {
        return {
          category: 'PAYMENT',
          title: 'Неверная цифровая подпись платежного вебхука',
          whatHappened: 'Платежный шлюз прислал уведомление, но цифровая подпись не совпала с секретным ключом.',
          impactOnUsers: 'Зачисление платежа заблокировано системой безопасности для предотвращения мошенничества.',
          actionPlan: 'Проверьте совпадение секретного ключа в личном кабинете платежной системы и в SMMpanel.',
          severity: 'CRITICAL',
          technicalDetails: text,
        };
      }
    }

    // 4. SMM Providers (VexBoost, JustAnotherPanel, etc.)
    if (
      text.includes('Insufficient balance') ||
      text.includes('Not enough funds') ||
      text.includes('code 402') ||
      text.includes('balance is low')
    ) {
      return {
        category: 'PROVIDER',
        title: 'Закончился баланс у поставщика услуг',
        whatHappened: 'На лицевом счете у внешнего провайдера накрутки закончились средства.',
        impactOnUsers: 'Новые заказы клиентов ставятся в очередь, но временно не запускаются в работу.',
        actionPlan: 'Пополните баланс в кабинете провайдера накрутки.',
        severity: 'WARNING',
        technicalDetails: text,
      };
    }

    if (text.includes('Sync провайдера') || text.includes('Provider sync failed')) {
      return {
        category: 'PROVIDER',
        title: 'Временный сбой синхронизации с провайдером',
        whatHappened: 'Сервер не смог обновить статус заказов или каталог услуг через API поставщика.',
        impactOnUsers: 'Минимальное влияние. Повторная попытка будет выполнена автоматически фоновым воркером.',
        actionPlan: 'Если ошибка повторяется более 10 минут, проверьте доступность сайта поставщика.',
        severity: 'WARNING',
        technicalDetails: text,
      };
    }

    // 5. Tailscale Funnel / Edge Network Proxy
    if (
      text.includes('502 Bad Gateway') ||
      text.includes('Tailscale') ||
      text.includes('Cloudflare Tunnel') ||
      text.includes('tunnel connection reset')
    ) {
      return {
        category: 'NETWORK',
        title: 'Сбой сетевого туннеля / прокси test.smmplan.pro',
        whatHappened: 'Внешний туннель или прозрачный прокси потерял соединение с локальным портом 3000 платформы.',
        impactOnUsers: 'Сайт test.smmplan.pro временно не открывается из внешней сети.',
        actionPlan: 'Перезапустите скрипт прокси: powershell scripts/start-test-proxy.ps1 или проверьте статус Tailscale.',
        severity: 'CRITICAL',
        technicalDetails: text,
      };
    }

    // 6. Auth & Security Invariants
    if (
      text.includes('Session token expired') ||
      text.includes('Invalid session') ||
      text.toLowerCase().includes('unauthorized') ||
      text.toLowerCase().includes('forbidden') ||
      text.includes('CSRF') ||
      text.includes('SSRF') ||
      text.toLowerCase().includes('access denied') ||
      text.toLowerCase().includes('jwt expired') ||
      text.toLowerCase().includes('jwt malformed') ||
      text.includes('bruteforce')
    ) {
      return {
        category: 'AUTH',
        title: 'Сбой авторизации или отклонение запроса безопасности',
        whatHappened: 'Запрос отклонен системой контроля доступа (истекла сессия, неверный токен или сработал защитный барьер).',
        impactOnUsers: 'Действие заблокировано. Пользователю необходимо войти в систему заново.',
        actionPlan: 'Проверьте журнал авторизации и статус сессии пользователя.',
        severity: text.includes('SSRF') || text.includes('bruteforce') ? 'CRITICAL' : 'WARNING',
        technicalDetails: text,
      };
    }

    // 7. BullMQ & Queue Exhaustion
    if (
      text.includes('exhausted all') ||
      text.includes('UnrecoverableError') ||
      text.toLowerCase().includes('dead-letter') ||
      text.toLowerCase().includes('dead letter') ||
      text.includes('Job stalled')
    ) {
      return {
        category: 'GENERAL',
        title: 'Сбой фоновой обработки в очереди BullMQ',
        whatHappened: 'Фоновая задача исчерпала все попытки выполнения и направлена в очередь недоставленных сообщений (DLQ).',
        impactOnUsers: 'Заказ или операция поставлена в безопасную очередь для повторной обработки.',
        actionPlan: 'Откройте Dead Letter Queue в панели управления и проверьте причину сбоя.',
        severity: 'WARNING',
        technicalDetails: text,
      };
    }

    // 8. Development RAG / Memory Noise (Suppressed / Low Impact)
    if (text.includes('heracleum_rag_memory') || text.includes('rag-embeddings') || text.includes('8100/api/search')) {
      return {
        category: 'DEV_NOISE',
        title: 'Сервис локальной RAG-памяти разработки',
        whatHappened: 'Вспомогательный Docker-контейнер памяти AI-ассистентов перезагружается в фоне.',
        impactOnUsers: 'Нулевое влияние. На работу клиентов, заказы и платежи это никак не влияет.',
        actionPlan: 'Никаких действий не требуется.',
        severity: 'INFO',
        technicalDetails: text,
      };
    }

    // 6. Generic Fallback
    const emojiMap: Record<string, string> = {
      CRITICAL: '🚨 Критический системный инцидент',
      WARNING: '⚠️ Предупреждение платформы',
      INFO: 'ℹ️ Системное уведомление',
    };

    return {
      category: 'GENERAL',
      title: emojiMap[defaultSeverity] || 'Системное событие',
      whatHappened: text.length > 200 ? `${text.slice(0, 200)}...` : text,
      impactOnUsers: defaultSeverity === 'CRITICAL' ? 'Возможны временные задержки при обработке запросов.' : 'Работа пользователей продолжается в штатном режиме.',
      actionPlan: defaultSeverity === 'CRITICAL' ? 'Проверьте логи веб-сервера через панель управления.' : 'Автоматический мониторинг отслеживает стабильность.',
      severity: defaultSeverity,
      technicalDetails: text.length > 200 ? text : undefined,
    };
  }

  /**
   * Formats the incident into a beautiful Telegram HTML card with clear Tenant / Core Engine identification.
   */
  static formatTelegramMessage(
    rawMessage: string,
    defaultSeverity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO',
    tenantId?: string | null
  ): string {
    const incident = this.interpret(rawMessage, defaultSeverity);
    const moscowTime = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

    const severityIcon: Record<string, string> = {
      CRITICAL: '🚨',
      WARNING: '⚠️',
      INFO: 'ℹ️',
    };

    const icon = severityIcon[incident.severity] || 'ℹ️';

    // Resolve which Tenant or Core Engine caused the alert
    let tenantLabel = 'OmniSMM 1.0 (Core Engine / Глобально)';
    const lowerRaw = rawMessage.toLowerCase();

    if (tenantId) {
      const norm = tenantId.toLowerCase().trim();
      if (norm === 'flux' || norm === 'smmflux') {
        tenantLabel = 'SMMflux (smmflux.ru)';
      } else if (norm === 'smmplan') {
        tenantLabel = 'SMMplan (smmplan.pro)';
      } else {
        tenantLabel = `${tenantId}`;
      }
    } else if (lowerRaw.includes('smmflux') || lowerRaw.includes('tenant=flux') || lowerRaw.includes('tenant=smmflux')) {
      tenantLabel = 'SMMflux (smmflux.ru)';
    } else if (lowerRaw.includes('smmplan.pro') || lowerRaw.includes('tenant=smmplan')) {
      tenantLabel = 'SMMplan (smmplan.pro)';
    }

    const lines: string[] = [
      `${icon} <b>[${incident.severity}] ${this.escapeHtml(incident.title)}</b>`,
      `🌐 <b>Локация:</b> <code>${this.escapeHtml(tenantLabel)}</code>`,
      '',
      `📌 <b>Что произошло:</b>\n${this.escapeHtml(incident.whatHappened)}`,
      '',
      `👥 <b>Влияние на клиентов:</b>\n${this.escapeHtml(incident.impactOnUsers)}`,
      '',
      `🛠️ <b>Что сделать:</b>\n${this.escapeHtml(incident.actionPlan)}`,
    ];

    if (incident.technicalDetails) {
      const truncatedTech = incident.technicalDetails.length > 400
        ? `${incident.technicalDetails.slice(0, 400)}...`
        : incident.technicalDetails;
      lines.push('', `🔍 <b>Технические детали:</b>\n<pre>${this.escapeHtml(truncatedTech)}</pre>`);
    }

    lines.push('', `<i>Фиксация: ${moscowTime}</i>`);

    return lines.join('\n');
  }

  /**
   * Facade for dual-faced sanitization: public user presentation vs private forensic report.
   */
  static sanitizeDualFaced(
    rawError: unknown,
    context?: {
      traceId?: string;
      tenantId?: string;
      component?: string;
      defaultSeverity?: 'INFO' | 'WARNING' | 'CRITICAL';
    }
  ): DualFacedResult {
    return DualFacedErrorSanitizer.sanitize(rawError, context);
  }
}
