# SPEC-2026-09-25: Financial Subsystem & Ledger Hardening (OmniSMM 1.0)

- **Status**: DRAFT (Awaiting Human Approval)
- **Risk Tier**: Tier 1 (Critical Financial Core)
- **Author**: Fullstack Systems Analyst & Lead Architect
- **Target Components**: 
  - `src/services/financial/wallet-ops.ts`
  - `src/services/admin/escrow.service.ts`
  - `src/actions/support/ticket.ts`
  - `src/__tests__/financial/` & `src/__tests__/audit/`

---

## 1. Executive Summary & Problem Statement
Платформа OmniSMM 1.0 реализует высоконагруженное финансовое ядро для обслуживания витрин SMMplan и SMMflux. В соответствии с контрактом **AGENTS.md (Раздел 2: Финансовая безопасность / Trust Boundary & Ledger Invariants)** и стандартами **RAC-2026 / FA-2026**, все операции с балансом обязаны:
1. Следовать принципу **Ledger-First**: запись в `tx.ledgerEntry.create()` ОБЯЗАНА создаваться ДО мутации `tx.user.update()`.
2. Не допускать выхода за границы доверия (**Trust Boundary**): никаких прямых `db.user.update({ data: { balance } })` в обход методов `WalletOps`.
3. Обеспечивать **ACID-атомарность** при конкурентных отрицательных корректировках баланса (защита от ухода баланса в минус ниже нуля и выброса необработанных PostgreSQL Constraint Exceptions `23514`).
4. Гарантировать **100% подтвержденный аудит** денежных операций через `await auditAdminAwaitable()`.

В ходе глубокого сплошного аудита выявлено 5 конкретных архитектурных дефектов (FIN-01 .. FIN-05), требующих нормативного устранения.

---

## 2. Inventory of Defects & Technical Specifications

### [FIN-01] Нарушение порядка Ledger-First в `WalletOps.quarantineAdd`
- **Файл**: `src/services/financial/wallet-ops.ts` (строки 403–440)
- **Дефект**: Метод `quarantineAdd` выполняет обновление `tx.user.update({ data: { quarantineBalance: { increment: absAmount } } })` ДО вызова `tx.ledgerEntry.create()`. При сбое создания проводки (например, ошибка валидации, сбой FK, конфликт ключей) баланс в карантине изменяется, нарушая инвариант неизменяемого леджера.
- **Спецификация решения**:
  1. Выполнить проверку существования пользователя и соответствия `tenantId`.
  2. Проверить идемпотентность `if (idempotencyKey) { ... }`.
  3. Создать запись `tx.ledgerEntry.create({ data: { status: 'QUARANTINE', ... } })` **ПЕРВЫМ ШАГОМ**.
  4. Только после успешного создания проводки выполнить атомарную мутацию `tx.user.update({ where: { id: userId, ...(tenantId ? { tenantId } : {}) }, data: { quarantineBalance: { increment: absAmount } } })`.

---

### [FIN-02] Прямая мутация баланса в обход `WalletOps` в `EscrowService.resolveQuarantine`
- **Файл**: `src/services/admin/escrow.service.ts` (строки 284–287)
- **Дефект**: При одобрении транзакции из карантина (`resolution === 'APPROVE'`) баланс пользователя пополняется прямым вызовом `tx.user.update({ where: { id: entry.userId }, data: { balance: { increment: entry.amount } } })`. Это прямо нарушает Trust Boundary: операции с балансом выходят за рамки `WalletOps`, теряя централизованный аудит, валидацию лимитов и мульти-тенантную защиту.
- **Спецификация решения**:
  1. Реализовать в `WalletOps` специализированный защищенный метод:
     ```typescript
     async quarantineApprove(
       tx: PrismaTx,
       userId: string,
       amountCents: bigint | number,
       opts?: { tenantId?: string; adminId?: string }
     ): Promise<{ success: boolean; balance: bigint }>
     ```
  2. Внутри `quarantineApprove` гарантировать:
     - Проверку принадлежности пользователя тенанту `opts?.tenantId`.
     - Атомарное увеличение основного баланса `balance: { increment: rawCents }`.
     - Возврат актуального баланса.
  3. В `EscrowService.resolveQuarantine` заменить прямой `tx.user.update` на вызов `WalletOps.quarantineApprove(tx, entry.userId, entry.amount, { tenantId: user.tenantId, adminId: owner.id })`.

---

### [FIN-03] TOCTOU-гонка и потеря атомарности в отрицательных корректировках `WalletOps.adminAdjust`
- **Файл**: `src/services/financial/wallet-ops.ts` (строки 320–324)
- **Дефект**: При отрицательном значении `amountCents` (дебет / списание средств администратором) `WalletOps.adminAdjust` выполняет:
  ```typescript
  const updatedUser = await tx.user.update({
    where: { id: userId },
    data: { balance: { increment: rawCents } }, // rawCents < 0
    select: { balance: true }
  });
  ```
  Если на момент выполнения запроса параллельная операция уже списала баланс, операция пытается загнать баланс в минус. В БД срабатывает hardware constraint `CHECK (balance >= 0)`, прерывая транзакцию системной ошибкой PostgreSQL `23514` вместо типобезопасного исключения доменного слоя `WalletInsufficientFundsError`.
- **Спецификация решения**:
  1. При `rawCents < BigInt(0)` производить обновление через `tx.user.updateMany` с предикатом достаточности средств:
     ```typescript
     const absCents = -rawCents;
     const updateResult = await tx.user.updateMany({
       where: {
         id: userId,
         balance: { gte: absCents },
         ...(tenantId ? { tenantId } : {})
       },
       data: {
         balance: { increment: rawCents }
       }
     });
     if (updateResult.count === 0) {
       const userCheck = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
       throw new WalletInsufficientFundsError(absCents, userCheck?.balance ?? BigInt(0));
     }
     ```
  2. При `rawCents > BigInt(0)` выполнять стандартный `tx.user.updateMany` с защитой по `tenantId`.

---

### [FIN-04] Отсутствие `await` перед `auditAdmin` в массовых возвратах тикетов
- **Файл**: `src/actions/support/ticket.ts` (строка 805)
- **Дефект**: Вызов `auditAdmin({ action: 'TICKET_BULK_REFUND', ... })` выполнен в фоновом неприкаянном режиме (fire-and-forget) без `await`. При завершении Server Action процесс Node.js может завершиться или оборвать соединение, что приведет к потере записи финансового аудита.
- **Спецификация решения**:
  - Заменить вызов на `await auditAdminAwaitable({ ... })`, в полном соответствии с правилом `AGENTS.md` (*«Все финансовые audit — только через `await auditAdminAwaitable()`. ЗАПРЕЩЕНО `auditAdmin()` без await для денег»*).

---

### [FIN-05] Мульти-тенантная изоляция в операциях Escrow / Quarantine
- **Файл**: `src/services/financial/wallet-ops.ts` (строки 403–479)
- **Дефект**: В методах `quarantineAdd` и `quarantineRelease` отсутствует фильтрация по `tenantId`, что создает риск межтенантных манипуляций при передаче идентификатора пользователя из другого тенанта.
- **Спецификация решения**:
  - Добавить обязательный учет `opts?.tenantId` в `where`-селекторы `tx.user.updateMany` в обоих методах:
    `...(opts?.tenantId ? { tenantId: opts.tenantId } : {})`.

---

## 3. Impact Radius & Regression Prevention
1. **Смежные подсистемы**:
   - `EscrowService` (карантин подозрительных операций) — обратная совместимость 100%.
   - `OrderService`, `CheckoutTransactionService` — вызовы `WalletOps.charge` и `WalletOps.refund` не затрагиваются, их стабильность сохраняется.
   - `SupportFinancialAction` (компенсации саппорта) — вызовы типизированы.
2. **Гарантии обратной совместимости**:
   - Сигнатуры публичных методов `WalletOps.adminAdjust`, `WalletOps.quarantineAdd`, `WalletOps.quarantineRelease` остаются обратно совместимыми (аргументы не удаляются).
   - Добавлен новый метод `WalletOps.quarantineApprove`.

---

## 4. Verification Plan (TDD Protocol)
1. **Unit & Integration Tests**:
   - Обновить `src/__tests__/audit/concurrency-acid-integrity.test.ts` (тест AST инварианта `quarantineAdd` теперь должен проверять, что `ledgerEntry.create` вызывается ДО `user.update`).
   - Написать тест на атомарность списания в `WalletOps.adminAdjust` при попытке списать больше текущего баланса (проверка выброса `WalletInsufficientFundsError`).
   - Написать тест на метод `WalletOps.quarantineApprove` с проверкой `tenantId`.
2. **Typecheck & Secret Audit**:
   - `npm run typecheck` (`tsc --noEmit`) — 0 ошибок.
   - `node scripts/check-bundle-secrets.mjs` — 0 утечек секретов.
