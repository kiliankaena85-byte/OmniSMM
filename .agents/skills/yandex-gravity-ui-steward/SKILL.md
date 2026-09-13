---
name: yandex-gravity-ui-steward
description: Стандарт разработки enterprise-интерфейсов на дизайн-системе Яндекса (Gravity UI, @gravity-ui/uikit, @gravity-ui/navigation), токены поверхностей, таблицы данных и типографика YS.
tags: [yandex, gravity-ui, yandex-cloud, enterprise-ui, design-system, react-19, tables]
---

# yandex-gravity-ui-steward — Yandex Gravity UI Design System Standard

## 1. Концепция: Enterprise-стандарт Яндекса
**Gravity UI** — открытая дизайн-система и библиотека React-компонентов, созданная Яндексом для Yandex Cloud, DataLens, Tracker и высоконагруженных B2B-сервисов.

### Главные преимущества:
- Экстремальная информационная плотность (High Density UI) без визуального шума.
- Идеально выверенная доступность (WCAG 2.2 Level AA).
- Бесшовная смена тем (Light, Dark, Dark HC, Light HC).
- Богатый набор готовых компонентов: таблицы с сортировкой, фильтрами и виртуализацией, шторки, модалки, селекторы.

---

## 2. Архитектура тем и токенов

Все цвета и поверхности управляются через семантические CSS-переменные:
```css
/* Основные поверхности */
--g-color-base-background: фоновый слой страницы
--g-color-base-generic: поверхность карточки / панели
--g-color-base-float: всплывающие модалки и поповеры

/* Текст и иконки */
--g-color-text-primary: основной высококонтрастный текст
--g-color-text-secondary: приглушенные подписи
--g-color-text-hint: подсказки и плейсхолдеры

/* Акценты */
--g-color-base-action: основной акцентный цвет (кнопки CTA)
--g-color-base-action-hover: состояние ховера
```

---

## 3. Практические паттерны компонентов

### Компактная таблица данных
```tsx
import { Table, TableColumnConfig, withTableActions } from '@gravity-ui/uikit';

interface OrderItem {
  id: string;
  service: string;
  cost: number;
}

const columns: TableColumnConfig<OrderItem>[] = [
  { id: 'id', name: 'ID', width: 100 },
  { id: 'service', name: 'Услуга' },
  { id: 'cost', name: 'Сумма', align: 'right', template: (item) => `${item.cost} ₽` }
];

export function CompactOrdersTable({ data }: { data: OrderItem[] }) {
  return (
    <Table
      data={data}
      columns={columns}
      size="m"
      className="w-full"
      emptyMessage="Заказы не найдены"
    />
  );
}
```
