# Отчет по Волна 4: Безопасность Периметра, Auth & Multi-Tenant
**Дата:** 2026-09-29  
**Статус:** 🟢 100% COMPLETE & VERIFIED  
**Арбитраж:** ActionArbiter AAA-2026 (`0 токенов расхода`, детерминированные сенсоры)

---

## 1. Проверенные модули и архитектурные инварианты
1. `src/proxy.ts`:
   - **Perimeter Host Allowlist:** Функция `isKnownOrAllowedHost` валидирует входящие хосты против доверенных корневых доменов (`smmplan.pro`, `smmflux.ru`), разрешенных туннелей (`.ts.net`, `.trycloudflare.com`) и локальных интерфейсов.
   - Защита от Host Header Injection и поддельных хостов (отклонение неавторизованных внешних хостов со статусом HTTP 400/403).
   - Очистка хостов от trailing dots и портов (`cleanHostString`).

2. `src/lib/session.ts` & `src/lib/session-edge.ts`:
   - **Staff Privilege Escalation Guard:** Для персонала (`ADMIN`, `SUPPORT`, `OWNER`) роль намеренно не сохраняется в статическом JWT-токене на клиенте, а динамически запрашивается из БД/Redis при каждом вызове. Это гарантирует немедленный отзыв прав при деактивации сотрудника без ожидания истечения 24-часового JWT.
   - Шифрование JWT с привязкой к контуру и версии сессии.

3. `src/lib/server/rbac.ts` & `src/actions/admin/staff.ts`:
   - **Строгий RBAC Guard:** Обертка `requireStaffPermission` блокирует неавторизованных гостей и пользователей с ролью `USER` или `BANNED`.
   - Гранулярные матрицы прав (`BUILTIN_ROLE_PERMISSIONS` + кастомные разрешения `StaffRole`).
   - Изоляция данных по `tenantId` администратора через `resolveAdminTenantContext`.

4. `src/actions/customer/payment-issue.ts`:
   - **IDOR / BOLA Prevention:** Серверная проверка владельца платежа: если платеж привязан к аккаунту пользователя, запрос от неавторизованного гостя или другого пользователя немедленно отклоняется (`payment.userId !== sessionUser.userId`).
   - Защита от спама через `RateLimitService.checkCustomKey`.

---

## 2. Исполняемые тесты и доказательства (Vitest)
Файл тестов: `src/__tests__/unit/wave4-perimeter-security-invariants.test.ts`
- `1. Proxy Host Allowlist`: ✅ PASS
- `2. RBAC Guard Invariant`: ✅ PASS
- `3. Customer Payment IDOR Guard`: ✅ PASS

**Результат:** 3 из 3 тестов пройдены успешно (время выполнения: 11ms).

---

## 3. Вердикт ActionArbiter
- Статус: **`🟢 STRICT PASS`**
- Решения внесены в `.planning/DECISION_COVERAGE_INDEX.json`:
  - `DEC-WAVE4-001`: Strict Host Perimeter Allowlist & Host-Header Protection
  - `DEC-WAVE4-002`: Dynamic Staff Role Session Authorization (Anti-Privilege Escalation)
  - `DEC-WAVE4-003`: IDOR/BOLA Guard on Customer Payment Self-Service
