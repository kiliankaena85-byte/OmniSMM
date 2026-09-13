# 📐 Layout Overflow Sentry — Отчет проверки вёрстки

**Дата проведения:** 13.09.2026, 10:54:43  
**Вердикт:** **🔴 DEFECTS_DETECTED**  

---

### 📊 Статистика верстки
- **Всего замечаний:** 152
- **🔴 Высокий приоритет (High):** 7
- **🟡 Средний приоритет (Medium):** 145
- **🟢 Низкий приоритет (Low):** 0

---

### 📋 Список найденных участков


#### #1 [SQUASHED_ELEMENT] src/components/dashboard/classic/ClassicDashboardHome.tsx:187
- **Код:** `<Wallet className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #2 [SQUASHED_ELEMENT] src/components/dashboard/classic/ClassicDashboardHome.tsx:220
- **Код:** `<Award className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #3 [SQUASHED_ELEMENT] src/components/dashboard/classic/ClassicDashboardHome.tsx:308
- **Код:** `<Users className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #4 [SQUASHED_ELEMENT] src/components/dashboard/classic/ClassicDashboardHome.tsx:381
- **Код:** `<SocialIcon slug={item.slug} className="w-6 h-6" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #5 [SQUASHED_ELEMENT] src/components/dashboard/classic/ClassicDashboardHome.tsx:442
- **Код:** `<SocialIcon slug={order.service?.category?.network?.slug || 'telegram'} className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #6 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/classic/ClassicDashboardHome.tsx:449
- **Код:** `<h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #7 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/classic/ClassicDashboardHome.tsx:461
- **Код:** `className="inline-flex items-center gap-1.5 hover:text-primary hover:underline truncate max-w-[200px] sm:max-w-[300px] min-h-[36px] sm:min-h-0 py-1"`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #8 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/classic/ClassicDashboardHome.tsx:464
- **Код:** `<span className="truncate">{order.link}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #9 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/classic/ClassicDashboardHome.tsx:556
- **Код:** `<div className="min-h-[44px] flex items-center font-mono text-xs font-bold bg-secondary/80 px-4 py-3 rounded-2xl text-foreground truncate border border-border/80 flex-1 select-all">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #10 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/classic/ClassicDashboardShell.tsx:34
- **Код:** `<span className="truncate tracking-tight font-bold text-sm sm:text-base">SMMplan</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #11 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardHome.tsx:80
- **Код:** `<Wallet className="w-5 h-5 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #12 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardHome.tsx:107
- **Код:** `<RefreshCw className="w-5 h-5 text-primary animate-spin-slow" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #13 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardHome.tsx:112
- **Код:** `Все <ArrowRight className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #14 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/flux/FluxDashboardHome.tsx:150
- **Код:** `<div className="font-bold text-foreground text-sm truncate">{order.service.name}</div>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #15 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardOrderWizard.tsx:633
- **Код:** `<SparklesIcon className="w-4 h-4 text-primary" /> Вставьте ссылку для быстрого определения:`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #16 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardOrderWizard.tsx:762
- **Код:** `<Layers className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #17 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/flux/FluxDashboardOrderWizard.tsx:765
- **Код:** `<span className="font-bold text-foreground text-sm block truncate group-hover:text-primary transition-colors">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #18 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardOrderWizard.tsx:983
- **Код:** `<SparklesIcon className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #19 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardOrderWizard.tsx:1111
- **Код:** `<Wallet className="w-4 h-4 text-emerald-500" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #20 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/flux/FluxDashboardShell.tsx:57
- **Код:** `<span className="truncate tracking-tight font-black">SMMflux</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #21 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/flux/FluxDashboardShell.tsx:124
- **Код:** `<span className="text-xs font-medium text-muted-foreground group-hover:text-foreground max-w-[120px] truncate transition-colors">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #22 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxTransactionsView.tsx:328
- **Код:** `<Icon className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #23 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxTransactionsView.tsx:356
- **Код:** `<ShieldCheck className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #24 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/FluxDock.tsx:48
- **Код:** `<span className="text-xs text-muted-foreground font-semibold max-w-[100px] truncate">{email}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #25 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/FluxOrdersKanban.tsx:115
- **Код:** `className="text-[11px] text-primary hover:underline font-bold truncate max-w-[190px] inline-flex items-center gap-1"`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #26 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/FluxOrdersKanban.tsx:228
- **Код:** `<span className="truncate">{order.error}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #27 [FIXED_WIDTH_HAZARD] src/components/dashboard/FluxOrdersList.tsx:128
- **Код:** `<div className="flex-1 min-w-[180px] space-y-1">`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #28 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/FluxOrdersList.tsx:189
- **Код:** `<p className="text-[9px] text-destructive font-semibold flex items-center gap-0.5 truncate" title={order.error}>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #29 [SQUASHED_ELEMENT] src/components/dashboard/order-wizard/WizardCategoryStep.tsx:54
- **Код:** `<Layers className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #30 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/order-wizard/WizardCategoryStep.tsx:57
- **Код:** `<span className="font-bold text-xs block truncate">{cat.name}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #31 [SQUASHED_ELEMENT] src/components/dashboard/order-wizard/WizardNetworkStep.tsx:40
- **Код:** `<Sparkles className="w-3 h-3" /> Автоопределение: {detectedPlatform}`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #32 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/order-wizard/WizardNetworkStep.tsx:81
- **Код:** `<span className="font-extrabold text-xs truncate max-w-full">{net.name}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #33 [SQUASHED_ELEMENT] src/components/dashboard/order-wizard/WizardServiceStep.tsx:86
- **Код:** `<Zap className="w-3 h-3 text-amber-500" /> {speedInfo}`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #34 [SQUASHED_ELEMENT] src/components/dashboard/order-wizard/WizardServiceStep.tsx:90
- **Код:** `<ShieldCheck className="w-3 h-3" /> Автодокрутка`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #35 [SQUASHED_ELEMENT] src/components/dashboard/prime/PrimeCatalogGrid.tsx:194
- **Код:** `<Flame className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #36 [SQUASHED_ELEMENT] src/components/dashboard/settings/api/ApiReferenceDocs.tsx:76
- **Код:** `<Terminal className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #37 [SQUASHED_ELEMENT] src/components/dashboard/settings/DeleteAccountCard.tsx:139
- **Код:** `<AlertTriangle className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #38 [SQUASHED_ELEMENT] src/components/dashboard/settings/LogoutCard.tsx:29
- **Код:** `<LogOut className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #39 [SQUASHED_ELEMENT] src/components/dashboard/settings/PasswordCard.tsx:79
- **Код:** `<KeyRound className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #40 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:161
- **Код:** `<Send className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #41 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:173
- **Код:** `<AlertCircle className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #42 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:277
- **Код:** `<Bell className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #43 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:414
- **Код:** `<Send className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #44 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:426
- **Код:** `<RefreshCw className="w-6 h-6 animate-spin text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #45 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:440
- **Код:** `<AlertCircle className="w-6 h-6" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #46 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/transactions/TransactionsClient.tsx:179
- **Код:** `<span className="text-[10px] text-foreground select-all font-semibold max-w-[120px] truncate" title={item.id}>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #47 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/transactions/TransactionsClient.tsx:221
- **Код:** `<span className="text-[10px] text-foreground select-all max-w-[180px] truncate" title={item.idempotencyKey}>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #48 [SQUASHED_ELEMENT] src/components/dashboard/transactions/TransactionsClient.tsx:385
- **Код:** `<ArrowUpRight className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #49 [SQUASHED_ELEMENT] src/components/dashboard/transactions/TransactionsClient.tsx:400
- **Код:** `<ArrowDownRight className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #50 [SQUASHED_ELEMENT] src/components/dashboard/transactions/TransactionsClient.tsx:415
- **Код:** `<RefreshCw className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #51 [SQUASHED_ELEMENT] src/components/dashboard/transactions/TransactionsClient.tsx:430
- **Код:** `<Briefcase className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #52 [SQUASHED_ELEMENT] src/components/dashboard/transactions/TransactionsClient.tsx:519
- **Код:** `<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #53 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/transactions/TransactionsClient.tsx:693
- **Код:** `<span className="text-[10px] text-foreground select-all font-semibold max-w-[80px] truncate" title={item.id}>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #54 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/dashboard/transactions/TransactionsClient.tsx:724
- **Код:** `<span className="text-[10px] text-muted-foreground select-all max-w-[90px] truncate" title={item.idempotencyKey}>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #55 [SQUASHED_ELEMENT] src/components/orders/flux/FluxCyberLinkDrawer.tsx:130
- **Код:** `<Zap className="w-6 h-6 animate-pulse" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #56 [SQUASHED_ELEMENT] src/components/orders/flux/FluxCyberLinkDrawer.tsx:201
- **Код:** `<Sparkles className="w-3 h-3 text-pink-400" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #57 [SQUASHED_ELEMENT] src/components/orders/flux/FluxCyberLinkDrawer.tsx:401
- **Код:** `<ScanLine className="w-4 h-4 text-purple-400" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #58 [SQUASHED_ELEMENT] src/components/orders/flux/FluxCyberLinkDrawer.tsx:452
- **Код:** `<ShieldCheck className="w-4 h-4 text-purple-400" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #59 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/LiveOrderProgressDrawer.tsx:49
- **Код:** `<h4 className="text-sm font-semibold text-foreground truncate max-w-[280px]">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #60 [SQUASHED_ELEMENT] src/components/orders/LiveOrderProgressDrawer.tsx:55
- **Код:** `<Sparkles className="w-3 h-3" /> Sentinel AI`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #61 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/LiveOrderProgressDrawer.tsx:61
- **Код:** `<div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #62 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/LiveOrderProgressDrawer.tsx:67
- **Код:** `className="text-primary hover:underline truncate flex items-center gap-1"`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #63 [SQUASHED_ELEMENT] src/components/orders/MobileOrderList.tsx:264
- **Код:** `<LayoutDashboard className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #64 [FIXED_WIDTH_HAZARD] src/components/orders/OrderFilters.tsx:129
- **Код:** `<div className="relative flex-1 min-w-[200px]">`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #65 [SQUASHED_ELEMENT] src/components/orders/OrderFilters.tsx:130
- **Код:** `<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #66 [FIXED_WIDTH_HAZARD] src/components/orders/sub/OrderSummaryCard.tsx:562
- **Код:** `className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #67 [FIXED_WIDTH_HAZARD] src/components/orders/sub/OrderSummaryCard.tsx:573
- **Код:** `className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #68 [FIXED_WIDTH_HAZARD] src/components/orders/sub/OrderSummaryCard.tsx:584
- **Код:** `className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #69 [SQUASHED_ELEMENT] src/components/orders/TelegramLinkGuideModal.tsx:173
- **Код:** `<Info className="w-3 h-3 text-blue-400" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #70 [SQUASHED_ELEMENT] src/components/orders/TelegramLinkGuideModal.tsx:301
- **Код:** `<Layers className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #71 [SQUASHED_ELEMENT] src/components/orders/TelegramLinkGuideModal.tsx:446
- **Код:** `<ShieldCheck className="w-4 h-4 text-emerald-500" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #72 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/UniversalOrderForm.tsx:252
- **Код:** `<div className="truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #73 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/UniversalOrderForm.tsx:253
- **Код:** `<div className="font-semibold text-sm text-foreground truncate flex items-center gap-2">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #74 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/UniversalOrderForm.tsx:255
- **Код:** `<span className="truncate">{task.cleanTitle}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #75 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/UniversalOrderForm.tsx:262
- **Код:** `<span className="text-foreground/80 truncate max-w-[150px] sm:max-w-[250px]">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #76 [SQUASHED_ELEMENT] src/components/orders/wizard/sub/CheckoutDripFeed.tsx:28
- **Код:** `<Sparkles className="w-4 h-4 text-primary" /> Запускать частями (Drip-Feed)`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #77 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/wizard/WizardStepCategory.tsx:52
- **Код:** `<h2 className="text-xl font-bold text-foreground truncate">Шаг 2: Категория ({selectedNetwork?.name})</h2>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #78 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/wizard/WizardStepCategory.tsx:131
- **Код:** `<div className="text-sm font-semibold text-foreground truncate">{cat.name}</div>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #79 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/wizard/WizardStepCheckout.tsx:46
- **Код:** `<span className="text-xs font-semibold text-muted-foreground block truncate">{selectedNetwork?.name} / {selectedCategory?.name}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #80 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/wizard/WizardStepCheckout.tsx:47
- **Код:** `<h3 className="text-sm sm:text-base font-bold text-foreground truncate">{selectedService.name}</h3>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #81 [SQUASHED_ELEMENT] src/components/orders/wizard/WizardStepCheckout.tsx:79
- **Код:** `<label className="text-sm font-bold text-foreground flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" /> {selectedService.customDataLabel || 'Параметры заказа'} <span className="text-destructive">*</span></label>`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #82 [SQUASHED_ELEMENT] src/components/orders/wizard/WizardStepCheckout.tsx:93
- **Код:** `<div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider mb-1"><Sparkles className="w-4 h-4" /> Чек-лист для старта</div>`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #83 [SQUASHED_ELEMENT] src/components/orders/wizard/WizardStepCheckout.tsx:155
- **Код:** `{isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Обработка заказа...</span></> : <><Zap className="w-5 h-5 fill-current" /><span>Оплатить и запустить заказ</span></>}`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #84 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/orders/wizard/WizardStepIndicator.tsx:54
- **Код:** `<span className="hidden md:inline truncate">{s.label}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #85 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/catalog/FullscreenMasterCatalog.tsx:372
- **Код:** `<span className="truncate">{platform.name}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #86 [SQUASHED_ELEMENT] src/components/landing/catalog/FullscreenMasterCatalog.tsx:413
- **Код:** `<Flame className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #87 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/catalog/StepByStepWizard.tsx:188
- **Код:** `<div className="truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #88 [SQUASHED_ELEMENT] src/components/landing/catalog/StepByStepWizard.tsx:469
- **Код:** `<Wallet className="w-4 h-4 text-emerald-500" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #89 [SQUASHED_ELEMENT] src/components/landing/catalog/StepByStepWizard.tsx:489
- **Код:** `<QrCode className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #90 [SQUASHED_ELEMENT] src/components/landing/catalog/StepByStepWizard.tsx:507
- **Код:** `<CreditCard className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #91 [SQUASHED_ELEMENT] src/components/landing/catalog/StepByStepWizard.tsx:525
- **Код:** `<Wallet className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #92 [SQUASHED_ELEMENT] src/components/landing/LandingCatalogContent.tsx:159
- **Код:** `<Box className="w-5 h-5 text-primary/60" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #93 [SQUASHED_ELEMENT] src/components/landing/LandingHeroArea.tsx:85
- **Код:** `<Lock className="w-3 h-3 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #94 [SQUASHED_ELEMENT] src/components/landing/LandingHeroArea.tsx:90
- **Код:** `<ShieldCheck className="w-3 h-3 text-success" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #95 [SQUASHED_ELEMENT] src/components/landing/LandingHeroArea.tsx:95
- **Код:** `<Zap className="w-3 h-3 text-amber-500" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #96 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/drawer/DrawerOrderSummary.tsx:114
- **Код:** `className="text-xs sm:text-sm font-bold text-foreground truncate font-mono"`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #97 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/drawer/DrawerPaymentSelector.tsx:108
- **Код:** `<p className="text-xs text-muted-foreground font-semibold mt-0.5 truncate leading-tight">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #98 [SQUASHED_ELEMENT] src/components/landing/order-engine/DripFeedConfigurator.tsx:70
- **Код:** `<Activity className="w-4 h-4 text-primary" /> Плавное продвижение (Drip-Feed)`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #99 [SQUASHED_ELEMENT] src/components/landing/order-engine/HeroInput.tsx:73
- **Код:** `<Mail className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #100 [SQUASHED_ELEMENT] src/components/landing/order-engine/LegalDocumentModal.tsx:76
- **Код:** `<FileText className="w-5 h-5 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #101 [SQUASHED_ELEMENT] src/components/landing/order-engine/MassConfirmEmailModal.tsx:77
- **Код:** `<ShoppingCart className="w-6 h-6 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #102 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/MobileCatalogModal.tsx:149
- **Код:** `<h2 className="font-bold text-foreground text-base truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #103 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/MobileCatalogModal.tsx:243
- **Код:** `<span className="text-xs font-bold text-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #104 [SQUASHED_ELEMENT] src/components/landing/order-engine/modals/CheckoutAuthModal.tsx:203
- **Код:** `<Lock className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #105 [SQUASHED_ELEMENT] src/components/landing/order-engine/modals/EmailPromptModal.tsx:58
- **Код:** `<Mail className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #106 [SQUASHED_ELEMENT] src/components/landing/order-engine/PaymentGatewaySelectionModal.tsx:190
- **Код:** `<Icon className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #107 [SQUASHED_ELEMENT] src/components/landing/order-engine/PlatformLinkGuideDrawer.tsx:82
- **Код:** `<BookOpen className="w-5 h-5 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #108 [SQUASHED_ELEMENT] src/components/landing/order-engine/PlatformLinkGuideDrawer.tsx:192
- **Код:** `<Copy className="w-3 h-3" /> Copy`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #109 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/ServiceCard.tsx:56
- **Код:** `<div className="flex items-center gap-1.5 truncate text-[10px]">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #110 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/StickyCheckoutTriggerBar.tsx:89
- **Код:** `<p className="text-xs font-black text-foreground truncate max-w-[250px] leading-tight">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #111 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/StickyCheckoutTriggerBar.tsx:94
- **Код:** `<p className="text-[10px] font-bold text-muted-foreground truncate max-w-[150px]">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #112 [SQUASHED_ELEMENT] src/components/landing/order-engine/TariffCard.tsx:108
- **Код:** `<Clock className="w-3 h-3 text-primary/70" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #113 [SQUASHED_ELEMENT] src/components/landing/order-engine/TariffCard.tsx:114
- **Код:** `<Zap className="w-3 h-3 text-amber-500/80" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #114 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/FloatingHudCheckout.tsx:131
- **Код:** `<h4 className="text-xs sm:text-sm font-black text-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #115 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/FloatingHudCheckout.tsx:145
- **Код:** `className="h-10 px-3 rounded-xl bg-content2 hover:bg-content3 border border-border text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer max-w-[140px] sm:max-w-[200px] truncate"`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #116 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/FloatingHudCheckout.tsx:148
- **Код:** `<span className="truncate">{url || "Укажите ссылку"}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #117 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/InCardAccordionCheckout.tsx:79
- **Код:** `<span className="text-xs font-medium text-muted-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #118 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/PlanCheckoutGateways.tsx:88
- **Код:** `<p className="font-extrabold text-xs sm:text-sm text-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #119 [SQUASHED_ELEMENT] src/components/landing/order-engine/variants/PlanCheckoutGateways.tsx:97
- **Код:** `<Check className="w-3 h-3 stroke-[3]" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #120 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/PlanCheckoutHeader.tsx:50
- **Код:** `<span className="font-extrabold text-xs sm:text-sm text-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #121 [SQUASHED_ELEMENT] src/components/landing/order-engine/variants/PlanCheckoutHeader.tsx:70
- **Код:** `<Sparkles className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #122 [SQUASHED_ELEMENT] src/components/landing/order-engine/variants/PlanCheckoutHeader.tsx:117
- **Код:** `<Clock className="w-3 h-3 text-emerald-500" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #123 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/PlanCheckoutHeader.tsx:120
- **Код:** `<p className="font-bold text-xs sm:text-sm text-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #124 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/PlanSlideOrderClient.tsx:483
- **Код:** `<span className="text-xs sm:text-sm font-semibold text-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #125 [SQUASHED_ELEMENT] src/components/landing/order-engine/variants/PlanSlideOrderClient.tsx:539
- **Код:** `<LinkIcon className="text-muted-foreground w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #126 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/PlanSlideOrderClient.tsx:787
- **Код:** `<h4 className="font-bold text-foreground text-sm sm:text-base truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #127 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/QuickTableRowCheckout.tsx:75
- **Код:** `<span className="text-xs font-medium text-muted-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #128 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/StepWizardCheckout.tsx:122
- **Код:** `<span className="text-xs sm:text-sm font-black text-foreground truncate max-w-[240px] sm:max-w-[420px]">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #129 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/StepWizardCheckout.tsx:300
- **Код:** `<span className="text-sm font-bold text-foreground font-mono truncate">{email}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #130 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/StepWizardCheckout.tsx:314
- **Код:** `<span className="font-bold text-foreground truncate max-w-[240px] sm:max-w-[280px]">{selectedService.name}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #131 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/variants/StepWizardCheckout.tsx:323
- **Код:** `<span className="font-mono text-primary truncate max-w-[220px] sm:max-w-[260px]">{url}</span>`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #132 [SQUASHED_ELEMENT] src/components/landing/order-engine/wizard-steps/MobileCheckoutLinkField.tsx:67
- **Код:** `<Pencil className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #133 [SQUASHED_ELEMENT] src/components/landing/order-engine/wizard-steps/MobileCheckoutQuantity.tsx:116
- **Код:** `<Sliders className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #134 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/wizard-steps/MobileStep1DetectionBadge.tsx:28
- **Код:** `<span className="text-[11px] font-bold text-foreground truncate flex items-center gap-1">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #135 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/wizard-steps/MobileStep1Summary.tsx:21
- **Код:** `<span className="text-xs font-bold text-foreground truncate font-mono">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #136 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/wizard-steps/MobileStep1Summary.tsx:40
- **Код:** `<span className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #137 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/wizard-steps/MobileStep2Category.tsx:203
- **Код:** `<span className="text-xs font-bold text-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #138 [SQUASHED_ELEMENT] src/components/landing/order-engine/wizard-steps/MobileStep3Service.tsx:82
- **Код:** `<Lightbulb className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #139 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/wizard-steps/MobileStep3Service.tsx:160
- **Код:** `<span className="text-xs font-bold text-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #140 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/wizard-steps/MobileStickyCTA.tsx:35
- **Код:** `<p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #141 [TRUNCATE_WITHOUT_MIN_W_ZERO] src/components/landing/order-engine/wizard-steps/MobileStickyCTA.tsx:38
- **Код:** `<p className="text-xs font-black text-foreground truncate">`
- **Рекомендация:** Add "min-w-0" to element or flex-parent with "truncate" to allow text shrinkage.


#### #142 [FIXED_WIDTH_HAZARD] src/components/landing/PreLaunchHoldingScreen.tsx:91
- **Код:** `<div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #143 [FIXED_WIDTH_HAZARD] src/components/landing/PreLaunchHoldingScreen.tsx:92
- **Код:** `<div className="absolute top-[15%] right-[10%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[110px] pointer-events-none" />`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #144 [SQUASHED_ELEMENT] src/components/landing/PreLaunchHoldingScreen.tsx:196
- **Код:** `<Sparkles className="w-5 h-5 text-amber-400" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #145 [SQUASHED_ELEMENT] src/components/landing/PreLaunchHoldingScreen.tsx:293
- **Код:** `<Zap className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #146 [SQUASHED_ELEMENT] src/components/landing/PreLaunchHoldingScreen.tsx:303
- **Код:** `<ShieldCheck className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #147 [SQUASHED_ELEMENT] src/components/landing/PreLaunchHoldingScreen.tsx:313
- **Код:** `<Sliders className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #148 [SQUASHED_ELEMENT] src/components/landing/PreLaunchHoldingScreen.tsx:323
- **Код:** `<MessageSquare className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #149 [SQUASHED_ELEMENT] src/components/landing/WhyUs.tsx:35
- **Код:** `<Sparkles className="w-6 h-6" strokeWidth={1.5} />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #150 [SQUASHED_ELEMENT] src/components/landing/WhyUs.tsx:50
- **Код:** `<ShieldCheck className="w-6 h-6" strokeWidth={1.5} />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #151 [SQUASHED_ELEMENT] src/components/landing/WhyUs.tsx:64
- **Код:** `<Diamond className="w-6 h-6" strokeWidth={1.5} />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #152 [SQUASHED_ELEMENT] src/components/landing/WhyUs.tsx:86
- **Код:** `<Sparkles className="w-5 h-5" strokeWidth={1.5} />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.

