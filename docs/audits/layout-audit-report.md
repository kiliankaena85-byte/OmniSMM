# 📐 Layout Overflow Sentry — Отчет проверки вёрстки

**Дата проведения:** 25.09.2026, 03:03:03  
**Вердикт:** **🟡 WARNINGS**  

---

### 📊 Статистика верстки
- **Всего замечаний:** 11
- **🔴 Высокий приоритет (High):** 0
- **🟡 Средний приоритет (Medium):** 11
- **🟢 Низкий приоритет (Low):** 0

---

### 📋 Список найденных участков


#### #1 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/balance/BalanceDisplay.tsx:38
- **Код:** `<span className="text-[11px] sm:text-xs font-black font-mono tabular-nums tracking-tight sm:tracking-wide truncate max-w-[95px] sm:max-w-none" title={balance}>{balance}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #2 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/classic/ClassicDashboardHome.tsx:188
- **Код:** `<span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #3 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/classic/ClassicDashboardHome.tsx:221
- **Код:** `<span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #4 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/classic/ClassicDashboardHome.tsx:269
- **Код:** `<span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #5 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/classic/ClassicDashboardHome.tsx:309
- **Код:** `<span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #6 [SQUASHED_ELEMENT] src/components/dashboard/settings/SettingsTabsClient.tsx:123
- **Код:** `<Key className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #7 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/transactions/TransactionsClient.tsx:611
- **Код:** `<span className="truncate max-w-[170px]" title={item.reason}>{item.reason}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #8 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/DesktopOrderCards.tsx:128
- **Код:** `className="text-primary hover:underline truncate max-w-[220px] font-medium"`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #9 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/DesktopOrderTable.tsx:146
- **Код:** `className="text-primary hover:underline text-xs max-w-[180px] truncate font-medium"`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #10 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/wizard-steps/MobileCheckoutOrderSummary.tsx:81
- **Код:** `<span className="truncate flex items-center gap-2">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #11 [SQUASHED_ELEMENT] src/components/auth/FluxLoginHero.tsx:10
- **Код:** `<Sparkles className="w-6 h-6 animate-pulse" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.

