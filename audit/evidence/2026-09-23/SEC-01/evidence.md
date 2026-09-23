# Доказательство верификации SEC-01 (Рабочие секреты в репозитории)

## 1. Проверка наличия .env файлов в индексе Git
Команда:
```bash
git ls-files | Select-String "env"
```
Вывод:
```
.env.example
.env.production.example
docs/architecture/ADR-2026-18-ENVIRONMENT-MODES-AND-SANDBOX-HYBRID-ARCHITECTURE.md
docs/audits/ENVIRONMENT_SETUP_REPORT.md
docs/specs/SPEC-2026-09-15-environment-modes-and-reconciliation-hardening.md
next-env.d.ts
src/__tests__/tenant/environment-modes-and-layout-verification.test.ts
src/__tests__/unit/admin-orders-environment-filtering.test.ts
src/__tests__/unit/environment-modes-reconciliation.test.ts
src/__tests__/unit/order-environment-mode.test.ts
src/actions/admin/environment-mode.ts
src/components/admin/EnvironmentModeSwitcher.tsx
src/components/admin/OrderEnvironmentBadge.tsx
src/utils/order-environment.ts
```
**Результат:** Файлы `.env`, `.env.stage`, `.env.prod`, `.env.staging` отсутствуют в Git-индексе.

## 2. Проверка правил .gitignore
Файлы `.env`, `.env.*` (кроме `.example`) заблокированы в корневом `.gitignore`:
```
.env
.env.bak
.env.local
.env.production
.env.development
.env.test
.env.test.local
.env.staging
.env.staging.local
.env.stage
.env.stage.local
```

## 3. Проверка бандла и скриптов на утечки
Команда: `node scripts/check-bundle-secrets.mjs`
Вывод:
```
🛡️  [CI-GATE] Scanning client bundles for leaked secrets and dev backdoors...
✅ [CI-GATE PASSED] 0 forbidden secrets or dev routes found in client build artifacts.
🛡️  [CI-GATE] Scanning scripts/ for hardcoded secrets (lesson: C-02/C-03)...
✅ [CI-GATE PASSED] 0 hardcoded secrets found in scripts/ directory.
```

## 4. Статус и Рекомендация
- В Git-индексе рабочих файлов окружения нет.
- Для боевого контура требуется подтверждение ротации внешних токенов со стороны ответственного лица платформы (ротация выполняется одним лицом).
