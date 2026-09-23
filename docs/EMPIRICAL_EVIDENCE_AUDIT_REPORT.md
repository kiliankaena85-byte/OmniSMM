# 🔬 ОТЧЕТ ЭМПИРИЧЕСКИХ ДОКАЗАТЕЛЬСТВ И ВЕРИФИКАЦИИ (EMPIRICAL EVIDENCE AUDIT)
## Платформа OmniSMM 1.0 (SMMplan.pro / SMMflux.ru)

> **Принцип:** Никаких предположений ИИ. Только проверяемые машинные факты, криптографические хэши, физические строки кода и реальные логи выполнения в PostgreSQL и Node.js.
> **Временная метка генерации:** 2026-08-29T03:28:34.058Z

---

## 1. 📦 КРИПТОГРАФИЧЕСКИЕ ХЭШИ КРИТИЧЕСКИХ ФАЙЛОВ СИСТЕМЫ (SHA-256)

Любой аудитор может сверить хэш каждого файла командой `Get-FileHash <файл> -Algorithm SHA256` в PowerShell или `sha256sum <файл>` в Linux:

| Файл в репозитории | Размер (байт) | SHA-256 Контрольная сумма |
| :--- | :---: | :--- |
| `src/lib/financial/exact-math.ts` | 5847 B | `dc775c483d7b3e6c8f9f767e15d01b3735228cd779d4e31b4cc0d328e14684fc` |
| `src/data/legal-fallbacks.ts` | 21266 B | `3e27473bd33e6eda38434640f0d1909aee37d57df79d1fcffced863c5a42f918` |
| `src/components/legal/LegalPageContent.tsx` | 8676 B | `294a70337ad54bf53bb5c5021deb32224f32536dcef8a89c6ac1c5184724a32f` |
| `scripts/emergency-killswitch.ts` | 3049 B | `9cc64a491b4fe1c3b37406ec5de7dab4e12f9f630f4622cfc374a465a24d9521` |
| `scripts/verify-linux-build.ts` | 3908 B | `bbb1de215330168193e2a8cfac7d5adbc06108bab10fa36356524baf0a40b3fd` |
| `scripts/run-production-preflight.ts` | 3302 B | `bacdedf4c2f73149eb0c4295b46540fe16a7651caf59393df5a17a56a6b3945c` |
| `docs/PRODUCTION_GO_LIVE_CHECKLIST.md` | 9355 B | `5f005c52b96494c3f15b754625e1dbf97a945b65c433713ec7b6680102b79a6a` |
| `docs/PRE_RELEASE_AND_INCIDENT_PLAYBOOK.md` | 8743 B | `69d13a4c2944d2fb8d6e5d283b52ad89e903547c5bd1a1c1c0d977f51972806b` |

---

## 2. 🔌 ДОКАЗАТЕЛЬСТВО РЕАЛЬНОГО ИЗМЕНЕНИЯ СОСТОЯНИЯ В POSTGRESQL (KILLSWITCH TEST)

Тест выполнил физический цикл записи в боевую таблицу `SystemSettings` базы данных PostgreSQL (порт 5433):

* **ID записи в таблице SystemSettings:** `smmplan`
* **Исходное состояние maintenanceMode:** `false`
* **Состояние после команды активации Killswitch:** `true` (подтверждено `SELECT maintenanceMode FROM "SystemSettings"`)
* **Состояние после восстановления:** `false`
* **Статус проверки транзакционной мутации:** 🟢 100% SUCCESS (Детерминированная запись в БД подтверждена)

---

## 3. 💰 РЕАЛЬНЫЕ ЛОГИ ВЫПОЛНЕНИЯ: ФИНАНСОВАЯ МАТЕМАТИКА (ExactMath)

Команда запуска: `npx dotenv -e .env.test -- npx vitest run src/__tests__/financial/exact-math.test.ts`
Время выполнения: **13605 мс** | Exit Code: **0**

```
[1m[30m[46m RUN [49m[39m[22m [36mv4.1.4 [39m[90mD:/SMM_plan_2[39m

 [32m✓[39m src/__tests__/financial/exact-math.test.ts [2m([22m[2m10 tests[22m[2m)[22m[33m 11345[2mms[22m[39m
       [33m[2m✓[22m[39m converts standard ruble floats without drift [33m 1027[2mms[22m[39m
       [33m[2m✓[22m[39m throws on invalid or negative inputs [33m 1136[2mms[22m[39m
       [33m[2m✓[22m[39m converts kopecks to rubles accurately [33m 1034[2mms[22m[39m
       [33m[2m✓[22m[39m never charges 0 for positive quantity (anti-zero-charge exploit) [33m 1156[2mms[22m[39m
       [33m[2m✓[22m[39m calculates exact cost for bulk orders with margin [33m 1108[2mms[22m[39m
       [33m[2m✓[22m[39m applies Banker's Rounding (Half-Even) properly [33m 1134[2mms[22m[39m
       [33m[2m✓[22m[39m calculates exact 50% refund when half remains [33m 1263[2mms[22m[39m
       [33m[2m✓[22m[39m calculates full refund when all items remain [33m 1145[2mms[22m[39m
       [33m[2m✓[22m[39m calculates 0 refund when 0 remains [33m 1011[2mms[22m[39m
       [33m[2m✓[22m[39m handles fractional remains with Banker's Rounding without cents drift [33m 1291[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m10 passed[39m[22m[90m (10)[39m
[2m   Start at [22m 06:28:35
[2m   Duration [22m 12.19s[2m (transform 139ms, setup 317ms, import 55ms, tests 11.34s, environment 2ms)[22m
```

---

## 4. ⚖️ РЕАЛЬНЫЕ ЛОГИ ВЫПОЛНЕНИЯ: ЮРИДИЧЕСКИЙ КОМПЛАЕНС (5 Документов, 15-40% ФПР)

Команда запуска: `npx dotenv -e .env.test -- npx vitest run src/__tests__/legal/legal-compliance-and-enterprise-pages.test.ts`
Время выполнения: **8242 мс** | Exit Code: **0**

```
[1m[30m[46m RUN [49m[39m[22m [36mv4.1.4 [39m[90mD:/SMM_plan_2[39m

 [32m✓[39m src/__tests__/legal/legal-compliance-and-enterprise-pages.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 5746[2mms[22m[39m
     [33m[2m✓[22m[39m should have all 5 core legal documents registered in LEGAL_FALLBACKS [33m 1146[2mms[22m[39m
     [33m[2m✓[22m[39m terms: should contain proper statutory references and no dormant fee [33m 888[2mms[22m[39m
     [33m[2m✓[22m[39m refund: should contain 100% auto-refund and 15-40% FPR on withdrawal [33m 964[2mms[22m[39m
     [33m[2m✓[22m[39m service-rules: should contain 8 zero-tolerance categories and Meta disclaimer [33m 955[2mms[22m[39m
     [33m[2m✓[22m[39m privacy: should comply with 152-FZ, server localization in RF and PCI DSS [33m 846[2mms[22m[39m
     [33m[2m✓[22m[39m cookies: should specify session and security cookies without tracking [33m 894[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m6 passed[39m[22m[90m (6)[39m
[2m   Start at [22m 06:28:49
[2m   Duration [22m 6.40s[2m (transform 135ms, setup 284ms, import 55ms, tests 5.75s, environment 0ms)[22m
```

---

## 5. 🐧 РЕАЛЬНЫЕ ЛОГИ ВЫПОЛНЕНИЯ: СКАНЕР LINUX CASE-SENSITIVITY (1250+ Файлов)

Команда запуска: `npx tsx scripts/verify-linux-build.ts`
Время выполнения: **1792 мс** | Exit Code: **0**

```
================================================================
   LINUX DOCKER COMPATIBILITY & CASE-SENSITIVITY VERIFIER
================================================================

🔍 Scanned 1252 TypeScript source files for Linux compatibility.

✅ [LINUX-GATE: PASS] All imports are 100% case-sensitive compatible and free of Windows path issues!
```

---

## 6. 🛠️ КАК ЛЮБОЙ ЧЕЛОВЕК МОЖЕТ ПОВТОРИТЬ ПРОВЕРКУ СВОИМИ РУКАМИ

1. Открыть PowerShell или Linux терминал в папке проекта.
2. Выполнить команду мастер-прогона:
   ```bash
   npm run preflight
   ```
3. Выполнить проверку кросс-платформенности Linux:
   ```bash
   npm run verify:linux
   ```
4. Проверить статус экстренной остановки:
   ```bash
   npm run killswitch:status
   ```
