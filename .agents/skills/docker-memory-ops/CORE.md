# docker-memory-ops (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** No In-Place Production Rebuild: запрещено пересобирать рабочий контейнер :3000 напрямую без Stage.
2. **Инвариант 2:** Cgroups v2 Ground Truth: причина падения проверяется строго через memory.events (oom_kill).
3. **Инвариант 3:** Golden Ratio RAM: max-old-space-size Node.js устанавливается строго на 70% от лимита контейнера.
4. **Инвариант 4:** Data Volume Protection: запрещен docker volume prune без исключения постоянных томов БД.
5. **Инвариант 5:** WSL2 Drop Caches: при утечках памяти виртуальной машины выполняется сброс кэшей страниц.

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=docker-memory-ops`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
