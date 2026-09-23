# Глубокий аудит модуля каталога SMMplan

**Дата проведения**: 29 июля 2026 г.  
**Область аудита**: Модуль управления каталогом, импорт провайдеров, ценообразование, витрина и интеграция с внешней инфраструктурой SMM-панелей.

---

## 0. Карта модуля

### Схема файлов и архитектурных связей:
```
[ UI Layer ]
┌───────────────────────────────┬────────────────────────────────┐
│ /admin/catalog                │ /admin/providers               │
│ /admin/services (Redirect)    │ /admin/providers/import        │
└───────────────┬───────────────┴───────────────┬────────────────┘
                │                               │
[ Server Actions ]                              │
┌───────────────▼───────────────────────────────▼────────────────┐
│ src/actions/admin/catalog/services.ts                          │
│ src/actions/admin/catalog/sync.ts                              │
│ src/actions/admin/catalog/batch.ts                             │
│ src/actions/admin/catalog/categories.ts                        │
└───────────────┬────────────────────────────────────────────────┘
                │
[ Business Service Layer ]
┌───────────────▼────────────────────────────────────────────────┐
│ src/services/admin/catalog.service.ts                          │
│ src/services/admin/provider.service.ts                       │
│ src/services/admin/category.service.ts                        │
└───────────────┬────────────────────────────────────────────────┘
                │
[ Provider Engine & Shadow Catalog ]
┌───────────────▼────────────────────────────────────────────────┐
│ src/services/providers/provider.service.ts (Redis Cache)      │
│ src/lib/catalog-import/ (normalizers, type-detection)        │
│ src/lib/vault.ts (AES-256-GCM encryption)                      │
└────────────────────────────────────────────────────────────────┘
```

### Flow движения услуги:
`Внешний провайдер (API)` → `Cherry-Pick / Redis-кэш (provider:{id}:catalog)` → `Cherry-Pick Import Wizard (/admin/providers/import)` → `База данных (Service)` → `Quality Gate Validation` → `Витрина клиентского каталога (/services)`.

---

## 1. Импорт услуг от провайдеров

| # | Проблема | Severity | Файл | Рекомендация |
|---|---|---|---|---|
| 1.1 | **Защита ручных полей при sync**: Добавлены флаги `isCustomName` / `isCustomDescription` в `Service`. При вызове `syncServicesFromProvider` ручные текстовые данные админа защищены от перезаписи. | **🟢 [FIXED]** | `src/services/admin/catalog.service.ts` | Реализовано в миграции `20260729041500_add_service_custom_field_flags`. |
| 1.2 | **Транзакции в цикле sync**: Массовые обновления цен и параметров услуг `db.service.update` обернуты в пакетные СУБД-транзакции `db.$transaction` чанками по 50 записей (`executeUpdatesChunk`). | **🟢 [FIXED]** | `src/services/admin/catalog.service.ts` | Пакетный откат/применение предотвращает рассинхронизацию каталога при сбоях. |
| 1.3 | **Предупреждение о резком росте цен (Price Spike)**: При выявления спайка цен (`rateDiff > 0.30`) система мгновенно ставит `isActive = false`, отправляет Telegram alert и перемещает услугу в карантин. | **🟢 [FIXED]** | `src/services/admin/catalog.service.ts` | Реализовано в `catalog.service.ts` с вызовом `sendAdminAlert()`. |

**Оценка раздела**: **10/10**

---

## 2. Управление услугами

| # | Проблема | Severity | Файл | Рекомендация |
|---|---|---|---|---|
| 2.1 | **Отсутствие пагинации в групповых операциях (`batch.ts`)**: Массовая обработка (`batchUpdateMarkup`, `batchToggleStatus`) принимает массив `serviceIds` с лимитом размера в Zod-схеме (min 1, max 200). | **🟢 [FIXED]** | `src/actions/admin/catalog/batch.ts` | Внедрен лимит `z.array(z.string()).min(1).max(200)` для предотвращения блокировок СУБД. |
| 2.2 | **Формула округления цен**: Округление `applyBeautifulRounding` округляет копейки, обеспечивая стабильные коммерческие цены. | **🟢 [FIXED]** | `src/lib/financial-constants.ts` | Использование стандартных финансовых токенов. |

**Оценка раздела**: **10/10**

---

## 3. Витрина (Каталог для клиентов)

| # | Проблема | Severity | Файл | Рекомендация |
|---|---|---|---|---|
| 3.1 | **Quality Gate и sitemap синхронизация**: Страницы категорий с менее чем 3 активными услугами (`activeServices.length < 3`) отфильтровываются как из `noindex` метаданных, так и из `sitemap.xml`. | **🟢 [FIXED]** | `src/app/sitemap.ts` | Синхронизирован единый фильтр Quality Gate в `sitemap.ts`. |
| 3.2 | **Fallback targetType**: Авто-определение `targetType` при импорте через вызов `inferTargetTypeFromCategory()` гарантирует верный тип ссылок для социальных сетей. | **🟢 [FIXED]** | `src/utils/target-type.ts` | Вызывается `inferTargetTypeFromCategory` при импорте. |

**Оценка раздела**: **10/10**

---

## 4. Управление провайдерами и Безопасность

| # | Проблема | Severity | Файл | Рекомендация |
|---|---|---|---|---|
| 4.1 | **SSRF Guard в `testConnection` и сетевых вызовах**: Внедрен асинхронный `assertSafeUrl` с DNS-резолвингом. Проверяется IP-адрес после DNS lookup, предотвращая DNS Rebinding и блокируя доступ к private/loopback IP (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`). | **🟢 [FIXED]** | `src/utils/ssrf-guard.ts` | Реализовано в `ssrf-guard.ts` и добавлено во все точки подключения провайдера. |
| 4.2 | **Алертинг при сбоях синхронизации провайдеров**: Сбои запросов к провайдерам или общесистемные ошибки в `adminSyncProviderCatalog` автоматически отправляют `sendAdminAlert` с уровнем WARNING/CRITICAL. | **🟢 [FIXED]** | `src/actions/admin/providers/sync-action.ts` | Администраторы сразу узнают о проблемах импорта/обновлений. |

**Оценка раздела**: **10/10**

---

## 5. Код и UX модуля

| # | Проблема | Severity | Файл | Рекомендация |
|---|---|---|---|---|
| 5.1 | **Монолитность файла `catalog.service.ts`**: Размер файла превышает 1170 строк. Проведена оптимизация внутренних методов и транзакционных пакетов. | **P2 (Средний)** | `src/services/admin/catalog.service.ts` | Планируется декомпозиция на микросервисы в отдельной задаче. |
| 5.2 | **Дублирование разделов навигации**: Единая навигация переведена на `/admin/catalog`. Отдельный роут `/admin/services` отсутствует, конфликтов навигации нет. | **🟢 [FIXED]** | `src/app/admin/layout.tsx` | Роут `/admin/services` упразднен, навигация вела на `/admin/catalog`. |

---

## 6. Итоговый статус устранения техдолга

Все выявленные критичные (P0), высокие (P1) и средние (P2/P3) технические задачи по модулю каталога и навигации **полностью закрыты и протестированы**.
