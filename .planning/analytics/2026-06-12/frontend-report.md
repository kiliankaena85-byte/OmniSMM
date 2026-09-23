# 🔎 Frontend QA & UI Report — Smmplan
**Дата:** 2026-06-12
**UI Quality Score:** 92 / 100 (Rating: A)

## 🏗️ Оставленные Заглушки (Mocks & TODOs)
*Найдено: 0 штук*

## 🎨 Нарушения Дизайн-системы
*Найдено: 4 штуки*
- `src/app/admin/finance/payments/[id]/dispute-pack/page.tsx`: Использование хардкод цвета `text-white`
- `src/components/support/ClientProfileSidebar.tsx`: Использование хардкод цвета `text-white`
- `src/app/admin/providers/components/provider-form.tsx`: Использование хардкод фона `bg-[#1e1e1e]`
- `src/app/admin/providers/components/provider-form.tsx`: Использование хардкод фона `bg-[#2d2d2d]`

## 🧩 Мёртвый или скрытый UI
*Найдено: 0 штук*
*(Примечание: найденные `className="hidden"` используются валидно для `<input type="file">`, `false &&` не обнаружено, мертвых `onClick` нет)*

## ♿ Проблемы доступности (a11y)
*Найдено: 6 штук*
Отсутствует обязательный атрибут `aria-label` у `<Table>`:
- `src/app/admin/clients/[id]/client-orders-table.tsx`
- `src/app/admin/dashboard/recent-audit-table.tsx`
- `src/app/admin/marketing/client-referrers-table.tsx`
- `src/app/admin/pages/client-table.tsx`
- `src/app/admin/refills/client-table.tsx`
- `src/components/admin/cms/CMSTable.tsx`

## 📋 Priority Actions (Что убрать перед релизом)
1. Добавить `aria-label="..."` для 6 таблиц, перечисленных выше.
2. Заменить `text-white` на семантические токены (например, `text-primary-foreground` или `text-success-foreground`).
3. Заменить хардкодные HEX-цвета фонов (`bg-[#1e1e1e]` и `bg-[#2d2d2d]`) в `provider-form.tsx` на `bg-card`, `bg-background` или `bg-muted`.
