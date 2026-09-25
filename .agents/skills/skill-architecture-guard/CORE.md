# SKILL CORE: skill-architecture-guard (L1 Invariants)

> **Стандарт:** Claude / Anthropic Agent Skills Architecture v2.0  
> **Харнес:** `scripts/audit-skills-architecture.ts` | **Команда:** `npm run lint:skills`

---

## HARD INVARIANTS & RULES (Zero Tolerance)

1. **FM-INV-1 (Name Match):** Поле `name` в YAML frontmatter ОБЯЗАНО строго совпадать с именем папки (`dirName`) и соответствовать regex `^[a-z0-9-]+$`.
2. **FM-INV-2 (Dual-Trigger Description):** Описание ОБЯЗАНО содержать позитивный триггер («Используй когда...») и негативный триггер («НЕ применять для...»). Длина: 60–750 симв.
3. **ST-INV-3 (6 Mandatory Sections):** `SKILL.md` обязан содержать 6 разделов:
   - Overview & Scope Boundaries
   - Decision Tree (Mermaid / Flowchart)
   - Hard Invariants
   - Step-by-Step Execution Protocol
   - Known Anti-Patterns & Lessons Learned
   - Verification Checklist / Quality Gate
4. **L1-INV-4 (Dual-Tier Token Budget):** Все ключевые архитектурные навыки (Tier 1/2) ОБЯЗАНЫ иметь `CORE.md` строго до 65 строк с блоком `HARD INVARIANTS`.
5. **HY-INV-5 (Zero Local Paths):** Запрещен любой хардкод абсолютных путей `<DISK>:\Users\...` или `/home/...`.
6. **HY-INV-6 (No Broken Links):** Все относительные markdown-ссылки на локальные файлы и скрипты обязаны существовать на диске.

---

## VERIFICATION COMMANDS

```bash
npm run lint:skills                  # Полный аудит всех скилов
npm run lint:skills:arch             # Аудит архитектурного ядра (Tier 1/2)
npm run lint:skills -- --skill=<name> # Проверка конкретного скилла
```
