# 🔍 AUDIT_PACKAGE_2_RECON.md
## Пакет разведки архитектуры платформы Flux / SMMplan

**Проект:** Multi-Tenant SMM Platform (Flux / SMMplan / Lovable)  
**Дата:** 28 июля 2026 г.  
**Инженер:** Senior Frontend & System Engineer (Antigravity AI)  
**Назначение:** Полная сводка структуры проекта для внешнего аудитора перед волнами 1–6.

---

## 1. Дерево файлов исходного кода (`src` & `prisma`)

### A. Файлы TypeScript / React в `src` (688 файлов)
```text
src/__tests__/balance-policy.test.ts
src/__tests__/rub-to-kopecks.test.ts
src/actions/__tests__/knowledge.test.ts
src/actions/admin/__tests__/routing-comparison.test.ts
src/actions/admin/analytics.action.ts
src/actions/admin/balance-adjustments.ts
src/actions/admin/balance-policy.ts
src/actions/admin/catalog.ts
src/actions/admin/catalog/__tests__/categories-ops.test.ts
src/actions/admin/catalog/__tests__/services-crud.test.ts
src/actions/admin/catalog/batch.ts
src/actions/admin/catalog/categories.ts
src/actions/admin/catalog/enrichment.ts
src/actions/admin/catalog/price-drift.ts
src/actions/admin/catalog/services.ts
src/actions/admin/catalog/soft-delete.ts
src/actions/admin/clients.ts
src/actions/admin/content.ts
src/actions/admin/feature-flags.ts
src/actions/admin/finance/ledger.ts
src/actions/admin/finance/payments.ts
src/actions/admin/health.ts
src/actions/admin/marketing.ts
src/actions/admin/orders.ts
src/actions/admin/providers/__tests__/import-cherry-pick.test.ts
src/actions/admin/providers/__tests__/sync-provider-catalog.test.ts
src/actions/admin/providers/crud.ts
src/actions/admin/providers/import-cherry-pick.ts
src/actions/admin/providers/sync-action.ts
src/actions/admin/refills.ts
src/actions/admin/routing.actions.ts
src/actions/admin/search.ts
src/actions/admin/settings.ts
src/actions/admin/smart.ts
src/actions/admin/team.ts
src/actions/admin/test-mode.actions.ts
src/actions/admin/users.ts
src/actions/auth/__tests__/password-login.test.ts
src/actions/auth/__tests__/password-register.test.ts
src/actions/auth/__tests__/request-magic-link.test.ts
src/actions/auth/api-key.ts
src/actions/auth/delete-account.ts
src/actions/auth/password-login.ts
src/actions/auth/password-register.ts
src/actions/auth/password-settings.ts
src/actions/auth/refresh-balance.ts
src/actions/auth/request-magic-link.ts
src/actions/finance/settings.ts
src/actions/knowledge.ts
src/actions/operator/dashboard/get-operator-dashboard.action.ts
src/actions/operator/orders/cancel-order.action.ts
src/actions/operator/orders/restart-order.action.ts
src/actions/operator/tickets/change-status.action.ts
src/actions/operator/tickets/reply-ticket.action.ts
src/actions/operator/transactions/get-transactions-list.action.ts
src/actions/operator/users/create-user-note.action.ts
src/actions/operator/users/get-user-financial-summary.action.ts
src/actions/operator/users/get-users-list.action.ts
src/actions/order/__tests__/checkout.test.ts
src/actions/order/__tests__/r1-advanced-order-params.challenge.test.ts
src/actions/order/__tests__/r1-advanced-parameters-challenge.test.ts
src/actions/order/__tests__/r2-refill-challenge.test.ts
src/actions/order/__tests__/refill.test.ts
src/actions/order/analyze-url.ts
src/actions/order/cancel.ts
src/actions/order/catalog.ts
src/actions/order/checkout.ts
src/actions/order/legal.ts
src/actions/order/mass.ts
src/actions/order/refill.ts
src/actions/order/smart.ts
src/actions/order/sync-payment.ts
src/actions/support/__tests__/guest.test.ts
src/actions/support/__tests__/offline-ticket.test.ts
src/actions/support/compensation.ts
src/actions/support/guest.ts
src/actions/support/offline-ticket.ts
src/actions/support/template.ts
src/actions/support/ticket.ts
src/actions/user/__tests__/settings-extra.test.ts
src/actions/user/promo.ts
src/actions/user/referral.action.ts
src/actions/user/settings-extra.ts
src/actions/user/settings-extra.types.ts
src/actions/user/top-up.action.ts
src/app/(auth)/login/login-form.tsx
src/app/(auth)/login/page.tsx
src/app/ab-lovable/page.tsx
src/app/academy/[slug]/page.tsx
src/app/academy/page.tsx
src/app/admin/analytics/ltv-charts.tsx
src/app/admin/analytics/page.tsx
src/app/admin/analytics/tables.tsx
src/app/admin/catalog/categories/components/category-manager.tsx
src/app/admin/catalog/categories/page.tsx
src/app/admin/catalog/drift/drift-client.tsx
src/app/admin/catalog/drift/page.tsx
src/app/admin/catalog/enrichment/client-table.tsx
src/app/admin/catalog/enrichment/page.tsx
src/app/admin/catalog/layout.tsx
src/app/admin/catalog/page.tsx
src/app/admin/catalog/quarantine/page.tsx
src/app/admin/catalog/quarantine/quarantine-client.tsx
src/app/admin/clients/[id]/client-detail-client.tsx
src/app/admin/clients/[id]/client-orders-table.tsx
src/app/admin/clients/[id]/page.tsx
src/app/admin/clients/components/client-table.tsx
src/app/admin/clients/components/columns.tsx
src/app/admin/clients/loading.tsx
src/app/admin/clients/page.tsx
src/app/admin/cms/[id]/page.tsx
src/app/admin/cms/new/page.tsx
src/app/admin/cms/page.tsx
src/app/admin/dashboard/PeriodSelector.tsx
src/app/admin/dashboard/ProviderLiquidityWidget.tsx
src/app/admin/dashboard/financial-chart.tsx
src/app/admin/dashboard/layout.tsx
src/app/admin/dashboard/loading.tsx
src/app/admin/dashboard/orders-chart.tsx
src/app/admin/dashboard/page.tsx
src/app/admin/dashboard/recent-audit-table.tsx
src/app/admin/error.tsx
src/app/admin/finance/balance-requests/page.tsx
src/app/admin/finance/balance-requests/stats/page.tsx
src/app/admin/finance/error.tsx
src/app/admin/finance/finance-client.tsx
src/app/admin/finance/finance-settings-form.tsx
src/app/admin/finance/layout.tsx
src/app/admin/finance/ledger-columns.tsx
src/app/admin/finance/page.tsx
src/app/admin/finance/payment-columns.tsx
src/app/admin/finance/payments/[id]/dispute-pack/page.tsx
src/app/admin/finance/quarantine-list.tsx
src/app/admin/finance/vat-threshold-widget.tsx
src/app/admin/forbidden/page.tsx
src/app/admin/knowledge/ArticleForm.tsx
src/app/admin/knowledge/DeleteArticleButton.tsx
src/app/admin/knowledge/[id]/edit/page.tsx
src/app/admin/knowledge/create/page.tsx
src/app/admin/knowledge/page.tsx
src/app/admin/layout.tsx
src/app/admin/loading.tsx
src/app/admin/manual/page.tsx
src/app/admin/marketing/client-referrers-table.tsx
src/app/admin/marketing/client-tabs.tsx
src/app/admin/marketing/create-promo-form.tsx
src/app/admin/marketing/layout.tsx
src/app/admin/marketing/page.tsx
src/app/admin/marketing/payout-button.tsx
src/app/admin/marketing/promocode-columns.tsx
src/app/admin/marketing/promocode-table.tsx
src/app/admin/marketing/referral-chart.tsx
src/app/admin/orders/components/columns.tsx
src/app/admin/orders/components/lovable-orders-grid.tsx
src/app/admin/orders/components/lovable-orders-kanban.tsx
src/app/admin/orders/components/order-client.tsx
src/app/admin/orders/components/orders-filter-form.tsx
src/app/admin/orders/error.tsx
src/app/admin/orders/loading.tsx
src/app/admin/orders/page.tsx
src/app/admin/page.tsx
src/app/admin/pages/[slug]/page.tsx
src/app/admin/pages/client-table.tsx
src/app/admin/pages/layout.tsx
src/app/admin/pages/page.tsx
src/app/admin/providers/[id]/page.tsx
src/app/admin/providers/client-table.tsx
src/app/admin/providers/components/provider-balance-cell.tsx
src/app/admin/providers/components/provider-form.tsx
src/app/admin/providers/components/sync-provider-button.tsx
src/app/admin/providers/import/components/confirmation-modal.tsx
src/app/admin/providers/import/components/import-wizard.tsx
src/app/admin/providers/import/components/services-table.tsx
src/app/admin/providers/import/components/summary-dashboard.tsx
src/app/admin/providers/import/page.tsx
src/app/admin/providers/layout.tsx
src/app/admin/providers/new/page.tsx
src/app/admin/providers/page.tsx
src/app/admin/refills/client-table.tsx
src/app/admin/refills/page.tsx
src/app/admin/services/[id]/routing/page.tsx
src/app/admin/services/loading.tsx
src/app/admin/settings/audit-columns.tsx
src/app/admin/settings/balance-policies/page.tsx
src/app/admin/settings/catalog-settings.tsx
src/app/admin/settings/general-settings.tsx
src/app/admin/settings/integrations-settings.tsx
src/app/admin/settings/layout.tsx
src/app/admin/settings/page.tsx
src/app/admin/settings/support-templates.tsx
src/app/admin/settings/team-management.tsx
src/app/admin/smart/page.tsx
src/app/admin/smart/smart-client.tsx
src/app/admin/system/features/feature-flags-client.tsx
src/app/admin/system/features/page.tsx
src/app/admin/tickets/[id]/page.tsx
src/app/admin/tickets/components/attached-orders-grid.tsx
src/app/admin/tickets/components/tickets-sidebar.tsx
src/app/admin/tickets/components/unified-workspace.tsx
src/app/admin/tickets/page.tsx
src/app/api/admin/export/route.ts
src/app/api/admin/upload-branding/route.ts
src/app/api/analytics/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/verify/route.ts
src/app/api/cron/sync-cbr/route.ts
src/app/api/cron/sync-orders/route.ts
src/app/api/debug/route.ts
src/app/api/dev/login-direct/route.ts
src/app/api/dev/mock-payment/route.ts
src/app/api/dev/mock-provider/route.ts
src/app/api/dev/sandbox/yookassa/route.ts
src/app/api/dev/switch-tenant/route.ts
src/app/api/dev/test-checkout/route.ts
src/app/api/dev/test-magic-link/route.ts
src/app/api/draft/disable/route.ts
src/app/api/draft/route.ts
src/app/api/health/route.ts
src/app/api/internal/revalidate/route.ts
src/app/api/maintenance-status/route.ts
src/app/api/media/[...path]/route.ts
src/app/api/order-status/route.ts
src/app/api/payments/[id]/status/route.ts
src/app/api/support/chat/stream/route.ts
src/app/api/support/messages/route.ts
src/app/api/support/telegram/route.ts
src/app/api/support/upload/route.ts
src/app/api/v2/route.ts
src/app/api/webhooks/crypto/route.ts
src/app/api/webhooks/inbound-email/route.ts
src/app/api/webhooks/provider/route.ts
src/app/api/webhooks/robokassa/route.ts
src/app/api/webhooks/vexboost/route.ts
src/app/api/webhooks/yookassa/route.ts
src/app/client-demo/components/dashboards.tsx
src/app/client-demo/components/flux-views.tsx
src/app/client-demo/components/plan-views.tsx
src/app/client-demo/flux/[tab]/page.tsx
src/app/client-demo/flux/page.tsx
src/app/client-demo/page.tsx
src/app/client-demo/plan/[tab]/page.tsx
src/app/client-demo/plan/page.tsx
src/app/dashboard/add-funds/client-page.tsx
src/app/dashboard/add-funds/loading.tsx
src/app/dashboard/add-funds/page.tsx
src/app/dashboard/error.tsx
src/app/dashboard/layout.tsx
src/app/dashboard/loading.tsx
src/app/dashboard/new-order/client-page.tsx
src/app/dashboard/new-order/page.tsx
src/app/dashboard/orders/[id]/page.tsx
src/app/dashboard/orders/loading.tsx
src/app/dashboard/orders/page.tsx
src/app/dashboard/page.tsx
src/app/dashboard/referrals/page.tsx
src/app/dashboard/referrals/referral-ui.tsx
src/app/dashboard/settings/api/ApiKeyManager.tsx
src/app/dashboard/settings/api/page.tsx
src/app/dashboard/settings/page.tsx
src/app/dashboard/sidebar-nav.tsx
src/app/dashboard/smart-drip/page.tsx
src/app/dashboard/smart-drip/smart-client.tsx
src/app/dashboard/tickets/[id]/page.tsx
src/app/dashboard/tickets/page.tsx
src/app/dashboard/transactions/page.tsx
src/app/error.tsx
src/app/global-error.tsx
src/app/knowledge/[slug]/UrlMatcherWidget.tsx
src/app/knowledge/[slug]/page.tsx
src/app/knowledge/components/SearchAutocomplete.tsx
src/app/knowledge/page.tsx
src/app/layout.tsx
src/app/legal/[slug]/page.tsx
src/app/legal/privacy/page.tsx
src/app/legal/refund/page.tsx
src/app/legal/terms/page.tsx
src/app/not-found.tsx
src/app/operator/dashboard/components/failed-orders.tsx
src/app/operator/dashboard/components/urgent-tickets.tsx
src/app/operator/dashboard/page.tsx
src/app/operator/layout.tsx
src/app/operator/orders/components/orders-filter.tsx
src/app/operator/orders/components/orders-table.tsx
src/app/operator/orders/page.tsx
src/app/operator/page.tsx
src/app/operator/tickets/components/ticket-chat.tsx
src/app/operator/tickets/components/tickets-sidebar.tsx
src/app/operator/tickets/components/tickets-workspace.tsx
src/app/operator/tickets/page.tsx
src/app/operator/transactions/components/transactions-filter.tsx
src/app/operator/transactions/components/transactions-table.tsx
src/app/operator/transactions/page.tsx
src/app/operator/users/[userId]/components/notes-tab.tsx
src/app/operator/users/[userId]/components/overview-tab.tsx
src/app/operator/users/[userId]/page.tsx
src/app/operator/users/page.tsx
src/app/operator/users/users-table.tsx
src/app/p/[slug]/page.tsx
src/app/page.tsx
src/app/payment-redirect/page.tsx
src/app/providers.tsx
src/app/robots.ts
src/app/services/[network]/[category]/page.tsx
src/app/services/[network]/page.tsx
src/app/services/error.tsx
src/app/services/loading.tsx
src/app/services/page.tsx
src/app/sitemap.ts
src/app/success/SuccessContent.tsx
src/app/success/page.tsx
src/app/support/page.tsx
src/app/support/payment-error/page.tsx
src/bot/bot.test.ts
src/bot/index.ts
src/bot/scenes/deposit.wizard.ts
src/bot/scenes/order.wizard.ts
src/bot/scenes/referral.wizard.ts
src/bot/utils/formatter.ts
src/components/ThemeSwitcher.tsx
src/components/ab-test/LovableFAQ.tsx
src/components/ab-test/LovableOrderClient.tsx
src/components/ab-test/LovableReviews.tsx
src/components/ab-test/LovableTrustBar.tsx
src/components/ab-test/LovableWhyUs.tsx
src/components/admin/OrderDrawer.tsx
src/components/admin/PrintButton.tsx
src/components/admin/action-form.tsx
src/components/admin/balance/BalanceAdjustmentDrawer.tsx
src/components/admin/balance/BalanceAdjustmentRequestForm.tsx
src/components/admin/bulk-actions/BulkActionsPanel.tsx
src/components/admin/catalog-table-v2.tsx
src/components/admin/catalog/PriceHistoryChart.tsx
src/components/admin/catalog/batch-action-bar.tsx
src/components/admin/catalog/provider-service-search-modal.tsx
src/components/admin/cms/BlockNoteEditor.tsx
src/components/admin/cms/CMSForm.tsx
src/components/admin/cms/CMSTable.tsx
src/components/admin/cms/DynamicEditor.tsx
src/components/admin/command-menu.tsx
src/components/admin/command-palette.tsx
src/components/admin/filters/QuickFilterChips.tsx
src/components/admin/filters/SmartSearch.tsx
src/components/admin/hero-ui.tsx
src/components/admin/lovable-catalog-bento.tsx
src/components/admin/lovable-catalog-grid.tsx
src/components/admin/navigation-data.ts
src/components/admin/page-header.tsx
src/components/admin/routing/ProviderComparisonHub.tsx
src/components/admin/routing/RoutingPanelClient.tsx
src/components/admin/shells/lovable-shell.tsx
src/components/admin/shells/smmplan-shell.tsx
src/components/admin/shells/types.ts
src/components/admin/sidebar.tsx
src/components/admin/submit-button.tsx
src/components/admin/tabbed-header-client.tsx
src/components/admin/tabbed-header.tsx
src/components/admin/tenant-selector.tsx
src/components/admin/test-mode-panel.tsx
src/components/dashboard/LovableDock.tsx
src/components/dashboard/LovableNewOrderWorkspace.tsx
src/components/dashboard/LovableOrdersKanban.tsx
src/components/dashboard/LovableOrdersList.tsx
src/components/dashboard/balance/BalanceDisplay.tsx
src/components/dashboard/classic/ClassicDashboardHome.tsx
src/components/dashboard/classic/ClassicDashboardShell.tsx
src/components/dashboard/lovable/LovableDashboardHome.tsx
src/components/dashboard/lovable/LovableDashboardShell.tsx
src/components/dashboard/lovable/LovableOrdersView.tsx
src/components/dashboard/order-wizard/WizardCategoryStep.tsx
src/components/dashboard/order-wizard/WizardNetworkStep.tsx
src/components/dashboard/order-wizard/WizardServiceStep.tsx
src/components/dashboard/order-wizard/WizardStepIndicator.tsx
src/components/dashboard/settings/B2bWebhookCard.tsx
src/components/dashboard/settings/CompanyRequisitesCard.tsx
src/components/dashboard/settings/Consent152FzCard.tsx
src/components/dashboard/settings/DeleteAccountCard.tsx
src/components/dashboard/settings/PasswordCard.tsx
src/components/dashboard/settings/TelegramCard.tsx
src/components/dashboard/settings/api/ApiDashboardClient.tsx
src/components/dashboard/settings/api/ApiReferenceDocs.tsx
src/components/dashboard/settings/api/ApiReferenceDocsData.ts
src/components/dashboard/transactions/TransactionsClient.tsx
src/components/landing/FAQ.tsx
src/components/landing/Header.tsx
src/components/landing/MegaFooter.tsx
src/components/landing/Reviews.tsx
src/components/landing/SmartLinkLanding.tsx
src/components/landing/TrustBar.tsx
src/components/landing/WhyUs.tsx
src/components/landing/order-engine/CategorySidebar.tsx
src/components/landing/order-engine/DripFeedConfigurator.tsx
src/components/landing/order-engine/DynamicPayloadWarnings.tsx
src/components/landing/order-engine/FullscreenCheckoutVariantC.tsx
src/components/landing/order-engine/HeroInput.tsx
src/components/landing/order-engine/InlineCheckoutForm.tsx
src/components/landing/order-engine/LegalCheckbox.tsx
src/components/landing/order-engine/LegalDocumentModal.tsx
src/components/landing/order-engine/LinkModal.tsx
src/components/landing/order-engine/MassConfirmEmailModal.tsx
src/components/landing/order-engine/MobileCatalogModal.tsx
src/components/landing/order-engine/MobileWizard.tsx
src/components/landing/order-engine/NetworkSelector.tsx
src/components/landing/order-engine/PaymentGatewaySelectionModal.tsx
src/components/landing/order-engine/PlatformLinkGuideData.ts
src/components/landing/order-engine/PlatformLinkGuideDrawer.tsx
src/components/landing/order-engine/ServiceCard.tsx
src/components/landing/order-engine/ServiceGrid.tsx
src/components/landing/order-engine/StickyCheckoutTriggerBar.tsx
src/components/landing/order-engine/TariffCard.tsx
src/components/landing/order-engine/VisualLinkGuideModal.tsx
src/components/landing/order-engine/drawer/CheckoutDrawer.tsx
src/components/landing/order-engine/drawer/DrawerFooter.tsx
src/components/landing/order-engine/drawer/DrawerFormInputs.tsx
src/components/landing/order-engine/drawer/DrawerOrderSummary.tsx
src/components/landing/order-engine/drawer/DrawerPaymentSelector.tsx
src/components/landing/order-engine/drawer/DrawerQuantityCard.tsx
src/components/landing/order-engine/guides/GuideFooter.tsx
src/components/landing/order-engine/guides/GuideSteps.tsx
src/components/landing/order-engine/guides/GuideTabs.tsx
src/components/landing/order-engine/guides/getInstagramSteps.tsx
src/components/landing/order-engine/guides/getTelegramSteps.tsx
src/components/landing/order-engine/guides/getVkSteps.tsx
src/components/landing/order-engine/guides/types.ts
src/components/landing/order-engine/useCheckoutOrchestrator.ts
src/components/landing/order-engine/warnings/CustomFieldWarning.tsx
src/components/landing/order-engine/warnings/GeneralWarnings.tsx
src/components/landing/order-engine/warnings/TelegramWarnings.tsx
src/components/landing/order-engine/warnings/ValidationWarning.tsx
src/components/landing/order-engine/warnings/WarningConfirmation.tsx
src/components/landing/order-engine/wizard-steps/MobileStep1Link.tsx
src/components/landing/order-engine/wizard-steps/MobileStep2Category.tsx
src/components/landing/order-engine/wizard-steps/MobileStep3Service.tsx
src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx
src/components/landing/order-engine/wizard-steps/MobileStickyCTA.tsx
src/components/landing/order-engine/wizard-steps/useMobileWizard.ts
src/components/legal/LegalPageContent.tsx
src/components/operator/shell/operator-content-shell.tsx
src/components/operator/shell/operator-sidebar.tsx
src/components/operator/shell/operator-topbar.tsx
src/components/orders/CancelOrderButton.tsx
src/components/orders/ChargeBreakdownModal.tsx
src/components/orders/DripFeedProgress.tsx
src/components/orders/DripFeedSettings.tsx
src/components/orders/MobileOrderList.tsx
src/components/orders/OrderFilters.tsx
src/components/orders/OrderProgressBar.tsx
src/components/orders/PaymentAutoSync.tsx
src/components/orders/PlatformSelectorFallback.tsx
src/components/orders/RefillRequestButton.tsx
src/components/orders/RepeatOrderButton.tsx
src/components/orders/RetryPaymentModal.tsx
src/components/orders/SmartOrderForm.tsx
src/components/orders/SmmplanOrderWizard.tsx
src/components/orders/UnifiedOrderWizard.tsx
src/components/orders/UniversalOrderForm.tsx
src/components/orders/sub/CategorySelector.tsx
src/components/orders/sub/LinkInputField.tsx
src/components/orders/sub/NetworkSelector.tsx
src/components/orders/sub/OrderSummaryCard.tsx
src/components/providers/MaintenanceGuardian.tsx
src/components/providers/NetworkAwareProvider.tsx
src/components/seo/FAQSection.tsx
src/components/seo/JsonLd.tsx
src/components/settings/ApiKeyCard.tsx
src/components/settings/B2bWebhookCard.tsx
src/components/settings/CompanyRequisitesCard.tsx
src/components/settings/Consent152FzCard.tsx
src/components/settings/index.ts
src/components/support/ChatWindow.tsx
src/components/support/ClientProfileSidebar.tsx
src/components/support/CopyDetailsButton.tsx
src/components/support/GuestSupportOptions.tsx
src/components/support/ManualRefillModal.tsx
src/components/support/TemplateCommandPalette.tsx
src/components/support/TemplateManagerModal.tsx
src/components/support/TicketActionsDropdown.tsx
src/components/support/chat/ChatInput.tsx
src/components/support/chat/ChatMessageList.tsx
src/components/support/chat/ChatTemplateManager.tsx
src/components/support/chat/ImageZoomModal.tsx
src/components/support/chat/useChatMessages.ts
src/components/support/chat/useChatSSE.ts
src/components/ui/CategoryIcon.tsx
src/components/ui/CopyText.tsx
src/components/ui/MaintenanceScreen.tsx
src/components/ui/SocialIcon.tsx
src/components/ui/badge.tsx
src/components/ui/button.tsx
src/components/ui/card.tsx
src/components/ui/checkbox.tsx
src/components/ui/client-date.tsx
src/components/ui/command.tsx
src/components/ui/confirm-modal.tsx
src/components/ui/data-table.tsx
src/components/ui/dialog.tsx
src/components/ui/dropdown-menu.tsx
src/components/ui/input-group.tsx
src/components/ui/input.tsx
src/components/ui/label.tsx
src/components/ui/select.tsx
src/components/ui/sheet.tsx
src/components/ui/sonner.tsx
src/components/ui/status-badge.tsx
src/components/ui/table.tsx
src/components/ui/tabs.tsx
src/components/ui/textarea.tsx
src/constants/balance-adjustments.ts
src/hooks/admin/use-catalog.ts
src/hooks/admin/use-orders.ts
src/hooks/useABTest.ts
src/hooks/useMultiOrderEngine.ts
src/hooks/useOrderEngine.ts
src/hooks/useOrderWizard.ts
src/instrumentation.ts
src/lib/__tests__/password.test.ts
src/lib/__tests__/sanitize.test.ts
src/lib/admin-audit.test.ts
src/lib/admin-audit.ts
src/lib/analytics.ts
src/lib/auth/password.ts
src/lib/b2b-auth.ts
src/lib/bigint-serializer.ts
src/lib/circuit-breaker.ts
src/lib/constants/brandColors.ts
src/lib/db.ts
src/lib/financial-constants.ts
src/lib/log-safe.ts
src/lib/logger.ts
src/lib/mime.ts
src/lib/money.ts
src/lib/navigation.ts
src/lib/notifications.ts
src/lib/operator/navigation.ts
src/lib/operator/rbac.ts
src/lib/pagination.ts
src/lib/prisma-tenant-scope.ts
src/lib/queue-manager.ts
src/lib/redis-lock.ts
src/lib/redis.ts
src/lib/revalidate-cache.ts
src/lib/routes.ts
src/lib/safe-action.ts
src/lib/sanitize.ts
src/lib/server/rbac.ts
src/lib/session-edge.ts
src/lib/session.ts
src/lib/settings.ts
src/lib/smtp.test.ts
src/lib/smtp.ts
src/lib/sse-broadcaster.ts
src/lib/ssrf-guard.ts
src/lib/tenant-resolver.ts
src/lib/tenant-scope.ts
src/lib/transactions.ts
src/lib/utils.ts
src/lib/vault.ts
src/lib/webhook-verify.ts
src/middleware.ts
src/services/admin/__tests__/escrow.test.ts
src/services/admin/__tests__/price-drift.test.ts
src/services/admin/__tests__/pricing-recalculation.test.ts
src/services/admin/__tests__/ticket.test.ts
src/services/admin/ai-support.service.ts
src/services/admin/analytics.service.ts
src/services/admin/audit-engine.ts
src/services/admin/balance-policy.service.ts
src/services/admin/catalog.service.ts
src/services/admin/escrow.service.ts
src/services/admin/marketing.service.ts
src/services/admin/order.service.ts
src/services/admin/provider.service.ts
src/services/admin/settings.service.ts
src/services/admin/ticket.service.ts
src/services/admin/user.service.ts
src/services/analyzer/__tests__/link-analyzer-full.test.ts
src/services/analyzer/category-matcher.test.ts
src/services/analyzer/category-matcher.ts
src/services/analyzer/link-analyzer.comprehensive.test.ts
src/services/analyzer/link-analyzer.test.ts
src/services/analyzer/link-analyzer.ts
src/services/analyzer/link-rules.ts
src/services/core/__tests__/tenant-isolation.test.ts
src/services/core/order.service.ts
src/services/core/rate-limit.service.ts
src/services/dripfeed/smart-drip.service.ts
src/services/eta/eta.fuzzing.test.ts
src/services/eta/eta.service.test.ts
src/services/eta/eta.service.ts
src/services/financial/accounting.service.test.ts
src/services/financial/accounting.service.ts
src/services/financial/compensation.service.challenge.test.ts
src/services/financial/compensation.service.test.ts
src/services/financial/compensation.service.ts
src/services/financial/currency.service.ts
src/services/financial/fast-check.pricing.test.ts
src/services/financial/idempotency-keys.ts
src/services/financial/payment-gateway.service.ts
src/services/financial/payment.service.ts
src/services/financial/refund-parallel.test.ts
src/services/financial/refund-policy.service.ts
src/services/financial/refund-policy.ts
src/services/financial/unified-payment.service.test.ts
src/services/financial/unified-payment.service.ts
src/services/financial/wallet-ops.ts
src/services/financial/wallet.service.test.ts
src/services/financial/wallet.service.ts
src/services/legal-war-room/legal-war-room.service.ts
src/services/marketing-utils.ts
src/services/marketing.service.test.ts
src/services/marketing.service.ts
src/services/operator/users/client-financial-summary.query.ts
src/services/operator/users/user-notes.query.ts
src/services/providers/base-provider.ts
src/services/providers/name-tokenizer.service.ts
src/services/providers/post-sync-rules.ts
src/services/providers/provider.service.ts
src/services/providers/quarantine.service.ts
src/services/providers/smart-analyzer.logic.ts
src/services/providers/universal.provider.ts
src/services/support/__tests__/messages-api.test.ts
src/services/support/__tests__/support-bot.test.ts
src/services/support/__tests__/ticket-rate-limit.test.ts
src/services/support/__tests__/ticket.test.ts
src/services/support/sse.service.ts
src/services/support/support-bot.service.ts
src/services/support/ticket.service.ts
src/services/system/cbr-rate.service.ts
src/services/system/feature-flag.service.ts
src/services/users/__tests__/deletion.test.ts
src/services/users/loyalty.service.ts
src/services/users/promo-automation.service.ts
src/tenants/TenantErrorBoundary.tsx
src/tenants/factory.ts
src/tenants/fallback/neutral-maintenance-strategy.tsx
src/tenants/flux/strategy.ts
src/tenants/lovable/strategy.ts
src/tenants/registry.ts
src/tenants/smmplan/strategy.ts
src/tenants/types.ts
src/types/catalog.dto.ts
src/types/flux.ts
src/types/operator/navigation.ts
src/utils/admin-tenant.ts
src/utils/balance-verifier.test.ts
src/utils/balance-verifier.ts
src/utils/brand-styles.ts
src/utils/description-sanitizer.ts
src/utils/error-handler.ts
src/utils/format-eta.test.ts
src/utils/format-eta.ts
src/utils/format-kopecks.ts
src/utils/get-base-url.ts
src/utils/ip.ts
src/utils/link-extractor.ts
src/utils/link-normalizer.test.ts
src/utils/link-normalizer.ts
src/utils/refund.ts
src/utils/security-sanitizer.ts
src/utils/slugify.ts
src/utils/status-helpers.ts
src/utils/target-type.ts
src/utils/ticket-parser.test.ts
src/utils/ticket-parser.ts
src/utils/translation-dictionary.ts
src/utils/url-analyzer.ts
src/validators/__tests__/admin.validators.test.ts
src/validators/admin.validators.ts
src/validators/link-mutators.ts
src/validators/order.validators.ts
src/validators/password-policy.ts
src/workers/index.ts
src/workers/processors/__tests__/cleanup.processor.test.ts
src/workers/processors/__tests__/payment-sync.test.ts
src/workers/processors/__tests__/sync.processor.test.ts
src/workers/processors/article-publish.processor.ts
src/workers/processors/catalog.processor.ts
src/workers/processors/cleanup.processor.ts
src/workers/processors/dripfeed.processor.ts
src/workers/processors/eta.processor.ts
src/workers/processors/order.processor.timeout.test.ts
src/workers/processors/order.processor.ts
src/workers/processors/payment-gateway.processor.ts
src/workers/processors/payment-sync.ts
src/workers/processors/quality-detector.processor.ts
src/workers/processors/refill.processor.ts
src/workers/processors/smart-feedback-loop.processor.ts
src/workers/processors/sync.processor.ts
src/workers/queues.ts
```

### B. Файлы схемы и миграций в `prisma` (32 файлов)
```text
prisma/migrations/20260422203657_build_safety_and_orphans_fix/migration.sql
prisma/migrations/20260430170116_denormalized_pricing_and_staff_budget/migration.sql
prisma/migrations/20260503104435_bigint_and_sla_metrics/migration.sql
prisma/migrations/20260504082858_add_checkout_url_to_payment/migration.sql
prisma/migrations/20260504204518_add_yookassa_test_keys/migration.sql
prisma/migrations/20260518151000_migrate_order_status_to_enum/migration.sql
prisma/migrations/20260518153800_add_inbound_email_webhook_secret/migration.sql
prisma/migrations/20260518160000_migrate_support_fields_to_enums/migration.sql
prisma/migrations/20260518163000_add_message_pagination_index_and_smtp_settings/migration.sql
prisma/migrations/20260518173600_create_message_attachment_model/migration.sql
prisma/migrations/20260518213125_add_email_provider/migration.sql
prisma/migrations/20260519134500_add_security_event/migration.sql
prisma/migrations/20260520001200_add_kyc_and_composite_ledger_index/migration.sql
prisma/migrations/20260520002400_add_ticket_order_relation/migration.sql
prisma/migrations/20260521092000_update_ledger_trigger_for_quarantine/migration.sql
prisma/migrations/20260525000000_add_promo_ads_analytics/migration.sql
prisma/migrations/20260604113700_add_warning_settings/migration.sql
prisma/migrations/20260607164400_sync_schema_and_add_email_verified/migration.sql
prisma/migrations/20260609205500_add_consent_version_to_payment/migration.sql
prisma/migrations/20260611182547_add_robokassa_webhook_password/migration.sql
prisma/migrations/20260611211512_add_compensation_fields/migration.sql
prisma/migrations/20260623065152_add_service_price_history/migration.sql
prisma/migrations/20260624001146_add_ab_variant_to_order_and_payment/migration.sql
prisma/migrations/20260624230335_create_shadow_service_table/migration.sql
prisma/migrations/20260627162908_add_user_note/migration.sql
prisma/migrations/20260705071848_add_ledger_immutability_trigger/migration.sql
prisma/migrations/20260725192000_add_commission_unique_index_and_leftshift_fields/migration.sql
prisma/schema.prisma
prisma/seed-data/vexboost-services.ts
prisma/seed-e2e-services.ts
prisma/seed-mock.ts
prisma/seed.ts
```

---

## 2. `package.json` (Полный текст)

```json
{
  "name": "smmplan",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:debt": "npx knip",
    "typecheck": "tsc --noEmit",
    "postinstall": "prisma generate",
    "test": "dotenv -e .env.test -- vitest run",
    "test:ci": "dotenv -e .env.test -- vitest run --coverage",
    "test:watch": "dotenv -e .env.test -- vitest",
    "test:db": "dotenv -e .env.test -- prisma db push --accept-data-loss",
    "test:tenant": "tsx scripts/test-tenant-resolution.ts",
    "test:e2e": "playwright test",
    "test:e2e:update": "playwright test --update-snapshots",
    "visual-qa": "dotenv -e .env -- tsx scripts/visual-qa.js",
    "visual-qa:compare": "dotenv -e .env -- tsx scripts/visual-qa.js --compare",
    "test:visual": "dotenv -e .env.test -- playwright test e2e/visual-regression.spec.ts",
    "bot": "tsx src/bot/index.ts",
    "bot:dev": "dotenv -e .env -- tsx watch src/bot/index.ts",
    "worker": "tsx src/workers/index.ts",
    "audit:visual": "npx dotenv -e .env tsx scripts/synthetic-ux-lab/visual-audit-cli.ts",
    "db:seed-mock": "tsx prisma/seed-mock.ts",
    "seed:legal": "tsx scripts/seed-legal-cms.ts",
    "seed:graphrag": "dotenv -e .env -- tsx scripts/seed-graphrag-stack.ts",
    "check-balances": "dotenv -e .env -- tsx src/utils/balance-verifier.ts",
    "pixelrag:admin": "dotenv -e .env -- tsx scripts/pixelrag-admin-audit.ts && dotenv -e .env -- tsx scripts/pixelrag-admin-analyze.ts",
    "harness:baseline": "tsx .antigravity/scripts/baseline.ts",
    "harness:validate": "tsx .antigravity/scripts/evidence-validator.ts",
    "harness:scan": "tsx .antigravity/scripts/run-scanners.ts",
    "harness:reconcile": "tsx .antigravity/scripts/reconciliation.ts",
    "harness:test": "tsx .antigravity/scripts/test-runner.ts",
    "harness:evals": "tsx .antigravity/scripts/run-evals.ts",
    "harness:selftest": "vitest run .antigravity/tests/",
    "harness:all": "npm run harness:baseline && npm run harness:scan && npm run harness:reconcile && npm run harness:test && npm run harness:evals",
    "harness:leftshift": "tsx .antigravity/scripts/leftshift/merge-gate.ts",
    "harness:leftshift:rules": "tsx .antigravity/scripts/leftshift/run-rules.ts",
    "harness:leftshift:testgate": "tsx .antigravity/scripts/leftshift/test-gate.ts",
    "harness:leftshift:invariants": "tsx .antigravity/scripts/leftshift/invariant-gate.ts"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@base-ui/react": "^1.4.0",
    "@blocknote/core": "^0.51.0",
    "@blocknote/mantine": "^0.51.0",
    "@blocknote/react": "^0.51.0",
    "@blocknote/server-util": "^0.51.0",
    "@heroui/react": "^3.0.3",
    "@heroui/system": "^2.4.28",
    "@mantine/core": "^9.2.1",
    "@mantine/hooks": "^9.2.1",
    "@prisma/client": "^5.20.0",
    "@radix-ui/react-slot": "^1.2.4",
    "@tanstack/react-table": "^8.21.3",
    "@tanstack/react-virtual": "^3.13.24",
    "bullmq": "^5.76.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "dotenv": "^17.4.2",
    "framer-motion": "^12.38.0",
    "html-react-parser": "^6.1.1",
    "ioredis": "^5.10.1",
    "jose": "^5.9.6",
    "lucide-react": "^0.447.0",
    "next": "^16.2.6",
    "next-themes": "^0.4.6",
    "nodemailer": "^9.0.1",
    "pino": "^10.3.1",
    "prisma": "^5.20.0",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "react-icons": "^5.6.0",
    "recharts": "^3.8.1",
    "resend": "^6.12.3",
    "sanitize-html": "^2.17.4",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "telegraf": "^4.16.3",
    "undici": "^7.28.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.60.0",
    "@tailwindcss/postcss": "^4.2.2",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^20.19.41",
    "@types/node-fetch": "^2.6.13",
    "@types/nodemailer": "^6.4.15",
    "@types/pngjs": "^6.0.5",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/sanitize-html": "^2.16.1",
    "@vitejs/plugin-react": "^6.0.1",
    "@vitest/coverage-v8": "^4.1.4",
    "decimal.js": "^10.6.0",
    "dotenv-cli": "^11.0.0",
    "eslint": "^10.2.0",
    "fast-check": "^4.8.0",
    "jsdom": "^29.0.2",
    "knip": "^6.13.1",
    "node-fetch": "^2.7.0",
    "pixelmatch": "^7.2.0",
    "playwright": "^1.60.0",
    "pngjs": "^7.0.0",
    "postcss": "^8.5.10",
    "tailwindcss": "^4.2.2",
    "tsx": "^4.21.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.58.2",
    "vitest": "^4.1.4"
  },
  "overrides": {
    "postcss": "^8.5.10",
    "nodemailer": "^9.0.1",
    "undici": "^7.28.0",
    "form-data": "^4.0.6",
    "ws": "^8.21.0",
    "markdown-it": "^14.2.0",
    "vite": "^8.1.0",
    "esbuild": "^0.28.1",
    "brace-expansion": "^5.0.6",
    "sharp": "^0.33.5"
  }
}

```

---

## 3. `prisma/schema.prisma` (Полный текст схемы БД)

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String    @id @default(cuid())
  email             String
  passwordHash      String?
  role              String    @default("USER") // USER, SUPPORT, MANAGER, OWNER
  preferredDashboard String   @default("CLASSIC") // "CLASSIC" or "LOVABLE"
  balance           BigInt    @default(0)
  quarantineBalance BigInt    @default(0) // Funds pending Owner approval (Escrow)
  totalSpent        BigInt    @default(0) // Lifetime value in Cents
  personalDiscount  Float     @default(0.0) // Manual discount override in %, max 100
  discountEndsAt    DateTime? // If set — discount expires at this datetime

  // Trust budget (for compensation/refunds by support)
  supportLimitCents      Int      @default(50000) // 500 RUB default trust budget
  supportSpentTodayCents Int      @default(0) // Track daily spending
  supportLastResetAt     DateTime @default(now()) // For auto-reset logic

  apiKeyHash      String? @unique
  referralCode    String? @unique
  referredById    String?
  referralBalance Int     @default(0)
  telegramId      String? // Telegram user ID for omnichannel support routing
  phoneHash       String? @unique // SHA-256 hash of verified Telegram contact
  isKycVerified   Boolean @default(false)
  isEmailVerified Boolean @default(true)
  isActive        Boolean @default(true)
  isDeleted       Boolean @default(false)

  // 152-FZ Compliance (Terms of Service / Privacy Policy agreement tracking)
  tosAcceptedAt   DateTime?
  tosAcceptedIp   String?

  // Operator notes (internal, never visible to client)
  adminNote          String? // Free-form operator note
  adminNoteUpdatedAt DateTime? // When the note was last updated
  adminNoteUpdatedBy String? // Email of operator who wrote the note

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  authTokens      AuthToken[]
  sessions        Session[]
  orders          Order[]
  payments        Payment[]
  tickets         Ticket[]
  auditLogs       AuditLog[]
  ledgerLogs      LedgerEntry[]    @relation("UserLedger")
  invoices        Invoice[]
  smartCampaigns  SmartCampaign[]
  promoCodeUsages PromoCodeUsage[]

  // B2B & Accounting Fields
  companyName  String?
  inn          String?
  kpp          String?
  legalAddress String?

  // Referrals
  referredBy  User?        @relation("ReferralTree", fields: [referredById], references: [id], onDelete: SetNull)
  referrals   User[]       @relation("ReferralTree")
  commissions Commission[] @relation("ReferredCommissions")

  // RBAC
  staffRoleId String?
  staffRole   StaffRole? @relation(fields: [staffRoleId], references: [id], onDelete: SetNull)

  b2bConfig B2bConfig?
  userNotes     UserNote[] @relation("UserNotes")
  authoredNotes UserNote[] @relation("AuthorNotes")

  targetBalanceAdjustments    ManualBalanceAdjustment[] @relation("targetBalanceAdjustments")
  requestedBalanceAdjustments ManualBalanceAdjustment[] @relation("requestedBalanceAdjustments")
  approvedBalanceAdjustments  ManualBalanceAdjustment[] @relation("approvedBalanceAdjustments")
  rejectedBalanceAdjustments  ManualBalanceAdjustment[] @relation("rejectedBalanceAdjustments")

  tenantId String @default("smmplan")

  @@unique([email, tenantId])
  @@index([tenantId])
}

model B2bConfig {
  id               String  @id @default(cuid())
  userId           String  @unique
  user             User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  isB2b            Boolean @default(true)
  prioritySupport  Boolean @default(true) // Выделение и приоритетная поддержка
  webhookUrl       String? // Webhook URL для синхронизации тикетов
  webhookSecret    String? // Секретный ключ подписи вебхуков B2B
  isWebhookActive  Boolean @default(false) // Toggle for webhook status
  customLimitCents Int? // Кастомный лимит компенсаций (если null — лимит не применяется!)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model PromoCode {
  id              String    @id @default(cuid())
  code            String    @unique
  type            String    @default("DISCOUNT") // DISCOUNT (%), VOUCHER (fixed amount)
  discountPercent Float // 10.0 = 10% (used when type=DISCOUNT)
  amount          Int       @default(0) // Fixed amount in Cents (used when type=VOUCHER)
  maxUses         Int       @default(1)
  uses            Int       @default(0)
  isActive        Boolean   @default(true)
  expiresAt       DateTime?
  createdAt       DateTime  @default(now())

  description  String?
  utmSource    String?
  utmMedium    String?
  utmCampaign  String?
  budgetCents  Int              @default(0)
  isSuspicious Boolean          @default(false)
  usages       PromoCodeUsage[]
  orders       Order[]
}

model AuthToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  used      Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Session {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt      DateTime
  userAgent      String?
  ipAddress      String?
  impersonatedBy String? // SD-07: Admin ID who initiated Login-As (null = real session)
  createdAt      DateTime @default(now())

  @@index([userId])
}

model Network {
  id          String       @id @default(cuid())
  name        String       @unique // "Telegram"
  slug        String       @unique // "telegram"
  icon        String? // SVG content or name
  sort        Int          @default(0)
  isActive    Boolean      @default(true)
  tenantId    String       @default("smmplan")
  categories  Category[]
  urlPatterns UrlPattern[] // Link detection patterns
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([tenantId])
}

// URL patterns for link detection (two-level: network + content type)
model UrlPattern {
  id          String   @id @default(cuid())
  networkId   String
  network     Network  @relation(fields: [networkId], references: [id], onDelete: Cascade)
  pattern     String // Regex: e.g. "instagram\\.com\\/p\\/[^/]+"
  contentType String // "profile" | "post" | "reel" | "story" | "video" | "channel" | "channel_post"
  sort        Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([networkId])
}

model Category {
  id             String    @id @default(cuid())
  name           String
  slug           String    @unique @default(cuid())
  networkId      String?
  network        Network?  @relation(fields: [networkId], references: [id], onDelete: Restrict)
  tenantId       String    @default("smmplan")
  sort           Int       @default(0)
  requireWarning Boolean   @default(false)
  warningMessage String?
  analyzerTags   String?   // Comma-separated list of Link Analyzer types (e.g. "private_post,channel")
  services       Service[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([networkId])
  @@index([tenantId])
}

model Service {
  id               String    @id @default(cuid())
  numericId        Int       @unique @default(autoincrement())
  name             String
  description      String? // Public SEO description (shown to clients)
  features         Json? // Structured metadata extracted by AI (geo, speed, warranty)
  categoryId       String
  category         Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  tenantId         String    @default("smmplan")
  providerId       String? // Link to Provider who fulfills this service
  provider         Provider? @relation(fields: [providerId], references: [id], onDelete: SetNull)
  rate             Float // provider rate per 1000
  providerCurrency String    @default("USD") // Dual-Ledger: tracks original currency of rate
  markup           Float     @default(3.0) // 300% markup
  anomalyScore     Int       @default(0) // Data Intelligence: 0-100 score for suspicious provider claims
  minQty           Int       @default(10)
  maxQty           Int       @default(100000)
  externalId       String? // mapped ID to provider
  dataHash         String? // MD5 for diff-sync
  lastSeenAt       DateTime? // Last time provider confirmed this service exists

  // API v2 feature flags
  isDripFeedEnabled Boolean @default(true)
  isRefillEnabled   Boolean @default(false)
  isCancelEnabled   Boolean @default(false)

  // Quarantine: price spike isolation & Elastic Quarantine
  // When rate changes > quarantineThreshold% → service goes QUARANTINE status
  isQuarantined    Boolean   @default(false)
  pendingRate      Float? // Proposed new rate awaiting admin approval
  quarantineReason String? // Human-readable reason: "Price spike: +45%"
  quarantinedAt    DateTime? // When it was flagged

  // Wave 4.1: Elastic Quarantine (Self-Healing)
  cooldownUntil  DateTime? // If set, service is temporarily unavailable until this time
  cooldownReason String? // Reason for cooldown (e.g., "API_ERROR", "DELAYED_CANCEL")

  // ETA Estimation (Adaptive Percentile Window — cron-updated every 15 min)
  etaP50Seconds  Int? // Median execution time in seconds
  etaP90Seconds  Int? // 90th percentile ("worst case")
  etaSampleCount Int       @default(0) // Number of completed orders behind the estimate
  etaSpeedClass  String? // FAST | MEDIUM | SLOW | ULTRA_SLOW
  etaUpdatedAt   DateTime? // Last ETA recalculation timestamp

  // Link Target & Format Validation (Wave 2)
  targetType        String  @default("POST") // POST, PROFILE, CHANNEL, COMMENT, POLL, VK_WALL, etc.
  customDataType    String  @default("NONE") // NONE, TEXTAREA, NUMBER
  customDataLabel   String? // Optional custom text prompt for the input field
  isMediaGroupAware Boolean @default(false) // If false, backend splits "123-125" into separate orders

  requireWarning     Boolean  @default(false)
  warningMessage     String?
  clientRequirement  String?  // Legal/Marketing requirement for the service (e.g. "Profile must be public")
  clientConfirmation String?  // JIT confirmation toggle text (e.g. "My profile is public")
  isActive           Boolean  @default(true)
  pricePer1000Cents  Int      @default(0) // Denormalized price for sorting (rate * markup * exchangeRate)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  orders         Order[]
  routes         ServiceRoute[]
  smartCampaigns SmartCampaign[]
  smartConfig    ServiceSmartConfig?
  priceHistory   ServicePriceHistory[]

  @@index([categoryId])
  @@index([providerId])
  @@index([isQuarantined])
  @@index([externalId])
  @@index([tenantId])
}

model Provider {
  id              String   @id @default(cuid())
  name            String   @unique
  apiUrl          String
  apiKey          String // Encrypted API key
  isActive        Boolean  @default(true)
  metadata        Json? // { httpMethod, requestType, headers, keyField, actionField }
  providerType    String   @default("SMM_PANEL") // SMM_PANEL, SMS_ACTIVATE
  syncLock        Boolean  @default(false)
  balanceCurrency String   @default("USD")
  ticketUrl       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // SLA Monitoring fields (P0.3)
  errorCount5m  Int       @default(0) // Errors in last 5 minutes (reset by sync)
  lastErrorAt   DateTime? // Last error timestamp
  lastSuccessAt DateTime? // Last successful API response
  avgResponseMs Int       @default(0) // Rolling average response time in ms

  services        Service[]
  Order           Order[]
  ServiceRoute    ServiceRoute[]
  smartExecutions SmartExecution[]
  shadowServices  ShadowService[]
}

model ShadowService {
  id                String   @id @default(cuid())
  providerId        String
  provider          Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  externalId        String
  name              String
  type              String?
  category          String?
  rate              Float
  rateRub           Float
  min               Int
  max               Int
  refill            Boolean  @default(false)
  cancel            Boolean  @default(false)
  dripfeed          Boolean  @default(false)

  // AI normalisation metrics
  cleanName         String?
  platform          String?
  normalizedCategory String?
  targetType        String   @default("POST")
  customDataType    String   @default("NONE")
  isMediaGroupAware Boolean  @default(false)
  isPrivate         Boolean  @default(false)
  warranty          Int      @default(0)
  geo               String?
  velocity          Int      @default(0)
  anomalyScore      Float    @default(0.0)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([providerId, externalId])
  @@index([providerId])
  @@index([platform])
  @@index([normalizedCategory])
  @@index([rateRub])
}

model Order {
  id                String      @id @default(cuid())
  numericId         Int         @unique @default(autoincrement())
  userId            String
  serviceId         String
  providerId        String? // Snapshots the provider used AT THE TIME of checkout
  provider          Provider?   @relation(fields: [providerId], references: [id], onDelete: SetNull)
  providerServiceId String? // Snapshots the provider's external service ID AT THE TIME of checkout
  externalId        String? // ID from provider (like VexBoost)
  dripExternalIds   String[]    @default([]) // History of run IDs for Drip-Feed
  link              String
  isLinkOverridden  Boolean     @default(false)
  quantity          Int
  status            OrderStatus @default(AWAITING_PAYMENT)
  remains           Int         @default(0) // Outstanding amount to deliver
  charge            BigInt // price paid by user in Cents
  providerCost      BigInt // exact cost from provider in Cents
  error             String? // Error message from provider API
  actualProviderCost BigInt?
  realMarginDelta    BigInt?
  retryCount        Int         @default(0) // Safe API Backoff mechanism
  isTest            Boolean     @default(false) // Isolation flag for mock environment
  email             String? // Contact email for guest / notification
  customData        String? // Additional payload (comments, answer #, keywords)
  usdToRubRate      Float?  // Historical CBR exchange rate at checkout time to prevent margin drift


  // Drip-Feed specifics
  isDripFeed Boolean   @default(false)
  runs       Int?
  interval   Int? // Minutes between runs
  currentRun Int       @default(0)
  nextRunAt  DateTime?

  // Lifecycle Wait specifics
  waitingUntil DateTime?

  discountCents BigInt  @default(0)
  promoCodeId   String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user           User            @relation(fields: [userId], references: [id], onDelete: Restrict)
  service        Service         @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  paymentId      String?
  payment        Payment?        @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  promoCode      PromoCode?      @relation(fields: [promoCodeId], references: [id], onDelete: SetNull)
  promoCodeUsage PromoCodeUsage?
  refills        Refill[]
  tickets        Ticket[]
  ticketMessages TicketMessage[]
  smartCampaign  SmartCampaign?

  idempotencyKey String? @unique // Wave 1: Token to prevent double order creation

  abVariant      String? // A/B test variant tag: A, B, C
  tenantId       String  @default("smmplan")

  @@index([userId])
  @@index([tenantId])
  @@index([tenantId, userId])
  @@index([tenantId, status, createdAt])
  @@index([serviceId]) // Fast lookup for orders by service
  @@index([status])
  @@index([createdAt]) // P2.2: temporal queries & analytics
  @@index([status, createdAt]) // P2.2: filtered + sorted admin queries
  @@index([userId, status]) // Fast lookup for user orders by status
  @@index([paymentId]) // Fast lookup for orders by payment (Order.paymentId foreign key)
  userNotes UserNote[]
}

model Refill {
  id         String  @id @default(cuid())
  numericId  Int     @unique @default(autoincrement())
  orderId    String
  order      Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status     String  @default("PENDING") // PENDING, IN_PROGRESS, COMPLETED, REJECTED, ERROR
  externalId String? // Refill ID from the provider

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orderId])
  @@index([status])
}

model Payment {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Restrict)

  orderId String? @unique // Legacy pointer, no longer used as the active Prisma relation

  orders         Order[]
  smartCampaigns SmartCampaign[]
  tickets        Ticket[]

  amount    BigInt // amount in Cents (BigInt: supports balances up to 90 trillion RUB)
  currency  String  @default("RUB")
  status    String  @default("PENDING") // PENDING, SUCCEEDED, CANCELED
  gatewayId String? @unique // yookassa payment id
  gateway   String  @default("yookassa") // yookassa, cryptobot, test

  // Legal Consent Logging (PB-004 Chargeback Defense)
  consentIp        String?
  consentUserAgent String?
  consentVersion   String?

  checkoutUrl String? // Persistent checkout URL to allow users to resume payment

  // FZ-54 Fiscal Data
  receiptId       String?  @unique // ID of the receipt in YooKassa/Atol
  refundReceiptId String?  @unique // ID of the refund receipt
  invoice         Invoice?

  abVariant String? // A/B test variant tag: A, B, C

  tenantId String @default("smmplan")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([gatewayId])
  @@index([tenantId])
  @@index([tenantId, userId])
}

// ── B2B Accounting ──
model Invoice {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  amount    BigInt // in Cents (RUB)
  status    String   @default("PENDING") // PENDING, PAID, CANCELED
  fileUrl   String? // Link to generated PDF invoice
  actUrl    String? // Link to Closing Document (УПД/Акт)
  paymentId String?  @unique
  payment   Payment? @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([status])
}

enum UsnScheme {
  INCOME
  INCOME_EXPENSES
}

model Tenant {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  domain       String   @unique
  customDomain String?  @unique
  isActive     Boolean  @default(true)
  vaultSalt    String   @default("") // TODO: Implement per-tenant HKDF key derivation (P2)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  systemSettings SystemSettings?
}

model SystemSettings {
  id              String    @id
  tenant          Tenant    @relation(fields: [id], references: [id], onDelete: Cascade)
  isTestMode      Boolean   @default(false)
  taxRate         Float     @default(6.0) // % tax rate
  usnScheme       UsnScheme @default(INCOME_EXPENSES)
  opexMonthly     Int       @default(0) // Fixed operational expenses sum in Cents
  maintenanceMode Boolean   @default(false)
  siteName        String    @default("Smmplan")
  siteDescription String    @default("")

  // Telegram Bot Settings
  welcomeMessage String? @default("Добро пожаловать в Smmplan! Ваш персональный кабинет готов к работе.")

  // Payment Gateways (Secrets are AES-256-GCM encrypted in DB)
  // Production keys
  yookassaShopId        String?
  yookassaSecretKey     String?
  // Test keys (used when isTestMode = true)
  yookassaTestShopId    String?
  yookassaTestSecretKey String?
  cryptoBotToken        String?

  // Catalog settings
  quarantineThreshold   Float     @default(0.20) // 20% price spike triggers quarantine
  globalMarkup          Float     @default(3.0) // Default markup multiplier for new services
  safetyFloor           Float     @default(1.0) // Min markup (100% = sell at cost)
  exchangeRateUSD       Float     @default(90.0) // USD to RUB rate (auto-synced from CBR)
  exchangeRateUpdatedAt DateTime? // Last CBR sync time

  // Site branding
  siteLogoUrl    String? // URL to uploaded logo
  siteFaviconUrl String? // URL to uploaded favicon

  // SMTP Settings (Email Integration)
  emailProvider             String  @default("SMTP")
  resendApiKey              String?
  smtpHost                  String?
  smtpPort                  Int     @default(465)
  smtpUser                  String?
  smtpPassword              String? // AES-256-GCM encrypted
  supportEmailDomain        String? // e.g. "smmplan.pro" used for inbound webhook
  inboundEmailWebhookSecret String? // Secret for validating incoming webhook payloads

  // Robokassa (encrypted)
  robokassaLogin    String?
  robokassaPassword String?
  robokassaWebhookPassword String?

  updatedAt DateTime @updatedAt

  // Contact & Social Information
  contactSupportEmail    String?
  contactPrivacyEmail    String?
  contactTelegramBot     String?
  contactTelegramChannel String?
  contactWhatsApp        String?
  contactVk              String?

  // Legal Information
  legalCompanyName    String?
  legalCompanyInn     String?
  legalCompanyOgrnip  String?
  legalCompanyAddress String?
}

enum TicketStatus {
  OPEN
  PENDING
  CLOSED
}

enum TicketSource {
  WEB
  TELEGRAM
  EMAIL
}

enum MessageSender {
  USER
  STAFF
  INTERNAL
}

model Ticket {
  id      String       @id @default(cuid())
  userId  String
  user    User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  subject String
  status  TicketStatus @default(OPEN)
  source  TicketSource @default(WEB)

  // Optional: Link ticket to a specific order for context (live chat)
  orderId String?
  order   Order?  @relation(fields: [orderId], references: [id], onDelete: SetNull)

  paymentId String?
  payment   Payment? @relation(fields: [paymentId], references: [id], onDelete: SetNull)

  firstRespondedAt DateTime? // SLA: First Response Time (FRT)
  resolvedAt       DateTime? // SLA: Time to Resolution (TTR)
  tags             String[]  @default([]) // NLP Tagging

  messages TicketMessage[]
  userNotes UserNote[]

  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  tenantId String @default("smmplan")

  @@index([userId])
  @@index([tenantId])
  @@index([tenantId, userId])
  @@index([tenantId, status, createdAt])
  @@index([source])
  @@index([orderId])
  @@index([paymentId])
  @@index([status])
  @@index([status, createdAt])
}

model TicketMessage {
  id        String        @id @default(cuid())
  ticketId  String
  ticket    Ticket        @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  sender    MessageSender
  text      String
  mediaUrl  String? // @deprecated - relative path to uploaded file (legacy)
  mediaType String? // @deprecated - "image", "audio", "video" (legacy)

  replyToId String?
  replyTo   TicketMessage?  @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)
  replies   TicketMessage[] @relation("MessageReplies")

  telegramMsgId String?
  isDeleted     Boolean @default(false)
  isEdited      Boolean @default(false)
  originalText  String?

  attachments MessageAttachment[]

  orderId String?
  order   Order?  @relation(fields: [orderId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  @@index([ticketId])
  @@index([telegramMsgId])
  @@index([ticketId, createdAt])
  @@index([orderId])
}

model MessageAttachment {
  id        String        @id @default(cuid())
  messageId String
  message   TicketMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  url      String // relative path to uploaded file (slugified)
  type     String // "image" | "audio" | "video" | "document"
  mimeType String // exact MIME type
  name     String // original file name
  size     Int? // file size in bytes

  createdAt DateTime @default(now())

  @@index([messageId])
}

model Page {
  id      String @id @default(cuid())
  slug    String @unique
  title   String
  content String

  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  action    String
  details   String
  createdAt DateTime @default(now())

  @@index([userId])
}

model Commission {
  id         String @id @default(cuid())
  orderId    String
  referrerId String
  amount     BigInt // in Cents (BigInt for consistency with financial fields)
  status     String @default("PENDING") // PENDING, PAID, REJECTED

  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  referrer User @relation("ReferredCommissions", fields: [referrerId], references: [id], onDelete: Cascade)

  @@unique([orderId, referrerId])
  @@index([referrerId])
}

// Security: Rate Limit
model RateLimit {
  id        String   @id @default(cuid())
  ip        String
  endpoint  String
  hits      Int      @default(1)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@unique([ip, endpoint])
  @@index([expiresAt])
}

// ── Admin Panel: Audit & Finance ──

model AdminAuditLog {
  id         String   @id @default(cuid())
  adminId    String // Who performed the action
  adminEmail String // Denormalized for fast log reading
  action     String // USER_BALANCE_CHANGE, SERVICE_DISABLE, SETTINGS_UPDATE, etc.
  target     String // ID of affected entity
  targetType String // USER, SERVICE, ORDER, SETTINGS, PROVIDER
  oldValue   String? // JSON string of previous state
  newValue   String? // JSON string of new state
  ipAddress  String? // Admin IP for security investigations
  createdAt  DateTime @default(now())

  @@index([adminId])
  @@index([createdAt])
  @@index([targetType])
}

model LedgerEntry {
  id              String   @id @default(cuid())
  userId          String // Client whose balance was affected
  user            User     @relation("UserLedger", fields: [userId], references: [id], onDelete: Restrict)
  adminId         String? // Support agent who initiated, null if SYSTEM/auto
  amount          BigInt // Amount in Cents (positive = credit, negative = debit)
  reason          String // Mandatory justification text
  status          String   @default("APPROVED") // APPROVED, QUARANTINE, REJECTED
  idempotencyKey  String?
  transactionType String   @default("PAYMENT") // PAYMENT | REFUND | REROUTE | COMPENSATION
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([idempotencyKey, transactionType])
  @@index([userId])
  @@index([status])
  @@index([adminId])
  @@index([adminId, createdAt])
}

model SupportTemplate {
  id        String   @id @default(cuid())
  shortcut  String?  @unique // unique keyboard command e.g. "delay", "refund"
  label     String
  text      String
  category  String   @default("GENERAL")
  isActive  Boolean  @default(true)
  useCount  Int      @default(0)
  sort      Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category])
}

// Telemetry
model AnalyticsEvent {
  id        String   @id @default(cuid())
  event     String
  metadata  Json?
  sessionId String?
  createdAt DateTime @default(now())

  @@index([event]) // P2.2: filter by event type
  @@index([createdAt]) // P2.2: TTL cleanup & temporal queries
}

// ── Feature Flags ──
// Predefined list. State: ON (all users) | TEST (test accounts only) | OFF
model FeatureFlag {
  id          String   @id @default(cuid())
  key         String   @unique // e.g. "drip_feed", "referral_program"
  label       String // Human-readable: "Drip-Feed"
  description String   @default("")
  state       String   @default("OFF") // ON | TEST | OFF
  updatedBy   String? // Admin email who last changed
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@index([key])
}

// ── Flexible RBAC ──
// Custom roles with granular permissions per sidebar section
model StaffRole {
  id          String            @id @default(cuid())
  name        String            @unique // "Senior Support"
  description String            @default("")
  isSystem    Boolean           @default(false) // true = cannot delete (Owner, Admin)
  permissions StaffPermission[]
  users       User[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
}

// One permission entry per section per role: section + action (view|edit)
model StaffPermission {
  id      String    @id @default(cuid())
  roleId  String
  role    StaffRole @relation(fields: [roleId], references: [id], onDelete: Cascade)
  section String // e.g. "orders", "finance", "catalog", "settings"
  canView Boolean   @default(false)
  canEdit Boolean   @default(false)

  @@unique([roleId, section])
  @@index([roleId])
}

// ── Security: Login Log ──
// Per OWASP A07: Authentication Failures monitoring
model LoginLog {
  id         String   @id @default(cuid())
  email      String // Attempted email
  userId     String? // Resolved userId if login succeeded
  ipAddress  String
  userAgent  String?
  success    Boolean
  failReason String? // "INVALID_PASSWORD" | "ACCOUNT_LOCKED" | "NOT_FOUND"
  createdAt  DateTime @default(now())

  @@index([email])
  @@index([ipAddress])
  @@index([createdAt])
}

model ServiceRoute {
  id        String  @id @default(cuid())
  serviceId String
  service   Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  providerId        String
  provider          Provider @relation(fields: [providerId], references: [id], onDelete: Restrict)
  providerServiceId String // The external ID for this provider (e.g., "102")

  isPrimary Boolean @default(false)
  isActive  Boolean @default(true)
  priority  Int     @default(0) // 0 = highest priority

  failoverMode String @default("manual") // "manual", "automatic", "weighted"

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([serviceId, providerId])
  @@index([serviceId])
  @@index([providerId])
}

model RoutingAuditLog {
  id             String   @id @default(cuid())
  serviceId      String
  adminId        String?
  action         String // "SWAP", "ADD_ROUTE", "QUARANTINE_REROUTE", "MANUAL_OVERRIDE"
  fromProviderId String?
  toProviderId   String?
  reason         String?
  createdAt      DateTime @default(now())
}

// Global System Settings (Key-Value Store)
model SystemSetting {
  key         String   @id // e.g. "SUPPORT_EMAIL", "COMPANY_INN"
  value       String // String value, can be stringified JSON if needed
  group       String   @default("GENERAL") // e.g. "CONTACTS", "LEGAL", "SEO"
  description String? // Admin-facing description
  updatedAt   DateTime @updatedAt
  updatedBy   String? // Admin email who last updated it
}

// ── Order Status Enum ──
enum OrderStatus {
  AWAITING_PAYMENT
  PENDING
  PENDING_CHECK
  PROVISIONING
  IN_PROGRESS
  COMPLETED
  PARTIAL
  CANCELED
  ERROR
  CANCELING
}

// ── Enterprise CMS ──

enum ContentType {
  PAGE
  ACADEMY_LESSON
  GLOSSARY_TERM
  NEWS_POST
}

model ContentCategory {
  id       String            @id @default(cuid())
  name     String
  slug     String            @unique
  parentId String?
  parent   ContentCategory?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children ContentCategory[] @relation("CategoryTree")
  items    ContentItem[]

  sort      Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
}

model ContentItem {
  id         String      @id @default(cuid())
  type       ContentType @default(PAGE)
  slug       String      @unique
  title      String
  excerpt    String?
  coverImage String?

  // Dual Storage
  contentJson String? // Stored as stringified JSON block array
  contentHtml String? // Rendered HTML

  // Relations
  categoryId String?
  category   ContentCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  // Metadata & Stats
  authorName String?
  viewCount  Int     @default(0)

  // Publishing Workflow
  isPublished Boolean   @default(false)
  publishedAt DateTime?

  // SEO
  metaTitle       String?
  metaDescription String?
  readTimeMinutes Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([type])
  @@index([slug])
  @@index([categoryId])
}

model SecurityEvent {
  id        String   @id @default(cuid())
  event     String // SIGNATURE_FAILED | REPLAY_ATTEMPT | INVALID_FORMAT
  severity  String // WARNING | CRITICAL
  ip        String?
  details   Json?
  createdAt DateTime @default(now())

  @@index([event])
  @@index([createdAt])
}

enum SmartCampaignStatus {
  PLANNED
  RUNNING
  PAUSED
  COMPLETED
  ERROR
}

enum SmartTaskStatus {
  PLANNED
  SENT
  COMPLETED
  ERROR
}

model SmartCampaign {
  id            String              @id @default(cuid())
  userId        String
  user          User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  serviceId     String
  service       Service             @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  status        SmartCampaignStatus @default(PLANNED)
  link          String
  totalQuantity Int
  totalDays     Int
  isTestMode    Boolean             @default(false)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  tasks     SmartTask[]
  snapshots SmartSnapshot[]
  metrics   SmartChannelMetric[]

  paymentId String?
  payment   Payment? @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  orderId   String?  @unique
  order     Order?   @relation(fields: [orderId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([serviceId])
  @@index([paymentId])
}

model SmartTask {
  id         String          @id @default(cuid())
  campaignId String
  campaign   SmartCampaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  quantity   Int
  runAt      DateTime
  status     SmartTaskStatus @default(PLANNED)
  error      String?
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  executions SmartExecution[]

  @@index([campaignId])
  @@index([runAt, status])
}

model SmartExecution {
  id              String    @id @default(cuid())
  taskId          String
  task            SmartTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  providerId      String?
  provider        Provider? @relation(fields: [providerId], references: [id], onDelete: SetNull)
  externalOrderId String?
  qtySent         Int
  qtyDelivered    Int       @default(0)
  status          String    @default("PENDING")
  error           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([taskId])
}

model ServiceSmartConfig {
  id                String   @id @default(cuid())
  serviceId         String   @unique
  service           Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  isEnabled         Boolean  @default(false)
  isTestMode        Boolean  @default(false)
  minChunk          Int      @default(50)
  maxChunk          Int      @default(200)
  markup            Float    @default(0.15)
  providersPriority String[] @default([])

  // Smart Drip 2.5 extensions
  useInviteBuffer   Boolean @default(false)
  autoCompensate    Boolean @default(true)
  checkIntervalMins Int     @default(120)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model SmartChannelMetric {
  id             String        @id @default(cuid())
  campaignId     String
  campaign       SmartCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  recordedAt     DateTime      @default(now())
  memberCount    Int
  delta          Int
  detectedDrops  Int           @default(0)
  compensatedQty Int           @default(0)

  @@index([campaignId])
}

model SmartSnapshot {
  id         String        @id @default(cuid())
  campaignId String
  campaign   SmartCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  channelUrl String
  members    String[]
  createdAt  DateTime      @default(now())
}

model SmartDetectedUser {
  id         String   @id @default(cuid())
  campaignId String
  telegramId String
  score      Int      @default(0)
  reasons    String[]
  createdAt  DateTime @default(now())
}

model PromoCodeUsage {
  id          String    @id @default(cuid())
  promoCodeId String
  promoCode   PromoCode @relation(fields: [promoCodeId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  orderId     String?   @unique
  order       Order?    @relation(fields: [orderId], references: [id], onDelete: SetNull)

  discountCents BigInt // Exact discount given in cents
  revenueCents  BigInt // Order payment (order.charge) in cents
  profitCents   BigInt // Margin (order.charge - order.providerCost) in cents

  isSuspicious Boolean  @default(false)
  createdAt    DateTime @default(now())

  @@index([promoCodeId])
  @@index([userId])
}

enum ArticleStatus {
  DRAFT
  PUBLISHED
}

model Article {
  id          String        @id @default(cuid())
  slug        String        @unique
  title       String
  description String        @db.Text
  content     String        @db.Text
  status      ArticleStatus
  category    String
  viewCount   Int           @default(0)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  authorName  String        @default("Михаил")
  authorRole  String        @default("Системный архитектор прокси-сетей Smmplan")
  priority    Int           @default(0) // 0-100, used for Drip-Feed publish queue

  @@index([category, status])
  @@index([status])
}

model ServicePriceHistory {
  id        String   @id @default(cuid())
  serviceId String
  service   Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  rate      Float
  createdAt DateTime @default(now())

  @@index([serviceId])
  @@index([createdAt])
}

model UserNote {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation("UserNotes", fields: [userId], references: [id], onDelete: Cascade)
  authorId  String?
  author    User?    @relation("AuthorNotes", fields: [authorId], references: [id], onDelete: SetNull)
  content   String
  orderId   String?
  order     Order?   @relation(fields: [orderId], references: [id], onDelete: SetNull)
  ticketId  String?
  ticket    Ticket?  @relation(fields: [ticketId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([authorId])
  @@index([orderId])
  @@index([ticketId])
}

model BalanceAdjustmentPolicy {
  id String @id @default(cuid())

  scopeType String // GLOBAL | ROLE | USER

  staffRoleId String?
  userId      String?

  isActive Boolean @default(true)

  enabled Boolean @default(false)

  canRequestCredit Boolean @default(false)
  canRequestDebit  Boolean @default(false)

  canApprove Boolean @default(false)
  canReject  Boolean @default(false)

  canViewAll   Boolean @default(false)
  canViewStats Boolean @default(false)

  maxCreditPerRequest BigInt @default(0)
  maxDebitPerRequest  BigInt @default(0)

  maxCreditPerDay BigInt @default(0)
  maxDebitPerDay  BigInt @default(0)
  maxTotalPerDay  BigInt @default(0)

  maxApprovalPerRequest BigInt @default(0)

  allowedCreditReasonCodes Json
  allowedDebitReasonCodes  Json
  allowedTargetRoles       Json

  requireTicket        Boolean @default(true)
  requireOrderForDebit Boolean @default(false)

  blockBannedTargets  Boolean @default(true)
  blockDeletedTargets Boolean @default(true)

  autoExecuteBelow BigInt @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([scopeType, staffRoleId])
  @@index([scopeType, userId])
}

model ManualBalanceAdjustment {
  id String @id @default(cuid())

  userId      String
  requestedBy String

  direction String // CREDIT | DEBIT

  amount BigInt

  reasonCode String
  reasonNote String

  ticketId  String?
  orderId   String?
  paymentId String?

  status String @default("PENDING_APPROVAL")
  // PENDING_APPROVAL | APPROVED | REJECTED | EXECUTED | EXECUTION_FAILED | CANCELED

  idempotencyKey String @unique

  approvedBy      String?
  approvedAt      DateTime?

  rejectedBy      String?
  rejectedAt      DateTime?
  rejectionReason String?

  executionError String?

  ledgerEntryId String?

  policySnapshot Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User  @relation("targetBalanceAdjustments", fields: [userId], references: [id], onDelete: Cascade)
  requester User  @relation("requestedBalanceAdjustments", fields: [requestedBy], references: [id], onDelete: Cascade)
  approver  User? @relation("approvedBalanceAdjustments", fields: [approvedBy], references: [id], onDelete: SetNull)
  rejecter  User? @relation("rejectedBalanceAdjustments", fields: [rejectedBy], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([requestedBy, createdAt])
  @@index([status, createdAt])
  @@index([direction, status, createdAt])
  @@index([ticketId])
}

```

---

## 4. Переменные окружения (`.env.example` / Имена ключей)

```env
# =============================================================================
# Smmplan Lite — Environment Variables
# =============================================================================
# Скопируйте этот файл как .env и заполните значения.
# Переменные с пометкой [REQUIRED] обязательны для запуска.
# Переменные с пометкой [PROD] обязательны только в production.
# Остальные — опциональные (graceful degradation).
# =============================================================================

# --- Database [REQUIRED] ---
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/smmplan_lite"

# --- Authentication [PROD] ---
# Секрет для подписи JWT-сессий (генерация: openssl rand -hex 32)
JWT_SECRET="your-jwt-secret-min-32-chars"

# --- Encryption [PROD] ---
# AES-256 ключ для шифрования API-ключей и платёжных секретов
# Генерация: openssl rand -hex 32 (результат = 64 hex символа = 32 bytes)
APP_ENCRYPTION_KEY="your-64-hex-char-encryption-key"

# --- Workers & Cron [PROD] ---
# Bearer-токен для авторизации фоновых процессов
# Генерация: openssl rand -hex 24
CRON_SECRET="your-cron-secret"

# --- Dev Sandbox [REQUIRED for test mode on staging/dev] ---
# API-ключ для mock-provider эндпоинта (используется воркерами в тест-режиме).
# Без этой переменной mock-provider вернёт 503, а воркер — throw.
# Генерация: openssl rand -hex 16
MOCK_PROVIDER_KEY="change-me-to-random-string"

# --- Application URL [REQUIRED] ---
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# --- SMTP (Email) [Optional — degrades to console.log] ---
SMTP_HOST=""
SMTP_PORT="465"
SMTP_USER=""
SMTP_PASS=""

# --- Telegram Admin Alerts [Optional — silently skipped] ---
ADMIN_ALERT_BOT_TOKEN=""
ADMIN_ALERT_CHAT_ID=""

# Providers
VEXBOOST_WEBHOOK_SECRET="change_me_to_random_string"
YOOKASSA_WEBHOOK_SECRET="your-yookassa-webhook-secret"
CRYPTOBOT_WEBHOOK_SECRET=""


# Next Auth / Session
# Generate a secret with: openssl rand -base64 32
JWT_SECRET="your-secret-key-here"
NEXTAUTH_SECRET="your-secret-key-here"
# PRISMA_CLIENT_ENGINE_TYPE="binary"

INTERNAL_API_SECRET=your_random_secret_here

```

---

## 5. Полный список API-роутов (`src/app/api/**/route.ts`) (34 роутов)

```text
src/app/api/admin/export/route.ts
src/app/api/admin/upload-branding/route.ts
src/app/api/analytics/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/verify/route.ts
src/app/api/cron/sync-cbr/route.ts
src/app/api/cron/sync-orders/route.ts
src/app/api/debug/route.ts
src/app/api/dev/login-direct/route.ts
src/app/api/dev/mock-payment/route.ts
src/app/api/dev/mock-provider/route.ts
src/app/api/dev/sandbox/yookassa/route.ts
src/app/api/dev/switch-tenant/route.ts
src/app/api/dev/test-checkout/route.ts
src/app/api/dev/test-magic-link/route.ts
src/app/api/draft/disable/route.ts
src/app/api/draft/route.ts
src/app/api/health/route.ts
src/app/api/internal/revalidate/route.ts
src/app/api/maintenance-status/route.ts
src/app/api/media/[...path]/route.ts
src/app/api/order-status/route.ts
src/app/api/payments/[id]/status/route.ts
src/app/api/support/chat/stream/route.ts
src/app/api/support/messages/route.ts
src/app/api/support/telegram/route.ts
src/app/api/support/upload/route.ts
src/app/api/v2/route.ts
src/app/api/webhooks/crypto/route.ts
src/app/api/webhooks/inbound-email/route.ts
src/app/api/webhooks/provider/route.ts
src/app/api/webhooks/robokassa/route.ts
src/app/api/webhooks/vexboost/route.ts
src/app/api/webhooks/yookassa/route.ts
```

---

## 6. Полный список Server Actions (`src/actions/**`) (65 actions)

```text
src/actions/admin/analytics.action.ts
src/actions/admin/balance-adjustments.ts
src/actions/admin/balance-policy.ts
src/actions/admin/catalog.ts
src/actions/admin/catalog/batch.ts
src/actions/admin/catalog/categories.ts
src/actions/admin/catalog/enrichment.ts
src/actions/admin/catalog/price-drift.ts
src/actions/admin/catalog/services.ts
src/actions/admin/catalog/soft-delete.ts
src/actions/admin/clients.ts
src/actions/admin/content.ts
src/actions/admin/feature-flags.ts
src/actions/admin/finance/ledger.ts
src/actions/admin/finance/payments.ts
src/actions/admin/health.ts
src/actions/admin/marketing.ts
src/actions/admin/orders.ts
src/actions/admin/providers/crud.ts
src/actions/admin/providers/import-cherry-pick.ts
src/actions/admin/providers/sync-action.ts
src/actions/admin/refills.ts
src/actions/admin/routing.actions.ts
src/actions/admin/search.ts
src/actions/admin/settings.ts
src/actions/admin/smart.ts
src/actions/admin/team.ts
src/actions/admin/test-mode.actions.ts
src/actions/admin/users.ts
src/actions/auth/api-key.ts
src/actions/auth/delete-account.ts
src/actions/auth/password-login.ts
src/actions/auth/password-register.ts
src/actions/auth/password-settings.ts
src/actions/auth/refresh-balance.ts
src/actions/auth/request-magic-link.ts
src/actions/finance/settings.ts
src/actions/knowledge.ts
src/actions/operator/dashboard/get-operator-dashboard.action.ts
src/actions/operator/orders/cancel-order.action.ts
src/actions/operator/orders/restart-order.action.ts
src/actions/operator/tickets/change-status.action.ts
src/actions/operator/tickets/reply-ticket.action.ts
src/actions/operator/transactions/get-transactions-list.action.ts
src/actions/operator/users/create-user-note.action.ts
src/actions/operator/users/get-user-financial-summary.action.ts
src/actions/operator/users/get-users-list.action.ts
src/actions/order/analyze-url.ts
src/actions/order/cancel.ts
src/actions/order/catalog.ts
src/actions/order/checkout.ts
src/actions/order/legal.ts
src/actions/order/mass.ts
src/actions/order/refill.ts
src/actions/order/smart.ts
src/actions/order/sync-payment.ts
src/actions/support/compensation.ts
src/actions/support/guest.ts
src/actions/support/offline-ticket.ts
src/actions/support/template.ts
src/actions/support/ticket.ts
src/actions/user/promo.ts
src/actions/user/referral.action.ts
src/actions/user/settings-extra.ts
src/actions/user/top-up.action.ts
```

---

## 7. Полный список тестов (`*.test.ts` / `*.spec.ts`) (146 тестов)

```text
e2e/admin-dark-mode.spec.ts
e2e/admin-marketing.spec.ts
e2e/admin-panel.spec.ts
e2e/admin-provider-tickets.spec.ts
e2e/api-v2-mass-orders.spec.ts
e2e/auth-and-dashboard.spec.ts
e2e/auth.setup.ts
e2e/catalog.spec.ts
e2e/checkout-yookassa.spec.ts
e2e/e2e-loss-prevention-limits.spec.ts
e2e/e2e-registration-ordering.spec.ts
e2e/e2e-support-sse.spec.ts
e2e/finance.spec.ts
e2e/fixtures/auth.fixture.ts
e2e/guest-mass-order.spec.ts
e2e/guest-support.spec.ts
e2e/loss-prevention.spec.ts
e2e/order.spec.ts
e2e/orders.spec.ts
e2e/password-auth.spec.ts
e2e/performance.spec.ts
e2e/providers.spec.ts
e2e/referral-promo.spec.ts
e2e/routing-protected.spec.ts
e2e/routing.spec.ts
e2e/staff-management.spec.ts
e2e/tickets.spec.ts
e2e/user-flow.spec.ts
e2e/users.spec.ts
e2e/utils/db-cleaner.ts
e2e/visual-regression.spec.ts
src/__tests__/balance-policy.test.ts
src/__tests__/rub-to-kopecks.test.ts
src/actions/__tests__/knowledge.test.ts
src/actions/admin/__tests__/routing-comparison.test.ts
src/actions/admin/catalog/__tests__/categories-ops.test.ts
src/actions/admin/catalog/__tests__/services-crud.test.ts
src/actions/admin/providers/__tests__/import-cherry-pick.test.ts
src/actions/admin/providers/__tests__/sync-provider-catalog.test.ts
src/actions/auth/__tests__/password-login.test.ts
src/actions/auth/__tests__/password-register.test.ts
src/actions/auth/__tests__/request-magic-link.test.ts
src/actions/order/__tests__/checkout.test.ts
src/actions/order/__tests__/r1-advanced-order-params.challenge.test.ts
src/actions/order/__tests__/r1-advanced-parameters-challenge.test.ts
src/actions/order/__tests__/r2-refill-challenge.test.ts
src/actions/order/__tests__/refill.test.ts
src/actions/support/__tests__/guest.test.ts
src/actions/support/__tests__/offline-ticket.test.ts
src/actions/user/__tests__/settings-extra.test.ts
src/bot/bot.test.ts
src/lib/__tests__/password.test.ts
src/lib/__tests__/sanitize.test.ts
src/lib/admin-audit.test.ts
src/lib/smtp.test.ts
src/services/admin/__tests__/escrow.test.ts
src/services/admin/__tests__/price-drift.test.ts
src/services/admin/__tests__/pricing-recalculation.test.ts
src/services/admin/__tests__/ticket.test.ts
src/services/analyzer/__tests__/link-analyzer-full.test.ts
src/services/analyzer/category-matcher.test.ts
src/services/analyzer/link-analyzer.comprehensive.test.ts
src/services/analyzer/link-analyzer.test.ts
src/services/core/__tests__/tenant-isolation.test.ts
src/services/eta/eta.fuzzing.test.ts
src/services/eta/eta.service.test.ts
src/services/financial/accounting.service.test.ts
src/services/financial/compensation.service.challenge.test.ts
src/services/financial/compensation.service.test.ts
src/services/financial/fast-check.pricing.test.ts
src/services/financial/refund-parallel.test.ts
src/services/financial/unified-payment.service.test.ts
src/services/financial/wallet.service.test.ts
src/services/marketing.service.test.ts
src/services/support/__tests__/messages-api.test.ts
src/services/support/__tests__/support-bot.test.ts
src/services/support/__tests__/ticket-rate-limit.test.ts
src/services/support/__tests__/ticket.test.ts
src/services/users/__tests__/deletion.test.ts
src/utils/balance-verifier.test.ts
src/utils/format-eta.test.ts
src/utils/link-normalizer.test.ts
src/utils/ticket-parser.test.ts
src/validators/__tests__/admin.validators.test.ts
src/workers/processors/__tests__/cleanup.processor.test.ts
src/workers/processors/__tests__/payment-sync.test.ts
src/workers/processors/__tests__/sync.processor.test.ts
src/workers/processors/order.processor.timeout.test.ts
test/integration/api-v2.test.ts
test/integration/cbr-rate-sync.test.ts
test/integration/checkout.fuzz.test.ts
test/integration/checkout.test.ts
test/integration/dripfeed-wallet-bugs.test.ts
test/integration/escrow-flow.test.ts
test/integration/escrow-race.test.ts
test/integration/ledger-invariant.test.ts
test/integration/mediagroup.test.ts
test/integration/payment-gateways.test.ts
test/integration/premortem.provider.test.ts
test/integration/promo.analytics.test.ts
test/integration/promo.checkout.test.ts
test/integration/promo.race.test.ts
test/integration/race.test.ts
test/integration/smart-drip.test.ts
test/integration/sweep-orphans.test.ts
test/integration/wallet-refund-type.test.ts
test/integration/webhooks.test.ts
test/security/api-v2-ratelimit.test.ts
test/setup.ts
test/unit/anti-fraud.test.ts
test/unit/audit-log.test.ts
test/unit/catalog-search.test.ts
test/unit/checkout-bypass.test.ts
test/unit/data-leak-prevention.test.ts
test/unit/elastic-pricing-prevention.test.ts
test/unit/fast-check.pricing.test.ts
test/unit/ghost-proxy.test.ts
test/unit/marketing-rewrite.test.ts
test/unit/marketing.test.ts
test/unit/order-processor.test.ts
test/unit/payment-gateway-selection.test.ts
test/unit/pricing.test.ts
test/unit/provider-universal.test.ts
test/unit/quality-detector.test.ts
test/unit/queue-connection.test.ts
test/unit/rate-limiter.test.ts
test/unit/red-team.checkout.test.ts
test/unit/red-team.queue.test.ts
test/unit/refill-processor.test.ts
test/unit/refund-policy.test.ts
test/unit/refund-utils.test.ts
test/unit/security.dev-endpoints.test.ts
test/unit/security.test.ts
test/unit/service-audit.test.ts
test/unit/settings.test.ts
test/unit/smart-analyzer.test.ts
test/unit/smart-drip-checkout.test.ts
test/unit/smart-drip.test.ts
test/unit/smart-feedback-loop.test.ts
test/unit/smart-order-form.test.tsx
test/unit/sync-processor.test.ts
test/unit/tc-fin-hedge.test.ts
test/unit/user-roles.test.ts
test/unit/wallet.race.test.ts
tests/magic-link.test.ts
tests/useABTest.test.ts
```

---

## 8. Самоаттестация Разведки

Все пути и структуры проекта собраны в реальном времени с диска без сокращений.

**Подпись:** *Senior Platform Engineer (Antigravity AI)*  
**Дата:** 28 июля 2026 г.
