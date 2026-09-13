# docker-lean-build-ops (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **No-Host-Freeze:** Запрещено запускать сборку Next.js / Docker с дефолтным приоритетом. Процесс `node.exe` обязан иметь приоритет `BelowNormal`.
2. **Резервирование ядер CPU:** Маска процессора (CPU Affinity) обязана исключать минимум 1 ядро для операционной системы Windows.
3. **Pre-Flight Load Check:** Запрещен запуск контейнеров при свободной памяти хоста $< 800\text{ MB}$.
4. **Поэтапный запуск (Staggered Startup):** Контейнеры поднимаются строго: `db + redis + clash` $\to$ `worker + bot` $\to$ `web`.
5. **Защита WSL2 VHDX:** Обязательна директива `sparseVhd=true` в `.wslconfig` для предотвращения раздувания виртуального диска.

## ⚡ FAST RULES & FORMULAS
- Сборка на хосте: `npm run build:lean` (`scripts/lean-docker-build.ps1`).
- Очистка мусора: `npm run docker:clean` (`scripts/docker-clean-bloat.ps1`).

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Запущен ли билдер с приоритетом `BelowNormal`?
- [ ] Свободно ли на хосте $\ge 1.0\text{ GB}$ RAM?

---
*Для полного дерева решений и премортема см. [SKILL.md](./SKILL.md) (L2 Deep).*\n