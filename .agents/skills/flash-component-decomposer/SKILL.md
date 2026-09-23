---
name: flash-component-decomposer
description: Инженерный стандарт архитектурной декомпозиции интерфейсов для Gemini Flash (разделение View и Logic, вынос хуков, Modal Hoisting, оптимизация React 19 Compiler).
tags: [antigravity, gemini-flash, decomposition, view-logic-separation, custom-hooks, modal-hoisting, clean-architecture]
---

# flash-component-decomposer — UI View & Logic Separation Standard

## 1. Концепция: Избавление от «Компонентов-Богов»
Типичная проблема разрастающихся проектов — гигантские файлы на 600–1000 строк, где в одном месте объявлены:
- Состояния 10 разных полей ввода (`useState`).
- Логика открытия 3 разных модалок.
- Запросы к базе данных и вызовы Server Actions.
- Верстка огромной таблицы с инлайновыми формами.

Скилл `flash-component-decomposer` принудительно трансформирует такие компоненты в элегантную 4-модульную структуру:
1. **`<Feature>View.tsx`** — Чистая презентация (Stateless JSX).
2. **`use<Feature>.ts`** — Инкапсулированный хук управления состоянием и экшенами.
3. **`<Feature>Item.tsx`** — Атомарный элемент списка/карточки.
4. **`<Feature>Modal.tsx`** — Вынесенное модальное окно (Modal Hoisting).

---

## 2. Практический пример декомпозиции

### 2.1. Хук логики (`useOrdersWorkspace.ts`)
```ts
export function useOrdersWorkspace(initialOrders: OrderDto[]) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeModalOrder, setActiveModalOrder] = useState<OrderDto | null>(null);

  const handleRepeatOrder = async (orderId: string) => {
    // вызов Server Action
  };

  return {
    orders,
    activeModalOrder,
    openOrderDetails: setActiveModalOrder,
    closeOrderDetails: () => setActiveModalOrder(null),
    handleRepeatOrder,
  };
}
```

### 2.2. Чистый презентационный компонент (`OrdersWorkspaceView.tsx`)
```tsx
export function OrdersWorkspaceView({ initialOrders }: { initialOrders: OrderDto[] }) {
  const { orders, activeModalOrder, openOrderDetails, closeOrderDetails, handleRepeatOrder } = useOrdersWorkspace(initialOrders);

  return (
    <div className="flex flex-col gap-4">
      <OrdersTable orders={orders} onDetails={openOrderDetails} onRepeat={handleRepeatOrder} />
      {activeModalOrder && <OrderDetailsModal order={activeModalOrder} onClose={closeOrderDetails} />}
    </div>
  );
}
```
