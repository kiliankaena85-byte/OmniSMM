# Доказательство исправления SEC-02 (Живые ключи провайдеров захардкожены в скриптах)

## 1. До исправления
В следующих скриптах присутствовали захардкоженные живые ключи и идентификаторы:
- `scripts/import-vexboost-live.ts`: `VEXBOOST_KEY` с дефолтным ключом провайдера `Pp1kBnSe...`
- `scripts/verify-stage-orders-view.ts`: дефолтный секрет JWT `58b78402...`
- `scripts/verify-stage-cookie-consent.ts`: дефолтный секрет JWT `58b78402...`
- `scripts/tunnel-daemon.mjs`: `ACCOUNT_ID` со значением `'0a7a9a7acb363ffba6f1f1d71897b94c'`
- 19 скриптов в `scripts/cloudflare/*`: захардкоженные `ACCOUNT_ID` и `ZONE_ID` (`'b67ab9748fc5f42587bc0d455faf0fdd'`)

## 2. Правки
1. `scripts/import-vexboost-live.ts`: заменено на fail-closed (`throw new Error('[SECURITY FATAL] VEXBOOST_API_KEY environment variable is required')`).
2. `scripts/verify-stage-orders-view.ts`: заменено на fail-closed проверку `JWT_SECRET || NEXTAUTH_SECRET`.
3. `scripts/verify-stage-cookie-consent.ts`: заменено на fail-closed проверку `JWT_SECRET || NEXTAUTH_SECRET`.
4. `scripts/tunnel-daemon.mjs`: убран хардкод `ACCOUNT_ID`.
5. `scripts/cloudflare/*`: удалены дефолтные значения `ACCOUNT_ID` и `ZONE_ID` из всех скриптов.

## 3. После исправления
Проверка отсутствия ключей:
- Поиск `Pp1kBnSe...`: 0 совпадений.
- Поиск `58b78402...`: 0 совпадений.
- Поиск `0a7a9a7a...`: 0 совпадений.
- Поиск `b67ab974...`: 0 совпадений.
- Запуск `node scripts/check-bundle-secrets.mjs`:
  ```
  🛡️  [CI-GATE] Scanning scripts/ for hardcoded secrets (lesson: C-02/C-03)...
  ✅ [CI-GATE PASSED] 0 hardcoded secrets found in scripts/ directory.
  ```
