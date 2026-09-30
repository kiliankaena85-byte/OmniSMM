# React 19 & Tailwind 4 Architectural Conversion Patterns

When converting Stitch raw DOM to production code, strictly adhere to these patterns:

---

## 1. ClassName Token Remapping (Tailwind 4)

| Stitch Raw Value | Tailwind CSS 4 Replacement | Rationale |
| :--- | :--- | :--- |
| `background: #080b14` | `bg-background` or `bg-[#080b14] dark:bg-black` | Semantic token support |
| `color: #ffffff` | `text-foreground` or `text-white dark:text-slate-100` | Contrast consistency |
| `border: 1px solid #334155` | `border border-border/80` | Adaptive dark/light border |
| `box-shadow: 0 4px 20px ...`| `shadow-sm hover:shadow-md transition-shadow` | Calm design aesthetics |
| `cursor: not-allowed; opacity: 0.5` | `aria-disabled="true"` with interactive tooltip | Never-disabled rule |

---

## 2. React 19 Action-First Pattern

Instead of manual `try/catch` and `isLoading` states, prefer React 19 native hooks:

```tsx
'use client';

import { useActionState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { executePaymentAction } from '@/actions/payment.actions';

export function PaymentCheckoutButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();

  const handlePay = () => {
    startTransition(async () => {
      const res = await executePaymentAction({ orderId });
      if (!res.success) {
        alert(res.error);
      }
    });
  };

  return (
    <button
      onClick={handlePay}
      className="w-full h-14 bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors"
    >
      {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Оплатить заказ →</span>}
    </button>
  );
}
```

---

## 3. High-Density Micro-Ergonomics
- Touch targets: `min-h-[44px]` on mobile devices (`@media (hover: none)`).
- Input font size: `text-base sm:text-sm` to prevent iOS Safari auto-zoom.
- Horizontal scroll prevention: always specify `min-w-0 max-w-full overflow-hidden`.
