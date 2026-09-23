# 🗺️ Генеральный план сквозного аудита проекта SMMplan / SMMflux (14 Чанков)

Этот план разбивает всю платформу на 14 независимых, компактных модулей (UI/UX фронтенд, админ-панель SMMpanel 1.0, финансовое ядро, API и воркеры) для пошаговой проверки агентом Qwen.

---

## 🎨 БЛОК A: Клиентский интерфейс и пользовательский опыт (B2C/API UI/UX)

### 📌 ЧАНК 1: Главный лендинг и мастер заказа (Order Wizard UX)
- **Файлы:**
  - `src/components/landing/order-engine/` (`useCheckoutOrchestrator.ts`, `NetworkSelector.tsx`, `InlineCheckoutForm.tsx`)
  - `src/components/landing/order-engine/drawer/` (`DrawerQuantityCard.tsx`, `DrawerOrderSummary.tsx`, `DrawerFooter.tsx`)
  - `src/components/orders/` (`SmartOrderForm.tsx`, `UnifiedOrderWizard.tsx`)
- **Фокус аудита:**
  - **UX/UI:** Анимация ошибок (shake animation при невалидной форме), автоскролл к ошибочному полю, кнопка Submit ВСЕГДА активна.
  - **Mobile:** Touch target >= 44px, отсутствие дерганий высоты дроверов, корректная клавиатура на смартфонах.
  - **Pricing:** Отображение цены строго за 1 шт (`₽ / шт`), автоподстановка `minQty`.

### 📌 ЧАНК 2: Клиентский личный кабинет (Dashboard UX & Finance)
- **Файлы:**
  - `src/app/dashboard/page.tsx`, `src/app/dashboard/sidebar-nav.tsx`
  - `src/app/dashboard/finance/`, `src/app/dashboard/deposit/`, `src/app/dashboard/add-funds/`
  - `src/app/dashboard/orders/`, `src/app/dashboard/referrals/`, `src/app/dashboard/settings/`
- **Фокус аудита:**
  - **UX:** Калькулятор бонусов при пополнении (СБП, Карты РФ, CryptoBot), генератор API-счетов.
  - **Рефералы:** Шкала уровней 5–15%, мгновенная генерация QR-кода и ссылок для шеринга в TG/VK.
  - **Профиль:** Smart Bind Telegram в 1 клик через QR, тумблеры мгновенных уведомлений, согласие 152-ФЗ.

### 📌 ЧАНК 3: Каталог услуг и публичные страницы (Catalog & SEO UX)
- **Файлы:**
  - `src/app/services/`, `src/components/services/flux/FluxServicesCatalog.tsx`
  - `src/app/knowledge/`, `src/app/academy/`, `src/app/legal/`
- **Фокус аудита:**
  - **UX:** Быстрый поиск и фильтрация по соцсетям и категориям без перезагрузки страницы.
  - **SEO & Multi-Tenant:** Канонические URL через `absoluteCanonical(tenantId, path)`, отсутствие фантомных брендов.

---

## 🖥️ БЛОК B: Панель управления SMMpanel 1.0 (Enterprise API UX)

### 📌 ЧАНК 4: Управление заказами оператора (Admin Orders Hub)
- **Файлы:**
  - `src/app/admin/orders/page.tsx`, `src/components/orders/MobileOrderList.tsx`, `src/components/orders/OrderFilters.tsx`
  - `src/hooks/admin/use-orders.ts`, `src/components/orders/ChargeBreakdownModal.tsx`
- **Фокус аудита:**
  - **Zero Column Clipping:** 100% умещение по ширине экрана (Viewport Width Fit), компактные ячейки `px-2 py-1.5`, отсутствие горизонтального скролла.
  - **Optimistic UI:** Мгновенный отклик кнопок перезапуска (Refill) и отмены с TTL-таймером авто-очистки.

### 📌 ЧАНК 5: Студия услуг и таксономия (Admin Catalog Studio)
- **Файлы:**
  - `src/app/admin/catalog/page.tsx`, `src/app/admin/catalog/new/page.tsx`, `src/app/admin/catalog/[id]/page.tsx`
  - `src/app/admin/catalog/categories/page.tsx`, `src/app/admin/catalog/tree/page.tsx`, `src/app/admin/catalog/patterns/page.tsx`
  - `src/components/admin/flux-catalog-bento.tsx`, `src/components/admin/catalog-table-v2.tsx`
- **Фокус аудита:**
  - **4-уровневая таксономия:** Сеть -> Категория -> Услуга -> Тариф.
  - **Паттерны ссылок:** Sandbox для тестирования RegEx-масок ссылок, AI-генератор на базе `gemini-3-flash`.

### 📌 ЧАНК 6: Провайдеры и Cherry-Pick импорт (Admin Providers Hub)
- **Файлы:**
  - `src/app/admin/providers/page.tsx`, `src/app/admin/providers/client-table.tsx`
  - `src/app/admin/providers/import/` (`confirmation-modal.tsx`, `services-table.tsx`, `types.ts`)
- **Фокус аудита:**
  - **Bento Cards & Table:** Адаптивное переключение между таблицей на десктопе и Bento-карточками на мобильных экранах.
  - **Shadow Catalog:** Защита от прямого импорта 5000+ услуг в основную БД без одобрения оператора.

### 📌 ЧАНК 7: Рабочее место поддержки (Admin Tickets & Live Telegram)
- **Файлы:**
  - `src/app/admin/tickets/page.tsx`, `src/app/admin/tickets/components/unified-workspace.tsx`
  - `src/app/admin/tickets/components/tickets-sidebar.tsx`, `src/app/admin/tickets/components/attached-orders-grid.tsx`
  - `src/components/support/ChatWindow.tsx`, `src/components/support/chat/ChatMessageList.tsx`
- **Фокус аудита:**
  - **Modal Hoisting (Правило 11):** Модалки объявлены на уровне страницы, а не внутри выпадающих списков.
  - **Live Telegram Sync:** Инлайн-редактирование сообщений в Telegram, удаление, опрос оценки CSAT (⭐ 1–5).

### 📌 ЧАНК 8: Графики смен и зарплата сотрудников (Admin Staff & Payroll)
- **Файлы:**
  - `src/app/admin/staff/page.tsx`, `src/app/admin/staff/components/staff-schedule-tab.tsx`
  - `src/actions/admin/staff/`
- **Фокус аудита:**
  - **Сетка графика 1..31:** Автозаполнение шаблонов смен 2/2 и 5/2, подмены, отпуска, расчет почасовой ставки и ЗП, экспорт в CSV.

### 📌 ЧАНК 9: Финансы, 54-ФЗ и налоговый учет (Admin Finance & Fiscal Hub)
- **Файлы:**
  - `src/app/admin/finance/page.tsx`, `src/app/admin/finance/balance-requests/`
  - `src/services/financial/ledger-reconciliation.service.ts`
- **Фокус аудита:**
  - **54-ФЗ & НДС 2026:** Базовая ставка 22%, порог УСН 20 млн ₽ (vat_code: 1 до 20 млн, vat_code: 10 свыше).
  - **Dispute Pack:** Генерация доказательной базы для банков при чарджбэках.

### 📌 ЧАНК 10: Управление знаниями, CMS и Мультитенантность
- **Файлы:**
  - `src/app/admin/knowledge/`, `src/app/admin/cms/`, `src/app/admin/pages/`, `src/app/admin/settings/`, `src/app/admin/tenants/`
- **Фокус аудита:**
  - **Multi-Tenant:** Переключение сайтов через глобальный селектор в Header, кука `x_admin_tenant`.
  - **152-ФЗ:** Карточка согласия на обработку данных, реквизиты ИП/ООО.

---

## ⚙️ БЛОК C: Бэкенд, Безопасность и Инфраструктура

### 📌 ЧАНК 11: Server Actions, RBAC и Сессии
- **Файлы:**
  - `src/actions/admin/*`, `src/actions/order/*`, `src/actions/support/*`
  - `src/lib/server/rbac.ts`, `src/lib/session.ts`, `src/lib/admin-audit.ts`
- **Фокус аудита:**
  - Строгие гарды `requireAdmin()` / `requireStaffPermission()`, `'use server'` строго на первой строке, обязательный `await auditAdminAwaitable()`.

### 📌 ЧАНК 12: Финансовое ядро и платежные шлюзы (WalletOps & Webhooks)
- **Файлы:**
  - `src/services/financial/wallet-ops.ts`, `src/services/financial/refund-policy.service.ts`
  - `src/app/api/webhooks/yookassa/route.ts`, `src/app/api/webhooks/crypto/route.ts`, `src/app/api/webhooks/robokassa/route.ts`
- **Фокус аудита:**
  - Суммы строго в BigInt (копейках), уровень транзакций Serializable, idempotencyKey, timingSafeEqual для HMAC подписей.

### 📌 ЧАНК 13: API Реселлер API v2 и Vault Шифрование
- **Файлы:**
  - `src/app/api/v2/route.ts`, `src/actions/user/settings-extra.ts`, `src/services/security/vault.service.ts`
- **Фокус аудита:**
  - SHA-256 хэширование API-ключей, изоляция реселлеров, Rate Limiting (50 req/min), шифрование AES-256-GCM.

### 📌 ЧАНК 14: BullMQ Воркеры, Universal Provider и Anti-SSRF
- **Файлы:**
  - `src/workers/processors/order.processor.ts`, `src/workers/processors/sync.processor.ts`, `src/workers/processors/refill.processor.ts`
  - `src/services/providers/universal.provider.ts`, `src/utils/ssrf-guard.ts`
- **Фокус аудита:**
  - Блокировка редиректов (`redirect: 'error'`), проверка `assertSafeUrl()`, маскировка API-ключей в логах, Circuit Breaker.
