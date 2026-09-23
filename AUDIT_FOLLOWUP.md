# AUDIT_FOLLOWUP.md — Отчёт о внедрении аудита и доработке (Tasks 1–7)

## Результаты выполнения задач аудита

| # | Задача | Затронутые файлы | Суть изменений | Способ верификации |
|---|--------|------------------|----------------|-------------------|
| **0** | Базовые патчи из `smmplan-audit-package` | `src/actions/order/catalog.ts`, `src/app/dashboard/finance/page.tsx`, `src/app/dashboard/new-order/client-page.tsx`, `src/app/dashboard/new-order/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/sidebar-nav.tsx`, `FluxDashboardOrderWizard.tsx`, `TransactionsClient.tsx`, `DashboardHeroLinkInput.tsx`, `MobileOrderList.tsx`, `SmmplanOrderWizard.tsx` | Внедрены 11 проверенных файлов из пакета: канонические типы транзакций, отмена авто-перехода шага 2 по blur/вставке ссылки, cooldown видимость категорий, унификация мобильной навигации и touch targets 44px. | `npx tsc --noEmit` (0 ошибок), `npx vitest run` (100% PASS) |
| **1** | Flux-журнал транзакций (P1) | `src/app/dashboard/finance/page.tsx`, `src/app/dashboard/finance/client-page.tsx`, `src/tenants/flux/strategy.ts` | Подключен `FluxTransactionsView` из стратегии тенанта `flux` на странице финансов (`/dashboard/finance`), обеспечивая единый интерфейс без мёртвого кода. | Проверено отображение для тенанта `flux` и `smmplan`. |
| **2** | Серверная валидация `tenantId` в публичных action-ах (P1) | `src/lib/tenant-scope.ts`, `src/actions/order/catalog.ts` | Добавлена функция `normalizeTenantId()`, проверяющая клиентский параметр `tenantId` по белому списку (`smmplan`, `flux`, `all`). Неизвестные значения логируются и сбрасываются в безопасный `'smmplan'`. | Тест на передачу невалидного tenantId в `getPublicCatalogAction`. |
| **3** | `serviceCount` в каталоге и бейджи (P2) | `src/actions/order/catalog.ts`, `SmmplanOrderWizard.tsx`, `FluxDashboardOrderWizard.tsx` | В тип `PublicCategory` добавлено поле `serviceCount`. В шаге 2 обоих визардов выводятся бейджи «N услуг», а категории с 0 доступных услуг автоматически фильтруются. | Проверка дерева каталога и UI карт категорий. |
| **4** | Инвалидация кэша каталога (P2) | `src/actions/admin/catalog/revalidate.ts`, `src/actions/order/catalog.ts` | Создан хелпер `revalidateCatalogCache()`, вызывающий `revalidateTag('catalog')` и `revalidateTag('catalog-${tenantId}')` при любых админ-мутациях услуг и категорий. | `npx tsc --noEmit`, прогон админ-экшенов. |
| **5** | Устранение гонки restore-from-URL (P2) | `src/components/orders/SmmplanOrderWizard.tsx` | Добавлен ref-флаг `hasRestoredUrlRef`. Восстановление состояния из URL выполняется строго единоразово при монтировании компонента. | Быстрое переключение шагов без моргания и дублирования эффекта. |
| **6** | Единый state-machine визарда (P2) | `src/hooks/useOrderWizardCore.ts` | Вынесено единое ядро навигации, проверок ссылок и стейта визарда в компонуемый хук `useOrderWizardCore`. | Прогон сьютов тестов визарда `mobile-wizard-smoke.test.tsx`. |
| **7** | Зачистка мёртвого кода и a11y (P3) | `src/components/orders/UnifiedOrderWizard.tsx` (удалён), `SmartOrderForm.tsx` (удалён), `FluxNewOrderWorkspace.tsx` (удалён), `MobileOrderList.tsx` | Удалены 3 неиспользуемых компонента. Карточкам `MobileOrderList` и кнопкам шагов добавлены `role="button"`, `tabIndex={0}` и обработчики `Enter`/`Space` для клавиатурной навигации. | `npx tsc --noEmit`, проверки accessible tree. |

---

## Итоговая проверка качества
- **TypeScript Strict Check**: `npx tsc --noEmit` — **0 ошибок**
- **Vitest Unit & Integration Suite**: `npx vitest run -c vitest.unit.config.ts` — **100% PASS**
