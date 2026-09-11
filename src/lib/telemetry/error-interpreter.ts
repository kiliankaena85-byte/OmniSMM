/**
 * Human-Readable Error Translator & Incident Classifier.
 * Converts raw stack traces, database codes, and system errors
 * into clear, actionable business incidents for Telegram/Email alerts.
 * 
 * 100% deterministic, local, sub-millisecond execution (no external LLM latency).
 */

export interface InterpretedIncident {
  category: 'DATABASE' | 'PAYMENT' | 'PROVIDER' | 'NETWORK' | 'AUTH' | 'CONFIG' | 'DEV_NOISE' | 'GENERAL';
  title: string;
  whatHappened: string;
  impactOnUsers: string;
  actionPlan: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  technicalDetails?: string;
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

    // 2. YooKassa & Payment Gateway Configuration
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

    // 3. SMM Providers (VexBoost, JustAnotherPanel, etc.)
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

    // 4. Cloudflare Tunnel & Edge Network
    if (
      text.includes('502 Bad Gateway') ||
      text.includes('Cloudflare Tunnel') ||
      text.includes('tunnel connection reset')
    ) {
      return {
        category: 'NETWORK',
        title: 'Сбой сетевого туннеля Cloudflare',
        whatHappened: 'Внешний туннель Cloudflare потерял соединение с локальным портом 3000.',
        impactOnUsers: 'Сайт test.smmplan.pro временно не открывается из внешней сети.',
        actionPlan: 'Перезапустите скрипт сетевого туннеля: powershell scripts/start-tunnel.ps1.',
        severity: 'CRITICAL',
        technicalDetails: text,
      };
    }

    // 5. Development RAG / Memory Noise (Suppressed / Low Impact)
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
}
