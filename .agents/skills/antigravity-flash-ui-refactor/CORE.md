# antigravity-flash-ui-refactor (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **No Monolithic Rewrite (Chunked Diff Protocol):** ЗАПРЕЩЕНО полностью перезаписывать файлы > 150 строк через write_to_file. Рефакторинг выполняется строго точечными блоками по 20–50 строк через replace_file_content.
2. **200-Line Component Ceiling:** Любой компонент свыше 200 строк обязан декомпозироваться на субкомпоненты (Header, Grid, Row, Modals).
3. **Zero-Props-Loss Invariant:** Запрещено терять пропсы, обработчики событий (onClick, onChange) и ref при переносе кода.
4. **React 19 Action-First Guard:** Запрещено генерировать useState(false) для лоадеров при отправке форм — использовать useActionState и useFormStatus.
5. **No Style Hallucinations:** Запрещен хардкод цветов и inline-стилей. Только семантические токены Tailwind 4 (@theme).

## ⚡ FAST RULES & FORMULAS
- Декомпозиция: `components/dashboard/[DashboardView.tsx, MetricCards.tsx, OrdersFeed.tsx]`.
- Безопасный патч: замена одного логического блока за один вызов replace_file_content.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Размер файла после рефакторинга <= 200 строк?
- [ ] Сохранены ли все типы интерфейса без появления any?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
