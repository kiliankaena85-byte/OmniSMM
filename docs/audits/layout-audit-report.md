# 📐 Layout Overflow Sentry — Отчет проверки вёрстки

**Дата проведения:** 13.09.2026, 10:16:38  
**Вердикт:** **🔴 DEFECTS_DETECTED**  

---

### 📊 Статистика верстки
- **Всего замечаний:** 91
- **🔴 Высокий приоритет (High):** 7
- **🟡 Средний приоритет (Medium):** 84
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


#### #6 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardHome.tsx:80
- **Код:** `<Wallet className="w-5 h-5 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #7 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardHome.tsx:107
- **Код:** `<RefreshCw className="w-5 h-5 text-primary animate-spin-slow" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #8 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardHome.tsx:112
- **Код:** `Все <ArrowRight className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #9 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardOrderWizard.tsx:633
- **Код:** `<SparklesIcon className="w-4 h-4 text-primary" /> Вставьте ссылку для быстрого определения:`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #10 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardOrderWizard.tsx:762
- **Код:** `<Layers className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #11 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardOrderWizard.tsx:983
- **Код:** `<SparklesIcon className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #12 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxDashboardOrderWizard.tsx:1111
- **Код:** `<Wallet className="w-4 h-4 text-emerald-500" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #13 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxTransactionsView.tsx:328
- **Код:** `<Icon className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #14 [SQUASHED_ELEMENT] src/components/dashboard/flux/FluxTransactionsView.tsx:356
- **Код:** `<ShieldCheck className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #15 [FIXED_WIDTH_HAZARD] src/components/dashboard/FluxOrdersList.tsx:128
- **Код:** `<div className="flex-1 min-w-[180px] space-y-1">`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #16 [SQUASHED_ELEMENT] src/components/dashboard/order-wizard/WizardCategoryStep.tsx:54
- **Код:** `<Layers className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #17 [SQUASHED_ELEMENT] src/components/dashboard/order-wizard/WizardNetworkStep.tsx:40
- **Код:** `<Sparkles className="w-3 h-3" /> Автоопределение: {detectedPlatform}`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #18 [SQUASHED_ELEMENT] src/components/dashboard/order-wizard/WizardServiceStep.tsx:86
- **Код:** `<Zap className="w-3 h-3 text-amber-500" /> {speedInfo}`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #19 [SQUASHED_ELEMENT] src/components/dashboard/order-wizard/WizardServiceStep.tsx:90
- **Код:** `<ShieldCheck className="w-3 h-3" /> Автодокрутка`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #20 [SQUASHED_ELEMENT] src/components/dashboard/prime/PrimeCatalogGrid.tsx:194
- **Код:** `<Flame className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #21 [SQUASHED_ELEMENT] src/components/dashboard/settings/api/ApiReferenceDocs.tsx:76
- **Код:** `<Terminal className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #22 [SQUASHED_ELEMENT] src/components/dashboard/settings/DeleteAccountCard.tsx:139
- **Код:** `<AlertTriangle className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #23 [SQUASHED_ELEMENT] src/components/dashboard/settings/LogoutCard.tsx:29
- **Код:** `<LogOut className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #24 [SQUASHED_ELEMENT] src/components/dashboard/settings/PasswordCard.tsx:79
- **Код:** `<KeyRound className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #25 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:161
- **Код:** `<Send className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #26 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:173
- **Код:** `<AlertCircle className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #27 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:277
- **Код:** `<Bell className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #28 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:414
- **Код:** `<Send className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #29 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:426
- **Код:** `<RefreshCw className="w-6 h-6 animate-spin text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #30 [SQUASHED_ELEMENT] src/components/dashboard/settings/TelegramCard.tsx:440
- **Код:** `<AlertCircle className="w-6 h-6" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #31 [SQUASHED_ELEMENT] src/components/dashboard/transactions/TransactionsClient.tsx:385
- **Код:** `<ArrowUpRight className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #32 [SQUASHED_ELEMENT] src/components/dashboard/transactions/TransactionsClient.tsx:400
- **Код:** `<ArrowDownRight className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #33 [SQUASHED_ELEMENT] src/components/dashboard/transactions/TransactionsClient.tsx:415
- **Код:** `<RefreshCw className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #34 [SQUASHED_ELEMENT] src/components/dashboard/transactions/TransactionsClient.tsx:430
- **Код:** `<Briefcase className="w-4 h-4" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #35 [SQUASHED_ELEMENT] src/components/dashboard/transactions/TransactionsClient.tsx:519
- **Код:** `<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #36 [SQUASHED_ELEMENT] src/components/orders/flux/FluxCyberLinkDrawer.tsx:130
- **Код:** `<Zap className="w-6 h-6 animate-pulse" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #37 [SQUASHED_ELEMENT] src/components/orders/flux/FluxCyberLinkDrawer.tsx:201
- **Код:** `<Sparkles className="w-3 h-3 text-pink-400" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #38 [SQUASHED_ELEMENT] src/components/orders/flux/FluxCyberLinkDrawer.tsx:401
- **Код:** `<ScanLine className="w-4 h-4 text-purple-400" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #39 [SQUASHED_ELEMENT] src/components/orders/flux/FluxCyberLinkDrawer.tsx:452
- **Код:** `<ShieldCheck className="w-4 h-4 text-purple-400" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #40 [SQUASHED_ELEMENT] src/components/orders/LiveOrderProgressDrawer.tsx:55
- **Код:** `<Sparkles className="w-3 h-3" /> Sentinel AI`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #41 [SQUASHED_ELEMENT] src/components/orders/MobileOrderList.tsx:264
- **Код:** `<LayoutDashboard className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #42 [FIXED_WIDTH_HAZARD] src/components/orders/OrderFilters.tsx:129
- **Код:** `<div className="relative flex-1 min-w-[200px]">`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #43 [SQUASHED_ELEMENT] src/components/orders/OrderFilters.tsx:130
- **Код:** `<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #44 [FIXED_WIDTH_HAZARD] src/components/orders/sub/OrderSummaryCard.tsx:562
- **Код:** `className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #45 [FIXED_WIDTH_HAZARD] src/components/orders/sub/OrderSummaryCard.tsx:573
- **Код:** `className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #46 [FIXED_WIDTH_HAZARD] src/components/orders/sub/OrderSummaryCard.tsx:584
- **Код:** `className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #47 [SQUASHED_ELEMENT] src/components/orders/TelegramLinkGuideModal.tsx:173
- **Код:** `<Info className="w-3 h-3 text-blue-400" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #48 [SQUASHED_ELEMENT] src/components/orders/TelegramLinkGuideModal.tsx:301
- **Код:** `<Layers className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #49 [SQUASHED_ELEMENT] src/components/orders/TelegramLinkGuideModal.tsx:446
- **Код:** `<ShieldCheck className="w-4 h-4 text-emerald-500" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #50 [SQUASHED_ELEMENT] src/components/orders/wizard/sub/CheckoutDripFeed.tsx:28
- **Код:** `<Sparkles className="w-4 h-4 text-primary" /> Запускать частями (Drip-Feed)`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #51 [SQUASHED_ELEMENT] src/components/orders/wizard/WizardStepCheckout.tsx:79
- **Код:** `<label className="text-sm font-bold text-foreground flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" /> {selectedService.customDataLabel || 'Параметры заказа'} <span className="text-destructive">*</span></label>`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #52 [SQUASHED_ELEMENT] src/components/orders/wizard/WizardStepCheckout.tsx:93
- **Код:** `<div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider mb-1"><Sparkles className="w-4 h-4" /> Чек-лист для старта</div>`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #53 [SQUASHED_ELEMENT] src/components/orders/wizard/WizardStepCheckout.tsx:155
- **Код:** `{isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Обработка заказа...</span></> : <><Zap className="w-5 h-5 fill-current" /><span>Оплатить и запустить заказ</span></>}`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #54 [SQUASHED_ELEMENT] src/components/landing/catalog/FullscreenMasterCatalog.tsx:413
- **Код:** `<Flame className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #55 [SQUASHED_ELEMENT] src/components/landing/catalog/StepByStepWizard.tsx:469
- **Код:** `<Wallet className="w-4 h-4 text-emerald-500" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #56 [SQUASHED_ELEMENT] src/components/landing/catalog/StepByStepWizard.tsx:489
- **Код:** `<QrCode className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #57 [SQUASHED_ELEMENT] src/components/landing/catalog/StepByStepWizard.tsx:507
- **Код:** `<CreditCard className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #58 [SQUASHED_ELEMENT] src/components/landing/catalog/StepByStepWizard.tsx:525
- **Код:** `<Wallet className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #59 [SQUASHED_ELEMENT] src/components/landing/LandingCatalogContent.tsx:159
- **Код:** `<Box className="w-5 h-5 text-primary/60" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #60 [SQUASHED_ELEMENT] src/components/landing/LandingHeroArea.tsx:85
- **Код:** `<Lock className="w-3 h-3 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #61 [SQUASHED_ELEMENT] src/components/landing/LandingHeroArea.tsx:90
- **Код:** `<ShieldCheck className="w-3 h-3 text-success" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #62 [SQUASHED_ELEMENT] src/components/landing/LandingHeroArea.tsx:95
- **Код:** `<Zap className="w-3 h-3 text-amber-500" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #63 [SQUASHED_ELEMENT] src/components/landing/order-engine/DripFeedConfigurator.tsx:70
- **Код:** `<Activity className="w-4 h-4 text-primary" /> Плавное продвижение (Drip-Feed)`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #64 [SQUASHED_ELEMENT] src/components/landing/order-engine/HeroInput.tsx:73
- **Код:** `<Mail className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #65 [SQUASHED_ELEMENT] src/components/landing/order-engine/LegalDocumentModal.tsx:76
- **Код:** `<FileText className="w-5 h-5 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #66 [SQUASHED_ELEMENT] src/components/landing/order-engine/MassConfirmEmailModal.tsx:77
- **Код:** `<ShoppingCart className="w-6 h-6 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #67 [SQUASHED_ELEMENT] src/components/landing/order-engine/modals/CheckoutAuthModal.tsx:203
- **Код:** `<Lock className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #68 [SQUASHED_ELEMENT] src/components/landing/order-engine/modals/EmailPromptModal.tsx:58
- **Код:** `<Mail className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #69 [SQUASHED_ELEMENT] src/components/landing/order-engine/PaymentGatewaySelectionModal.tsx:190
- **Код:** `<Icon className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #70 [SQUASHED_ELEMENT] src/components/landing/order-engine/PlatformLinkGuideDrawer.tsx:82
- **Код:** `<BookOpen className="w-5 h-5 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #71 [SQUASHED_ELEMENT] src/components/landing/order-engine/PlatformLinkGuideDrawer.tsx:192
- **Код:** `<Copy className="w-3 h-3" /> Copy`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #72 [SQUASHED_ELEMENT] src/components/landing/order-engine/TariffCard.tsx:108
- **Код:** `<Clock className="w-3 h-3 text-primary/70" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #73 [SQUASHED_ELEMENT] src/components/landing/order-engine/TariffCard.tsx:114
- **Код:** `<Zap className="w-3 h-3 text-amber-500/80" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #74 [SQUASHED_ELEMENT] src/components/landing/order-engine/variants/PlanCheckoutGateways.tsx:97
- **Код:** `<Check className="w-3 h-3 stroke-[3]" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #75 [SQUASHED_ELEMENT] src/components/landing/order-engine/variants/PlanCheckoutHeader.tsx:70
- **Код:** `<Sparkles className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #76 [SQUASHED_ELEMENT] src/components/landing/order-engine/variants/PlanCheckoutHeader.tsx:117
- **Код:** `<Clock className="w-3 h-3 text-emerald-500" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #77 [SQUASHED_ELEMENT] src/components/landing/order-engine/variants/PlanSlideOrderClient.tsx:539
- **Код:** `<LinkIcon className="text-muted-foreground w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #78 [SQUASHED_ELEMENT] src/components/landing/order-engine/wizard-steps/MobileCheckoutLinkField.tsx:67
- **Код:** `<Pencil className="w-3 h-3" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #79 [SQUASHED_ELEMENT] src/components/landing/order-engine/wizard-steps/MobileCheckoutQuantity.tsx:116
- **Код:** `<Sliders className="w-4 h-4 text-primary" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #80 [SQUASHED_ELEMENT] src/components/landing/order-engine/wizard-steps/MobileStep3Service.tsx:82
- **Код:** `<Lightbulb className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #81 [FIXED_WIDTH_HAZARD] src/components/landing/PreLaunchHoldingScreen.tsx:91
- **Код:** `<div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #82 [FIXED_WIDTH_HAZARD] src/components/landing/PreLaunchHoldingScreen.tsx:92
- **Код:** `<div className="absolute top-[15%] right-[10%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[110px] pointer-events-none" />`
- **Рекомендация:** Add "max-w-full" or move fixed width behind responsive prefix (e.g., "w-full sm:w-[...px]").


#### #83 [SQUASHED_ELEMENT] src/components/landing/PreLaunchHoldingScreen.tsx:196
- **Код:** `<Sparkles className="w-5 h-5 text-amber-400" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #84 [SQUASHED_ELEMENT] src/components/landing/PreLaunchHoldingScreen.tsx:293
- **Код:** `<Zap className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #85 [SQUASHED_ELEMENT] src/components/landing/PreLaunchHoldingScreen.tsx:303
- **Код:** `<ShieldCheck className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #86 [SQUASHED_ELEMENT] src/components/landing/PreLaunchHoldingScreen.tsx:313
- **Код:** `<Sliders className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #87 [SQUASHED_ELEMENT] src/components/landing/PreLaunchHoldingScreen.tsx:323
- **Код:** `<MessageSquare className="w-5 h-5" />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #88 [SQUASHED_ELEMENT] src/components/landing/WhyUs.tsx:35
- **Код:** `<Sparkles className="w-6 h-6" strokeWidth={1.5} />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #89 [SQUASHED_ELEMENT] src/components/landing/WhyUs.tsx:50
- **Код:** `<ShieldCheck className="w-6 h-6" strokeWidth={1.5} />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #90 [SQUASHED_ELEMENT] src/components/landing/WhyUs.tsx:64
- **Код:** `<Diamond className="w-6 h-6" strokeWidth={1.5} />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.


#### #91 [SQUASHED_ELEMENT] src/components/landing/WhyUs.tsx:86
- **Код:** `<Sparkles className="w-5 h-5" strokeWidth={1.5} />`
- **Рекомендация:** Add "shrink-0" to icon to prevent element squashing on narrow viewports.

