# 🔧 Tech Debt Report — Smmplan
**Дата:** 2026-06-12
**Исходных файлов:** 506
**Tech Debt Score:** 0.63 — Rating: A (ВНИМАНИЕ: Сборка проекта сломана, что является блокирующим фактором — Gate Failed)

## Scoreboard
| Метрика | Значение | Тренд | Weight |
|---------|----------|-------|--------|
| TS Errors | 1 (Next.js build) | new | ×3 |
| TS `any` / `@ts-ignore` | 42 / 0 | — | ×1 / ×2 |
| ESLint Errors | 0 (0 warnings) | — | ×1 |
| npm Vulnerabilities | 0 critical, 1 moderate | — | ×20 / ×3 |
| Files > 300 lines | 57 | — | ×5 |
| Forbidden Patterns | 23 (`console.log`) | — | varies |
| Test Ratio | 8.3% (42 tests) | — | info |
| Dead/Empty files | 21 | — | ×0.5 |
| Build | ❌ FAIL | — | gate |

## 🔥 Hotspots (most changed files)
| # | File | Changes/month |
|---|------|---------------|
| 1 | `prisma/schema.prisma` | 26 |
| 2 | `src/hooks/useOrderEngine.ts` | 18 |
| 3 | `src/components/landing/SmartLinkLanding.tsx` | 18 |
| 4 | `src/actions/order/checkout.ts` | 17 |
| 5 | `src/components/support/ChatWindow.tsx` | 16 |
| 6 | `src/workers/processors/cleanup.processor.ts` | 16 |
| 7 | `src/lib/smtp.ts` | 14 |
| 8 | `src/services/financial/payment.service.ts` | 14 |

## 🚫 Forbidden Pattern Violations
| Pattern | Count | Files |
|---------|-------|-------|
| `console.log` | 23 | В кодовой базе |
| `text-white/black` | 0 | — |
| `forwardRef`/`useFormState` | 0 | — |

## 📦 Oversized & Orphan Files
- **Large Files:** 57 файлов превышают 300 строк.
- **Large Components:** 38 компонентов превышают лимит в 150 строк (нарушение AGENTS.md).
- **Orphan Scripts:** 21 скрипт в `scripts/` старше 30 дней (например, `full-run.ts`, `qa-simulator.ts`, `seed-rbac.ts`).
- **Empty Files:** 21 файл содержит менее 5 строк.

## 📋 Priority Actions
1. **[CRITICAL] Починить Next.js Build:** Ошибка типизации в `scripts/analytics/sec-query.ts:64` (*"BigInt literals are not available when targeting lower than ES2020"*).
2. **[HIGH] Удалить `console.log`:** Устранить 23 вызова консоли в продакшене.
3. **[MED] Декомпозиция компонентов:** Обратить внимание на 38 React-компонентов >150 строк, разбив их на sub-components согласно AGENTS.md.
4. **[LOW] Ревизия скриптов:** Удалить или обновить 21 заброшенный скрипт в директории `scripts/`.
