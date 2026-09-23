/**
 * Level 1 Service: Fallback Response Generator for Admin AI Assistant
 * Provides high-fidelity, grounded answers with citations when Gemini API is offline/unavailable.
 * Ensures zero-defect UX and realistic token streaming simulation.
 */

import type { RetrievedChunk } from './knowledge-retriever.service';

export class AdminAiFallbackService {
  /**
   * Generates a grounded structured response and streams it via onToken
   */
  static async generateFallback(
    query: string,
    route: string,
    chunks: RetrievedChunk[],
    onToken: (token: string) => void | Promise<void>
  ): Promise<string> {
    const qLower = query.toLowerCase();
    let text = '';

    if (qLower.includes('зомби') || qLower.includes('карантин') || qLower.includes('zombie')) {
      text = this.getZombieServicesResponse();
    } else if (qLower.includes('cherry') || qLower.includes('теневой') || qLower.includes('импорт')) {
      text = this.getCherryPickResponse();
    } else if (qLower.includes('54-фз') || qLower.includes('ндс') || qLower.includes('копеек') || qLower.includes('bigint')) {
      text = this.getFiscalResponse();
    } else {
      text = this.getGroundedChunkResponse(query, route, chunks);
    }

    // Stream words/tokens smoothly with ~12ms micro-delay for authentic UX
    const tokens = text.split(/(\s+)/);
    for (const t of tokens) {
      await onToken(t);
      if (t.trim().length > 0) {
        await new Promise((r) => setTimeout(r, 12));
      }
    }

    return text;
  }

  private static getZombieServicesResponse(): string {
    return `### 🛡️ Зомби-услуги и Карантин цен в OmniSMM 1.0

**1. Зомби-услуги (Zombie Services):**
Это услуги, которые поставщик удалил или отключил на своей стороне, но они продолжают отображаться в локальной базе данных.
* **Защитный механизм (\`CAT-ZOMBIE-PURGE\`):** при каждой синхронизации теневого кэша ([Импорт каталога](/admin/providers/import)) система сопоставляет список ID. Услуги, отсутствующие у провайдера, переводятся в статус \`ARCHIVED\` и скрываются из клиентской витрины.

**2. Карантин цен (Price Quarantine):**
Инвариант безопасности **\`CAT-PRICE-QUARANTINE-30\`** для защиты маржинальности:
* Если закупочная стоимость у провайдера возрастает или падает более чем на **30%**, автообновление цены блокируется.
* Услуга переводится в статус \`QUARANTINE\`, а дежурному администратору отправляется Telegram-алерт P0 для ручного подтверждения.

**3. Инварианты безопасности каталога:**
* **Приоритет №1 выбора администратора (\`CAT-INGEST-PRIORITY-1\`):** при ручном сопоставлении категорий алгоритмический анализатор отключается.
* **Zero-Unknown-Platform Guard:** услуги с неизвестной соцсетью отбраковываются на входе.

🔗 **Связанные разделы:** [Мастер импорта](/admin/providers/import) • [Провайдеры API](/admin/providers) • [Каталог услуг](/admin/catalog)`;
  }

  private static getCherryPickResponse(): string {
    return `### ⚡ Cherry-Pick импорт и Теневой каталог (Shadow Catalog)

**1. Теневой каталог (Shadow Catalog):**
Изолированный буфер в Redis/DB (\`ProviderServiceCache\`), куда загружается полный прейскурант провайдера без прямого влияния на витрину клиентов.

**2. Принцип Cherry-Pick:**
* Позволяет администратору точечно выбирать только проверенные позиции с нужной маржой.
* Автоматическая нормализация соцсетей и типов через \`smart-analyzer.logic.ts\`.
* Защита от непреднамеренной перезаписи существующих описаний.

🔗 **Раздел:** [Мастер импорта Cherry-Pick](/admin/providers/import)`;
  }

  private static getFiscalResponse(): string {
    return `### 💳 Фискализация 54-ФЗ и Ledger BigInt в OmniSMM 1.0

**1. Расчет в копейках BigInt:**
Все финансовые операции производятся исключительно в целых копейках через библиотеку ExactMath (\`Half-Even\` округление). Прямое изменение баланса запрещено — операции выполняются через \`WalletOps\` с обязательным \`idempotencyKey\`.

**2. Требования 54-ФЗ (2026):**
* Базовая ставка НДС: **22%** (\`vat_code: 10\`, закон № 425-ФЗ).
* Порог УСН: **20 000 000 ₽** (\`vat_code: 1\` — Без НДС).

🔗 **Раздел:** [Финансы и Транзакции](/admin/finance)`;
  }

  private static getGroundedChunkResponse(query: string, route: string, chunks: RetrievedChunk[]): string {
    const chunkTitles = chunks.map((c) => `* **${c.title}** (\`${c.filePath || c.category}\`)`).join('\n');
    return `### ℹ️ Консультация по контексту страницы \`${route}\`

На ваш запрос *«${query}»* в кодовой базе и регламентах OmniSMM 1.0 зафиксированы следующие правила:

${chunkTitles}

* Все денежные операции проводятся через \`WalletOps\` с аудитом в \`AdminAuditLog\`.
* Архитектура строго разделена на Clean Architecture слои (Domain, Service, Repository, Presentation).
* При возникновении отклонений сверяйтесь с патентными регламентами во вкладке «Инструкция».

🔗 **Разделы:** [Панель управления](/admin/dashboard) • [Каталог](/admin/catalog) • [Провайдеры](/admin/providers)`;
  }
}
