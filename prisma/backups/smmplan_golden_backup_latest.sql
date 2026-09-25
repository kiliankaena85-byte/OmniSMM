--
-- PostgreSQL database dump
--

\restrict qzva5r0zvYYNYUfC1hNtWxyS2gcBGrBUHznYPei71ySOUg14aAeBjtjuBgimfNq

-- Dumped from database version 15.19
-- Dumped by pg_dump version 15.19

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_staffRoleId_fkey";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_referredById_fkey";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_customerGroupId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserNote" DROP CONSTRAINT IF EXISTS "UserNote_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserNote" DROP CONSTRAINT IF EXISTS "UserNote_ticketId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserNote" DROP CONSTRAINT IF EXISTS "UserNote_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserNote" DROP CONSTRAINT IF EXISTS "UserNote_authorId_fkey";
ALTER TABLE IF EXISTS ONLY public."UrlPattern" DROP CONSTRAINT IF EXISTS "UrlPattern_networkId_fkey";
ALTER TABLE IF EXISTS ONLY public."Ticket" DROP CONSTRAINT IF EXISTS "Ticket_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Ticket" DROP CONSTRAINT IF EXISTS "Ticket_paymentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Ticket" DROP CONSTRAINT IF EXISTS "Ticket_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."TicketMessage" DROP CONSTRAINT IF EXISTS "TicketMessage_ticketId_fkey";
ALTER TABLE IF EXISTS ONLY public."TicketMessage" DROP CONSTRAINT IF EXISTS "TicketMessage_replyToId_fkey";
ALTER TABLE IF EXISTS ONLY public."TicketMessage" DROP CONSTRAINT IF EXISTS "TicketMessage_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."TicketFeedback" DROP CONSTRAINT IF EXISTS "TicketFeedback_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."TicketFeedback" DROP CONSTRAINT IF EXISTS "TicketFeedback_ticketId_fkey";
ALTER TABLE IF EXISTS ONLY public."SystemSettings" DROP CONSTRAINT IF EXISTS "SystemSettings_id_fkey";
ALTER TABLE IF EXISTS ONLY public."SupportFinancialAction" DROP CONSTRAINT IF EXISTS "SupportFinancialAction_targetUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupportFinancialAction" DROP CONSTRAINT IF EXISTS "SupportFinancialAction_staffUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."StorefrontKey" DROP CONSTRAINT IF EXISTS "StorefrontKey_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."StaffShift" DROP CONSTRAINT IF EXISTS "StaffShift_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."StaffShift" DROP CONSTRAINT IF EXISTS "StaffShift_substituteUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."StaffPermission" DROP CONSTRAINT IF EXISTS "StaffPermission_roleId_fkey";
ALTER TABLE IF EXISTS ONLY public."SmartTask" DROP CONSTRAINT IF EXISTS "SmartTask_campaignId_fkey";
ALTER TABLE IF EXISTS ONLY public."SmartSnapshot" DROP CONSTRAINT IF EXISTS "SmartSnapshot_campaignId_fkey";
ALTER TABLE IF EXISTS ONLY public."SmartExecution" DROP CONSTRAINT IF EXISTS "SmartExecution_taskId_fkey";
ALTER TABLE IF EXISTS ONLY public."SmartExecution" DROP CONSTRAINT IF EXISTS "SmartExecution_providerId_fkey";
ALTER TABLE IF EXISTS ONLY public."SmartChannelMetric" DROP CONSTRAINT IF EXISTS "SmartChannelMetric_campaignId_fkey";
ALTER TABLE IF EXISTS ONLY public."SmartCampaign" DROP CONSTRAINT IF EXISTS "SmartCampaign_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."SmartCampaign" DROP CONSTRAINT IF EXISTS "SmartCampaign_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."SmartCampaign" DROP CONSTRAINT IF EXISTS "SmartCampaign_paymentId_fkey";
ALTER TABLE IF EXISTS ONLY public."SmartCampaign" DROP CONSTRAINT IF EXISTS "SmartCampaign_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."ShadowService" DROP CONSTRAINT IF EXISTS "ShadowService_providerId_fkey";
ALTER TABLE IF EXISTS ONLY public."Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Service" DROP CONSTRAINT IF EXISTS "Service_providerId_fkey";
ALTER TABLE IF EXISTS ONLY public."Service" DROP CONSTRAINT IF EXISTS "Service_categoryId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceSmartConfig" DROP CONSTRAINT IF EXISTS "ServiceSmartConfig_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceRoute" DROP CONSTRAINT IF EXISTS "ServiceRoute_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceRoute" DROP CONSTRAINT IF EXISTS "ServiceRoute_providerId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServicePriceHistory" DROP CONSTRAINT IF EXISTS "ServicePriceHistory_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceLinkCheck" DROP CONSTRAINT IF EXISTS "ServiceLinkCheck_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceEditHistory" DROP CONSTRAINT IF EXISTS "ServiceEditHistory_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceEditHistory" DROP CONSTRAINT IF EXISTS "ServiceEditHistory_draftId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceDraft" DROP CONSTRAINT IF EXISTS "ServiceDraft_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceCustomerAccess" DROP CONSTRAINT IF EXISTS "ServiceCustomerAccess_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceCustomerAccess" DROP CONSTRAINT IF EXISTS "ServiceCustomerAccess_customerGroupId_fkey";
ALTER TABLE IF EXISTS ONLY public."Refill" DROP CONSTRAINT IF EXISTS "Refill_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."Provider" DROP CONSTRAINT IF EXISTS "Provider_proxyId_fkey";
ALTER TABLE IF EXISTS ONLY public."ProviderProxyLog" DROP CONSTRAINT IF EXISTS "ProviderProxyLog_proxyId_fkey";
ALTER TABLE IF EXISTS ONLY public."ProviderProxyLog" DROP CONSTRAINT IF EXISTS "ProviderProxyLog_providerId_fkey";
ALTER TABLE IF EXISTS ONLY public."PromoCodeUsage" DROP CONSTRAINT IF EXISTS "PromoCodeUsage_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."PromoCodeUsage" DROP CONSTRAINT IF EXISTS "PromoCodeUsage_promoCodeId_fkey";
ALTER TABLE IF EXISTS ONLY public."PromoCodeUsage" DROP CONSTRAINT IF EXISTS "PromoCodeUsage_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Order" DROP CONSTRAINT IF EXISTS "Order_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Order" DROP CONSTRAINT IF EXISTS "Order_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."Order" DROP CONSTRAINT IF EXISTS "Order_providerId_fkey";
ALTER TABLE IF EXISTS ONLY public."Order" DROP CONSTRAINT IF EXISTS "Order_promoCodeId_fkey";
ALTER TABLE IF EXISTS ONLY public."Order" DROP CONSTRAINT IF EXISTS "Order_paymentId_fkey";
ALTER TABLE IF EXISTS ONLY public."OrderRecoveryIncident" DROP CONSTRAINT IF EXISTS "OrderRecoveryIncident_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."OrderRecoveryIncident" DROP CONSTRAINT IF EXISTS "OrderRecoveryIncident_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."MessageAttachment" DROP CONSTRAINT IF EXISTS "MessageAttachment_messageId_fkey";
ALTER TABLE IF EXISTS ONLY public."ManualBalanceAdjustment" DROP CONSTRAINT IF EXISTS "ManualBalanceAdjustment_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."ManualBalanceAdjustment" DROP CONSTRAINT IF EXISTS "ManualBalanceAdjustment_requestedBy_fkey";
ALTER TABLE IF EXISTS ONLY public."ManualBalanceAdjustment" DROP CONSTRAINT IF EXISTS "ManualBalanceAdjustment_rejectedBy_fkey";
ALTER TABLE IF EXISTS ONLY public."ManualBalanceAdjustment" DROP CONSTRAINT IF EXISTS "ManualBalanceAdjustment_approvedBy_fkey";
ALTER TABLE IF EXISTS ONLY public."LedgerEntry" DROP CONSTRAINT IF EXISTS "LedgerEntry_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."LedgerEntry" DROP CONSTRAINT IF EXISTS "LedgerEntry_periodId_fkey";
ALTER TABLE IF EXISTS ONLY public."Invoice" DROP CONSTRAINT IF EXISTS "Invoice_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Invoice" DROP CONSTRAINT IF EXISTS "Invoice_paymentId_fkey";
ALTER TABLE IF EXISTS ONLY public."EmployeeResponsibilityConsent" DROP CONSTRAINT IF EXISTS "EmployeeResponsibilityConsent_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."EmployeeResponsibilityConsent" DROP CONSTRAINT IF EXISTS "EmployeeResponsibilityConsent_documentVersionId_fkey";
ALTER TABLE IF EXISTS ONLY public."EconomicOptimizationSnapshot" DROP CONSTRAINT IF EXISTS "EconomicOptimizationSnapshot_appliedBy_fkey";
ALTER TABLE IF EXISTS ONLY public."CxApologyCompensation" DROP CONSTRAINT IF EXISTS "CxApologyCompensation_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."CxApologyCompensation" DROP CONSTRAINT IF EXISTS "CxApologyCompensation_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentItem" DROP CONSTRAINT IF EXISTS "ContentItem_categoryId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentCategory" DROP CONSTRAINT IF EXISTS "ContentCategory_parentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Commission" DROP CONSTRAINT IF EXISTS "Commission_referrerId_fkey";
ALTER TABLE IF EXISTS ONLY public."Category" DROP CONSTRAINT IF EXISTS "Category_networkId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuthToken" DROP CONSTRAINT IF EXISTS "AuthToken_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."ApiConfig" DROP CONSTRAINT IF EXISTS "ApiConfig_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."AiPricingRecommendation" DROP CONSTRAINT IF EXISTS "AiPricingRecommendation_snapshotId_fkey";
ALTER TABLE IF EXISTS ONLY public."AiPricingRecommendation" DROP CONSTRAINT IF EXISTS "AiPricingRecommendation_serviceId_fkey";
DROP INDEX IF EXISTS public.revenue_recognition_order_id_key;
DROP INDEX IF EXISTS public.reconciliation_report_date_idx;
DROP INDEX IF EXISTS public.provider_service_backup_service_id_priority_idx;
DROP INDEX IF EXISTS public.provider_service_backup_service_id_backup_provider_id_key;
DROP INDEX IF EXISTS public.ledger_period_month_key;
DROP INDEX IF EXISTS public.api_request_log_created_at_idx;
DROP INDEX IF EXISTS public.api_request_log_api_key_hash_created_at_idx;
DROP INDEX IF EXISTS public."User_tenantId_idx";
DROP INDEX IF EXISTS public."User_tenantId_createdAt_id_idx";
DROP INDEX IF EXISTS public."User_staffRoleId_idx";
DROP INDEX IF EXISTS public."User_referredById_idx";
DROP INDEX IF EXISTS public."User_referralCode_key";
DROP INDEX IF EXISTS public."User_phoneHash_key";
DROP INDEX IF EXISTS public."User_email_tenantId_key";
DROP INDEX IF EXISTS public."User_customerGroupId_idx";
DROP INDEX IF EXISTS public."User_createdAt_id_idx";
DROP INDEX IF EXISTS public."User_apiKeyHash_key";
DROP INDEX IF EXISTS public."UserNote_userId_idx";
DROP INDEX IF EXISTS public."UserNote_ticketId_idx";
DROP INDEX IF EXISTS public."UserNote_orderId_idx";
DROP INDEX IF EXISTS public."UserNote_authorId_idx";
DROP INDEX IF EXISTS public."UrlPattern_networkId_idx";
DROP INDEX IF EXISTS public."Ticket_userId_status_idx";
DROP INDEX IF EXISTS public."Ticket_userId_idx";
DROP INDEX IF EXISTS public."Ticket_tenantId_userId_idx";
DROP INDEX IF EXISTS public."Ticket_tenantId_status_createdAt_idx";
DROP INDEX IF EXISTS public."Ticket_tenantId_idx";
DROP INDEX IF EXISTS public."Ticket_status_idx";
DROP INDEX IF EXISTS public."Ticket_status_createdAt_idx";
DROP INDEX IF EXISTS public."Ticket_source_idx";
DROP INDEX IF EXISTS public."Ticket_paymentId_idx";
DROP INDEX IF EXISTS public."Ticket_orderId_idx";
DROP INDEX IF EXISTS public."TicketMessage_ticketId_idx";
DROP INDEX IF EXISTS public."TicketMessage_ticketId_createdAt_idx";
DROP INDEX IF EXISTS public."TicketMessage_telegramMsgId_idx";
DROP INDEX IF EXISTS public."TicketMessage_replyToId_idx";
DROP INDEX IF EXISTS public."TicketMessage_orderId_idx";
DROP INDEX IF EXISTS public."TicketFeedback_userId_idx";
DROP INDEX IF EXISTS public."TicketFeedback_ticketId_key";
DROP INDEX IF EXISTS public."TicketFeedback_tenantId_score_idx";
DROP INDEX IF EXISTS public."TicketFeedback_tenantId_createdAt_idx";
DROP INDEX IF EXISTS public."TicketFeedback_score_idx";
DROP INDEX IF EXISTS public."Tenant_slug_key";
DROP INDEX IF EXISTS public."Tenant_domain_key";
DROP INDEX IF EXISTS public."Tenant_customDomain_key";
DROP INDEX IF EXISTS public."TelegramTemplate_tenantId_idx";
DROP INDEX IF EXISTS public."TelegramTemplate_slug_tenantId_key";
DROP INDEX IF EXISTS public."TelegramTemplate_slug_idx";
DROP INDEX IF EXISTS public."TelegramTemplate_category_idx";
DROP INDEX IF EXISTS public."TelegramProxy_tenantId_idx";
DROP INDEX IF EXISTS public."TelegramErrorLog_tenantId_idx";
DROP INDEX IF EXISTS public."TelegramErrorLog_source_idx";
DROP INDEX IF EXISTS public."TelegramErrorLog_level_idx";
DROP INDEX IF EXISTS public."TelegramErrorLog_lastSeenAt_idx";
DROP INDEX IF EXISTS public."TelegramErrorLog_isResolved_idx";
DROP INDEX IF EXISTS public."TelegramErrorLog_errorCode_idx";
DROP INDEX IF EXISTS public."TelegramDailyStat_tenantId_idx";
DROP INDEX IF EXISTS public."TelegramDailyStat_date_tenantId_key";
DROP INDEX IF EXISTS public."TelegramDailyStat_date_idx";
DROP INDEX IF EXISTS public."TelegramButton_tenantId_idx";
DROP INDEX IF EXISTS public."TelegramButton_sortOrder_idx";
DROP INDEX IF EXISTS public."TelegramBotInstance_tenantId_idx";
DROP INDEX IF EXISTS public."TelegramBotInstance_role_idx";
DROP INDEX IF EXISTS public."TelegramBotInstance_isActive_idx";
DROP INDEX IF EXISTS public."SupportTemplate_shortcut_key";
DROP INDEX IF EXISTS public."SupportTemplate_category_idx";
DROP INDEX IF EXISTS public."SupportLimitUsage_tenantId_dayKey_idx";
DROP INDEX IF EXISTS public."SupportLimitUsage_staffUserId_dayKey_idx";
DROP INDEX IF EXISTS public."SupportLimitUsage_staffUserId_dayKey_direction_key";
DROP INDEX IF EXISTS public."SupportHourlyUsage_tenantId_hourKey_idx";
DROP INDEX IF EXISTS public."SupportHourlyUsage_staffUserId_hourKey_idx";
DROP INDEX IF EXISTS public."SupportHourlyUsage_staffUserId_hourKey_direction_key";
DROP INDEX IF EXISTS public."SupportFinancialAction_ticketId_idx";
DROP INDEX IF EXISTS public."SupportFinancialAction_tenantId_createdAt_idx";
DROP INDEX IF EXISTS public."SupportFinancialAction_targetUserId_createdAt_idx";
DROP INDEX IF EXISTS public."SupportFinancialAction_status_idx";
DROP INDEX IF EXISTS public."SupportFinancialAction_staffUserId_createdAt_idx";
DROP INDEX IF EXISTS public."SupportFinancialAction_reviewStatus_idx";
DROP INDEX IF EXISTS public."SupportFinancialAction_orderId_idx";
DROP INDEX IF EXISTS public."SupportFinancialAction_idempotencyKey_key";
DROP INDEX IF EXISTS public."StorefrontKey_tenantId_idx";
DROP INDEX IF EXISTS public."StorefrontKey_keyHash_key";
DROP INDEX IF EXISTS public."StaffShift_userId_date_shiftType_key";
DROP INDEX IF EXISTS public."StaffShift_userId_date_idx";
DROP INDEX IF EXISTS public."StaffShift_substituteUserId_idx";
DROP INDEX IF EXISTS public."StaffShift_date_status_idx";
DROP INDEX IF EXISTS public."StaffRole_tenantId_idx";
DROP INDEX IF EXISTS public."StaffRole_name_key";
DROP INDEX IF EXISTS public."StaffPermission_tenantId_idx";
DROP INDEX IF EXISTS public."StaffPermission_roleId_section_key";
DROP INDEX IF EXISTS public."StaffPermission_roleId_idx";
DROP INDEX IF EXISTS public."SmartTask_runAt_status_idx";
DROP INDEX IF EXISTS public."SmartTask_campaignId_idx";
DROP INDEX IF EXISTS public."SmartSnapshot_campaignId_idx";
DROP INDEX IF EXISTS public."SmartExecution_taskId_idx";
DROP INDEX IF EXISTS public."SmartExecution_providerId_idx";
DROP INDEX IF EXISTS public."SmartDetectedUser_campaignId_idx";
DROP INDEX IF EXISTS public."SmartChannelMetric_campaignId_idx";
DROP INDEX IF EXISTS public."SmartCampaign_userId_idx";
DROP INDEX IF EXISTS public."SmartCampaign_serviceId_idx";
DROP INDEX IF EXISTS public."SmartCampaign_paymentId_idx";
DROP INDEX IF EXISTS public."SmartCampaign_orderId_key";
DROP INDEX IF EXISTS public."SlaTelemetrySnapshot_providerId_createdAt_idx";
DROP INDEX IF EXISTS public."SlaTelemetrySnapshot_createdAt_idx";
DROP INDEX IF EXISTS public."ShadowService_tenantId_idx";
DROP INDEX IF EXISTS public."ShadowService_rateRub_idx";
DROP INDEX IF EXISTS public."ShadowService_providerId_normalizedCategory_rateRub_idx";
DROP INDEX IF EXISTS public."ShadowService_providerId_idx";
DROP INDEX IF EXISTS public."ShadowService_providerId_externalId_key";
DROP INDEX IF EXISTS public."ShadowService_platform_idx";
DROP INDEX IF EXISTS public."ShadowService_normalizedCategory_idx";
DROP INDEX IF EXISTS public."Session_userId_idx";
DROP INDEX IF EXISTS public."Service_tenantId_slug_key";
DROP INDEX IF EXISTS public."Service_tenantId_providerId_isActive_idx";
DROP INDEX IF EXISTS public."Service_tenantId_isActive_qualityTier_idx";
DROP INDEX IF EXISTS public."Service_tenantId_idx";
DROP INDEX IF EXISTS public."Service_tenantId_categoryId_isActive_sortOrder_idx";
DROP INDEX IF EXISTS public."Service_tenantId_categoryId_isActive_idx";
DROP INDEX IF EXISTS public."Service_slug_idx";
DROP INDEX IF EXISTS public."Service_qualityTier_idx";
DROP INDEX IF EXISTS public."Service_providerId_idx";
DROP INDEX IF EXISTS public."Service_providerId_externalId_idx";
DROP INDEX IF EXISTS public."Service_numericId_key";
DROP INDEX IF EXISTS public."Service_isQuarantined_idx";
DROP INDEX IF EXISTS public."Service_externalId_idx";
DROP INDEX IF EXISTS public."Service_categoryId_idx";
DROP INDEX IF EXISTS public."ServiceSmartConfig_serviceId_key";
DROP INDEX IF EXISTS public."ServiceRoute_serviceId_providerId_key";
DROP INDEX IF EXISTS public."ServiceRoute_serviceId_idx";
DROP INDEX IF EXISTS public."ServiceRoute_providerId_idx";
DROP INDEX IF EXISTS public."ServicePriceHistory_serviceId_idx";
DROP INDEX IF EXISTS public."ServicePriceHistory_createdAt_idx";
DROP INDEX IF EXISTS public."ServiceLinkCheck_targetType_idx";
DROP INDEX IF EXISTS public."ServiceLinkCheck_serviceId_idx";
DROP INDEX IF EXISTS public."ServiceLinkCheck_checkedAt_idx";
DROP INDEX IF EXISTS public."ServiceEditHistory_serviceId_idx";
DROP INDEX IF EXISTS public."ServiceEditHistory_draftId_idx";
DROP INDEX IF EXISTS public."ServiceEditHistory_createdAt_idx";
DROP INDEX IF EXISTS public."ServiceEditHistory_adminId_idx";
DROP INDEX IF EXISTS public."ServiceDraft_tenantId_idx";
DROP INDEX IF EXISTS public."ServiceDraft_status_idx";
DROP INDEX IF EXISTS public."ServiceDraft_serviceId_key";
DROP INDEX IF EXISTS public."ServiceDraft_providerId_externalId_idx";
DROP INDEX IF EXISTS public."ServiceCustomerAccess_serviceId_idx";
DROP INDEX IF EXISTS public."ServiceCustomerAccess_serviceId_customerGroupId_key";
DROP INDEX IF EXISTS public."ServiceCustomerAccess_customerGroupId_idx";
DROP INDEX IF EXISTS public."SecurityEvent_tenantId_idx";
DROP INDEX IF EXISTS public."SecurityEvent_event_idx";
DROP INDEX IF EXISTS public."SecurityEvent_createdAt_idx";
DROP INDEX IF EXISTS public."Refill_status_idx";
DROP INDEX IF EXISTS public."Refill_orderId_idx";
DROP INDEX IF EXISTS public."Refill_numericId_key";
DROP INDEX IF EXISTS public."RateLimit_ip_endpoint_key";
DROP INDEX IF EXISTS public."RateLimit_expiresAt_idx";
DROP INDEX IF EXISTS public."Provider_proxyId_key";
DROP INDEX IF EXISTS public."Provider_name_key";
DROP INDEX IF EXISTS public."ProviderProxy_protocol_idx";
DROP INDEX IF EXISTS public."ProviderProxy_isActive_idx";
DROP INDEX IF EXISTS public."ProviderProxy_expiresAt_idx";
DROP INDEX IF EXISTS public."ProviderProxy_category_idx";
DROP INDEX IF EXISTS public."ProviderProxyLog_proxyId_idx";
DROP INDEX IF EXISTS public."ProviderProxyLog_providerId_idx";
DROP INDEX IF EXISTS public."ProviderProxyLog_createdAt_idx";
DROP INDEX IF EXISTS public."ProviderOutbox_providerId_status_idx";
DROP INDEX IF EXISTS public."ProviderOutbox_orderId_idx";
DROP INDEX IF EXISTS public."ProviderOutbox_idempotencyKey_key";
DROP INDEX IF EXISTS public."PromoCode_code_key";
DROP INDEX IF EXISTS public."PromoCodeUsage_userId_idx";
DROP INDEX IF EXISTS public."PromoCodeUsage_promoCodeId_idx";
DROP INDEX IF EXISTS public."PromoCodeUsage_orderId_key";
DROP INDEX IF EXISTS public."ProcessedBonusEvent_userId_idx";
DROP INDEX IF EXISTS public."ProcessedBonusEvent_eventType_eventId_key";
DROP INDEX IF EXISTS public."PreLaunchLead_tenantId_createdAt_idx";
DROP INDEX IF EXISTS public."PreLaunchLead_email_tenantId_key";
DROP INDEX IF EXISTS public."PiiAccessLog_targetType_targetId_idx";
DROP INDEX IF EXISTS public."PiiAccessLog_staffId_createdAt_idx";
DROP INDEX IF EXISTS public."Payment_userId_status_createdAt_idx";
DROP INDEX IF EXISTS public."Payment_userId_idx";
DROP INDEX IF EXISTS public."Payment_tenantId_userId_status_createdAt_idx";
DROP INDEX IF EXISTS public."Payment_tenantId_userId_idx";
DROP INDEX IF EXISTS public."Payment_tenantId_status_createdAt_idx";
DROP INDEX IF EXISTS public."Payment_tenantId_idx";
DROP INDEX IF EXISTS public."Payment_tenantId_createdAt_idx";
DROP INDEX IF EXISTS public."Payment_status_idx";
DROP INDEX IF EXISTS public."Payment_status_createdAt_idx";
DROP INDEX IF EXISTS public."Payment_refundReceiptId_key";
DROP INDEX IF EXISTS public."Payment_receiptId_key";
DROP INDEX IF EXISTS public."Payment_orderId_key";
DROP INDEX IF EXISTS public."Payment_gatewayId_key";
DROP INDEX IF EXISTS public."Payment_gatewayId_idx";
DROP INDEX IF EXISTS public."Payment_createdAt_idx";
DROP INDEX IF EXISTS public."Page_slug_key";
DROP INDEX IF EXISTS public."Order_userId_status_idx";
DROP INDEX IF EXISTS public."Order_userId_status_createdAt_idx";
DROP INDEX IF EXISTS public."Order_userId_idx";
DROP INDEX IF EXISTS public."Order_tenantId_userId_status_createdAt_idx";
DROP INDEX IF EXISTS public."Order_tenantId_userId_idx";
DROP INDEX IF EXISTS public."Order_tenantId_status_createdAt_idx";
DROP INDEX IF EXISTS public."Order_tenantId_idx";
DROP INDEX IF EXISTS public."Order_tenantId_createdAt_idx";
DROP INDEX IF EXISTS public."Order_tenantId_createdAt_id_idx";
DROP INDEX IF EXISTS public."Order_status_idx";
DROP INDEX IF EXISTS public."Order_status_createdAt_idx";
DROP INDEX IF EXISTS public."Order_serviceId_idx";
DROP INDEX IF EXISTS public."Order_providerId_externalId_idx";
DROP INDEX IF EXISTS public."Order_promoCodeId_idx";
DROP INDEX IF EXISTS public."Order_paymentId_idx";
DROP INDEX IF EXISTS public."Order_numericId_key";
DROP INDEX IF EXISTS public."Order_idempotencyKey_key";
DROP INDEX IF EXISTS public."Order_externalId_idx";
DROP INDEX IF EXISTS public."Order_createdAt_idx";
DROP INDEX IF EXISTS public."Order_createdAt_id_idx";
DROP INDEX IF EXISTS public."OrderRecoveryIncident_userId_idx";
DROP INDEX IF EXISTS public."OrderRecoveryIncident_orderId_idx";
DROP INDEX IF EXISTS public."OrderRecoveryIncident_createdAt_idx";
DROP INDEX IF EXISTS public."Network_tenantId_idx";
DROP INDEX IF EXISTS public."Network_slug_key";
DROP INDEX IF EXISTS public."Network_name_key";
DROP INDEX IF EXISTS public."MessageAttachment_messageId_idx";
DROP INDEX IF EXISTS public."ManualBalanceAdjustment_userId_createdAt_idx";
DROP INDEX IF EXISTS public."ManualBalanceAdjustment_ticketId_idx";
DROP INDEX IF EXISTS public."ManualBalanceAdjustment_status_createdAt_idx";
DROP INDEX IF EXISTS public."ManualBalanceAdjustment_requestedBy_createdAt_idx";
DROP INDEX IF EXISTS public."ManualBalanceAdjustment_rejectedBy_idx";
DROP INDEX IF EXISTS public."ManualBalanceAdjustment_idempotencyKey_key";
DROP INDEX IF EXISTS public."ManualBalanceAdjustment_direction_status_createdAt_idx";
DROP INDEX IF EXISTS public."ManualBalanceAdjustment_approvedBy_idx";
DROP INDEX IF EXISTS public."LoginLog_tenantId_idx";
DROP INDEX IF EXISTS public."LoginLog_ipAddress_idx";
DROP INDEX IF EXISTS public."LoginLog_email_idx";
DROP INDEX IF EXISTS public."LoginLog_createdAt_idx";
DROP INDEX IF EXISTS public."LegalDocumentVersion_type_version_key";
DROP INDEX IF EXISTS public."LegalDocumentVersion_type_isActive_idx";
DROP INDEX IF EXISTS public."LegalDocumentVersion_tenantId_idx";
DROP INDEX IF EXISTS public."LedgerEntry_userId_idx";
DROP INDEX IF EXISTS public."LedgerEntry_userId_createdAt_id_idx";
DROP INDEX IF EXISTS public."LedgerEntry_tenantId_userId_createdAt_idx";
DROP INDEX IF EXISTS public."LedgerEntry_tenantId_transactionType_createdAt_idx";
DROP INDEX IF EXISTS public."LedgerEntry_tenantId_idx";
DROP INDEX IF EXISTS public."LedgerEntry_tenantId_createdAt_id_idx";
DROP INDEX IF EXISTS public."LedgerEntry_status_idx";
DROP INDEX IF EXISTS public."LedgerEntry_periodId_idx";
DROP INDEX IF EXISTS public."LedgerEntry_idempotencyKey_key";
DROP INDEX IF EXISTS public."LedgerEntry_createdAt_id_idx";
DROP INDEX IF EXISTS public."LedgerEntry_adminId_idx";
DROP INDEX IF EXISTS public."LedgerEntry_adminId_createdAt_idx";
DROP INDEX IF EXISTS public."Invoice_userId_idx";
DROP INDEX IF EXISTS public."Invoice_status_idx";
DROP INDEX IF EXISTS public."Invoice_paymentId_key";
DROP INDEX IF EXISTS public."FeatureFlag_key_key";
DROP INDEX IF EXISTS public."FeatureFlag_key_idx";
DROP INDEX IF EXISTS public."EmployeeResponsibilityConsent_userId_status_idx";
DROP INDEX IF EXISTS public."EmployeeResponsibilityConsent_tenantId_idx";
DROP INDEX IF EXISTS public."EmployeeResponsibilityConsent_documentVersionId_idx";
DROP INDEX IF EXISTS public."EconomicOptimizationSnapshot_tenantId_status_idx";
DROP INDEX IF EXISTS public."EconomicOptimizationSnapshot_tenantId_createdAt_idx";
DROP INDEX IF EXISTS public."EconomicOptimizationSnapshot_status_idx";
DROP INDEX IF EXISTS public."EconomicOptimizationSnapshot_appliedBy_idx";
DROP INDEX IF EXISTS public."CxApologyCompensation_userId_createdAt_idx";
DROP INDEX IF EXISTS public."CxApologyCompensation_status_idx";
DROP INDEX IF EXISTS public."CxApologyCompensation_orderId_idx";
DROP INDEX IF EXISTS public."CustomerGroup_tenantId_slug_key";
DROP INDEX IF EXISTS public."CustomerGroup_tenantId_idx";
DROP INDEX IF EXISTS public."ContentItem_type_idx";
DROP INDEX IF EXISTS public."ContentItem_slug_key";
DROP INDEX IF EXISTS public."ContentItem_slug_idx";
DROP INDEX IF EXISTS public."ContentItem_categoryId_idx";
DROP INDEX IF EXISTS public."ContentCategory_slug_key";
DROP INDEX IF EXISTS public."ContentCategory_parentId_idx";
DROP INDEX IF EXISTS public."Commission_referrerId_idx";
DROP INDEX IF EXISTS public."Commission_orderId_referrerId_key";
DROP INDEX IF EXISTS public."Category_tenantId_idx";
DROP INDEX IF EXISTS public."Category_slug_key";
DROP INDEX IF EXISTS public."Category_networkId_idx";
DROP INDEX IF EXISTS public."Category_activityType_idx";
DROP INDEX IF EXISTS public."BonusRedemptionLog_userId_idx";
DROP INDEX IF EXISTS public."BonusRedemptionLog_tenantId_idx";
DROP INDEX IF EXISTS public."BonusRedemptionLog_status_unlockAt_idx";
DROP INDEX IF EXISTS public."BonusRedemptionLog_paymentFingerprint_bonusType_idx";
DROP INDEX IF EXISTS public."BalanceAdjustmentPolicy_scopeType_userId_idx";
DROP INDEX IF EXISTS public."BalanceAdjustmentPolicy_scopeType_staffRoleId_idx";
DROP INDEX IF EXISTS public."AuthToken_userId_createdAt_idx";
DROP INDEX IF EXISTS public."AuthToken_token_tenantId_key";
DROP INDEX IF EXISTS public."AuthToken_expiresAt_idx";
DROP INDEX IF EXISTS public."AuditLog_userId_idx";
DROP INDEX IF EXISTS public."Article_status_idx";
DROP INDEX IF EXISTS public."Article_slug_key";
DROP INDEX IF EXISTS public."Article_category_status_idx";
DROP INDEX IF EXISTS public."ApiConfig_userId_key";
DROP INDEX IF EXISTS public."AnalyticsEvent_event_idx";
DROP INDEX IF EXISTS public."AnalyticsEvent_createdAt_idx";
DROP INDEX IF EXISTS public."AiPricingRecommendation_status_idx";
DROP INDEX IF EXISTS public."AiPricingRecommendation_snapshotId_status_idx";
DROP INDEX IF EXISTS public."AiPricingRecommendation_snapshotId_idx";
DROP INDEX IF EXISTS public."AiPricingRecommendation_serviceId_idx";
DROP INDEX IF EXISTS public."AiPricingRecommendation_confidenceScore_idx";
DROP INDEX IF EXISTS public."AdminAuditLog_tenantId_idx";
DROP INDEX IF EXISTS public."AdminAuditLog_targetType_idx";
DROP INDEX IF EXISTS public."AdminAuditLog_createdAt_idx";
DROP INDEX IF EXISTS public."AdminAuditLog_adminId_idx";
ALTER TABLE IF EXISTS ONLY public.revenue_recognition DROP CONSTRAINT IF EXISTS revenue_recognition_pkey;
ALTER TABLE IF EXISTS ONLY public.reconciliation_report DROP CONSTRAINT IF EXISTS reconciliation_report_pkey;
ALTER TABLE IF EXISTS ONLY public.provider_service_backup DROP CONSTRAINT IF EXISTS provider_service_backup_pkey;
ALTER TABLE IF EXISTS ONLY public.ledger_period DROP CONSTRAINT IF EXISTS ledger_period_pkey;
ALTER TABLE IF EXISTS ONLY public.api_request_log DROP CONSTRAINT IF EXISTS api_request_log_pkey;
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."UserNote" DROP CONSTRAINT IF EXISTS "UserNote_pkey";
ALTER TABLE IF EXISTS ONLY public."UrlPattern" DROP CONSTRAINT IF EXISTS "UrlPattern_pkey";
ALTER TABLE IF EXISTS ONLY public."Ticket" DROP CONSTRAINT IF EXISTS "Ticket_pkey";
ALTER TABLE IF EXISTS ONLY public."TicketMessage" DROP CONSTRAINT IF EXISTS "TicketMessage_pkey";
ALTER TABLE IF EXISTS ONLY public."TicketFeedback" DROP CONSTRAINT IF EXISTS "TicketFeedback_pkey";
ALTER TABLE IF EXISTS ONLY public."Tenant" DROP CONSTRAINT IF EXISTS "Tenant_pkey";
ALTER TABLE IF EXISTS ONLY public."TelegramTemplate" DROP CONSTRAINT IF EXISTS "TelegramTemplate_pkey";
ALTER TABLE IF EXISTS ONLY public."TelegramProxy" DROP CONSTRAINT IF EXISTS "TelegramProxy_pkey";
ALTER TABLE IF EXISTS ONLY public."TelegramErrorLog" DROP CONSTRAINT IF EXISTS "TelegramErrorLog_pkey";
ALTER TABLE IF EXISTS ONLY public."TelegramDailyStat" DROP CONSTRAINT IF EXISTS "TelegramDailyStat_pkey";
ALTER TABLE IF EXISTS ONLY public."TelegramButton" DROP CONSTRAINT IF EXISTS "TelegramButton_pkey";
ALTER TABLE IF EXISTS ONLY public."TelegramBotInstance" DROP CONSTRAINT IF EXISTS "TelegramBotInstance_pkey";
ALTER TABLE IF EXISTS ONLY public."SystemSettings" DROP CONSTRAINT IF EXISTS "SystemSettings_pkey";
ALTER TABLE IF EXISTS ONLY public."SystemSetting" DROP CONSTRAINT IF EXISTS "SystemSetting_pkey";
ALTER TABLE IF EXISTS ONLY public."SupportTemplate" DROP CONSTRAINT IF EXISTS "SupportTemplate_pkey";
ALTER TABLE IF EXISTS ONLY public."SupportLimitUsage" DROP CONSTRAINT IF EXISTS "SupportLimitUsage_pkey";
ALTER TABLE IF EXISTS ONLY public."SupportHourlyUsage" DROP CONSTRAINT IF EXISTS "SupportHourlyUsage_pkey";
ALTER TABLE IF EXISTS ONLY public."SupportFinancialAction" DROP CONSTRAINT IF EXISTS "SupportFinancialAction_pkey";
ALTER TABLE IF EXISTS ONLY public."StorefrontKey" DROP CONSTRAINT IF EXISTS "StorefrontKey_pkey";
ALTER TABLE IF EXISTS ONLY public."StaffShift" DROP CONSTRAINT IF EXISTS "StaffShift_pkey";
ALTER TABLE IF EXISTS ONLY public."StaffRole" DROP CONSTRAINT IF EXISTS "StaffRole_pkey";
ALTER TABLE IF EXISTS ONLY public."StaffPermission" DROP CONSTRAINT IF EXISTS "StaffPermission_pkey";
ALTER TABLE IF EXISTS ONLY public."SmartTask" DROP CONSTRAINT IF EXISTS "SmartTask_pkey";
ALTER TABLE IF EXISTS ONLY public."SmartSnapshot" DROP CONSTRAINT IF EXISTS "SmartSnapshot_pkey";
ALTER TABLE IF EXISTS ONLY public."SmartExecution" DROP CONSTRAINT IF EXISTS "SmartExecution_pkey";
ALTER TABLE IF EXISTS ONLY public."SmartDetectedUser" DROP CONSTRAINT IF EXISTS "SmartDetectedUser_pkey";
ALTER TABLE IF EXISTS ONLY public."SmartChannelMetric" DROP CONSTRAINT IF EXISTS "SmartChannelMetric_pkey";
ALTER TABLE IF EXISTS ONLY public."SmartCampaign" DROP CONSTRAINT IF EXISTS "SmartCampaign_pkey";
ALTER TABLE IF EXISTS ONLY public."SlaTelemetrySnapshot" DROP CONSTRAINT IF EXISTS "SlaTelemetrySnapshot_pkey";
ALTER TABLE IF EXISTS ONLY public."ShadowService" DROP CONSTRAINT IF EXISTS "ShadowService_pkey";
ALTER TABLE IF EXISTS ONLY public."Session" DROP CONSTRAINT IF EXISTS "Session_pkey";
ALTER TABLE IF EXISTS ONLY public."Service" DROP CONSTRAINT IF EXISTS "Service_pkey";
ALTER TABLE IF EXISTS ONLY public."ServiceSmartConfig" DROP CONSTRAINT IF EXISTS "ServiceSmartConfig_pkey";
ALTER TABLE IF EXISTS ONLY public."ServiceRoute" DROP CONSTRAINT IF EXISTS "ServiceRoute_pkey";
ALTER TABLE IF EXISTS ONLY public."ServicePriceHistory" DROP CONSTRAINT IF EXISTS "ServicePriceHistory_pkey";
ALTER TABLE IF EXISTS ONLY public."ServiceLinkCheck" DROP CONSTRAINT IF EXISTS "ServiceLinkCheck_pkey";
ALTER TABLE IF EXISTS ONLY public."ServiceEditHistory" DROP CONSTRAINT IF EXISTS "ServiceEditHistory_pkey";
ALTER TABLE IF EXISTS ONLY public."ServiceDraft" DROP CONSTRAINT IF EXISTS "ServiceDraft_pkey";
ALTER TABLE IF EXISTS ONLY public."ServiceCustomerAccess" DROP CONSTRAINT IF EXISTS "ServiceCustomerAccess_pkey";
ALTER TABLE IF EXISTS ONLY public."SecurityEvent" DROP CONSTRAINT IF EXISTS "SecurityEvent_pkey";
ALTER TABLE IF EXISTS ONLY public."RoutingAuditLog" DROP CONSTRAINT IF EXISTS "RoutingAuditLog_pkey";
ALTER TABLE IF EXISTS ONLY public."Refill" DROP CONSTRAINT IF EXISTS "Refill_pkey";
ALTER TABLE IF EXISTS ONLY public."RateLimit" DROP CONSTRAINT IF EXISTS "RateLimit_pkey";
ALTER TABLE IF EXISTS ONLY public."Provider" DROP CONSTRAINT IF EXISTS "Provider_pkey";
ALTER TABLE IF EXISTS ONLY public."ProviderProxy" DROP CONSTRAINT IF EXISTS "ProviderProxy_pkey";
ALTER TABLE IF EXISTS ONLY public."ProviderProxyLog" DROP CONSTRAINT IF EXISTS "ProviderProxyLog_pkey";
ALTER TABLE IF EXISTS ONLY public."ProviderOutbox" DROP CONSTRAINT IF EXISTS "ProviderOutbox_pkey";
ALTER TABLE IF EXISTS ONLY public."PromoCode" DROP CONSTRAINT IF EXISTS "PromoCode_pkey";
ALTER TABLE IF EXISTS ONLY public."PromoCodeUsage" DROP CONSTRAINT IF EXISTS "PromoCodeUsage_pkey";
ALTER TABLE IF EXISTS ONLY public."ProcessedBonusEvent" DROP CONSTRAINT IF EXISTS "ProcessedBonusEvent_pkey";
ALTER TABLE IF EXISTS ONLY public."PreLaunchLead" DROP CONSTRAINT IF EXISTS "PreLaunchLead_pkey";
ALTER TABLE IF EXISTS ONLY public."PiiAccessLog" DROP CONSTRAINT IF EXISTS "PiiAccessLog_pkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_pkey";
ALTER TABLE IF EXISTS ONLY public."Page" DROP CONSTRAINT IF EXISTS "Page_pkey";
ALTER TABLE IF EXISTS ONLY public."Order" DROP CONSTRAINT IF EXISTS "Order_pkey";
ALTER TABLE IF EXISTS ONLY public."OrderRecoveryIncident" DROP CONSTRAINT IF EXISTS "OrderRecoveryIncident_pkey";
ALTER TABLE IF EXISTS ONLY public."Network" DROP CONSTRAINT IF EXISTS "Network_pkey";
ALTER TABLE IF EXISTS ONLY public."MessageAttachment" DROP CONSTRAINT IF EXISTS "MessageAttachment_pkey";
ALTER TABLE IF EXISTS ONLY public."ManualBalanceAdjustment" DROP CONSTRAINT IF EXISTS "ManualBalanceAdjustment_pkey";
ALTER TABLE IF EXISTS ONLY public."LoginLog" DROP CONSTRAINT IF EXISTS "LoginLog_pkey";
ALTER TABLE IF EXISTS ONLY public."LegalDocumentVersion" DROP CONSTRAINT IF EXISTS "LegalDocumentVersion_pkey";
ALTER TABLE IF EXISTS ONLY public."LedgerEntry" DROP CONSTRAINT IF EXISTS "LedgerEntry_pkey";
ALTER TABLE IF EXISTS ONLY public."Invoice" DROP CONSTRAINT IF EXISTS "Invoice_pkey";
ALTER TABLE IF EXISTS ONLY public."FeatureFlag" DROP CONSTRAINT IF EXISTS "FeatureFlag_pkey";
ALTER TABLE IF EXISTS ONLY public."EmployeeResponsibilityConsent" DROP CONSTRAINT IF EXISTS "EmployeeResponsibilityConsent_pkey";
ALTER TABLE IF EXISTS ONLY public."EconomicOptimizationSnapshot" DROP CONSTRAINT IF EXISTS "EconomicOptimizationSnapshot_pkey";
ALTER TABLE IF EXISTS ONLY public."CxApologyCompensation" DROP CONSTRAINT IF EXISTS "CxApologyCompensation_pkey";
ALTER TABLE IF EXISTS ONLY public."CustomerGroup" DROP CONSTRAINT IF EXISTS "CustomerGroup_pkey";
ALTER TABLE IF EXISTS ONLY public."ContentItem" DROP CONSTRAINT IF EXISTS "ContentItem_pkey";
ALTER TABLE IF EXISTS ONLY public."ContentCategory" DROP CONSTRAINT IF EXISTS "ContentCategory_pkey";
ALTER TABLE IF EXISTS ONLY public."Commission" DROP CONSTRAINT IF EXISTS "Commission_pkey";
ALTER TABLE IF EXISTS ONLY public."Category" DROP CONSTRAINT IF EXISTS "Category_pkey";
ALTER TABLE IF EXISTS ONLY public."BonusRedemptionLog" DROP CONSTRAINT IF EXISTS "BonusRedemptionLog_pkey";
ALTER TABLE IF EXISTS ONLY public."BalanceAdjustmentPolicy" DROP CONSTRAINT IF EXISTS "BalanceAdjustmentPolicy_pkey";
ALTER TABLE IF EXISTS ONLY public."AuthToken" DROP CONSTRAINT IF EXISTS "AuthToken_pkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_pkey";
ALTER TABLE IF EXISTS ONLY public."Article" DROP CONSTRAINT IF EXISTS "Article_pkey";
ALTER TABLE IF EXISTS ONLY public."ApiConfig" DROP CONSTRAINT IF EXISTS "ApiConfig_pkey";
ALTER TABLE IF EXISTS ONLY public."AnalyticsEvent" DROP CONSTRAINT IF EXISTS "AnalyticsEvent_pkey";
ALTER TABLE IF EXISTS ONLY public."AiPricingRecommendation" DROP CONSTRAINT IF EXISTS "AiPricingRecommendation_pkey";
ALTER TABLE IF EXISTS ONLY public."AdminAuditLog" DROP CONSTRAINT IF EXISTS "AdminAuditLog_pkey";
ALTER TABLE IF EXISTS public."Service" ALTER COLUMN "numericId" DROP DEFAULT;
ALTER TABLE IF EXISTS public."Refill" ALTER COLUMN "numericId" DROP DEFAULT;
ALTER TABLE IF EXISTS public."Order" ALTER COLUMN "numericId" DROP DEFAULT;
DROP TABLE IF EXISTS public.revenue_recognition;
DROP TABLE IF EXISTS public.reconciliation_report;
DROP TABLE IF EXISTS public.provider_service_backup;
DROP TABLE IF EXISTS public.ledger_period;
DROP TABLE IF EXISTS public.api_request_log;
DROP TABLE IF EXISTS public."UserNote";
DROP TABLE IF EXISTS public."User";
DROP TABLE IF EXISTS public."UrlPattern";
DROP TABLE IF EXISTS public."TicketMessage";
DROP TABLE IF EXISTS public."TicketFeedback";
DROP TABLE IF EXISTS public."Ticket";
DROP TABLE IF EXISTS public."Tenant";
DROP TABLE IF EXISTS public."TelegramTemplate";
DROP TABLE IF EXISTS public."TelegramProxy";
DROP TABLE IF EXISTS public."TelegramErrorLog";
DROP TABLE IF EXISTS public."TelegramDailyStat";
DROP TABLE IF EXISTS public."TelegramButton";
DROP TABLE IF EXISTS public."TelegramBotInstance";
DROP TABLE IF EXISTS public."SystemSettings";
DROP TABLE IF EXISTS public."SystemSetting";
DROP TABLE IF EXISTS public."SupportTemplate";
DROP TABLE IF EXISTS public."SupportLimitUsage";
DROP TABLE IF EXISTS public."SupportHourlyUsage";
DROP TABLE IF EXISTS public."SupportFinancialAction";
DROP TABLE IF EXISTS public."StorefrontKey";
DROP TABLE IF EXISTS public."StaffShift";
DROP TABLE IF EXISTS public."StaffRole";
DROP TABLE IF EXISTS public."StaffPermission";
DROP TABLE IF EXISTS public."SmartTask";
DROP TABLE IF EXISTS public."SmartSnapshot";
DROP TABLE IF EXISTS public."SmartExecution";
DROP TABLE IF EXISTS public."SmartDetectedUser";
DROP TABLE IF EXISTS public."SmartChannelMetric";
DROP TABLE IF EXISTS public."SmartCampaign";
DROP TABLE IF EXISTS public."SlaTelemetrySnapshot";
DROP TABLE IF EXISTS public."ShadowService";
DROP TABLE IF EXISTS public."Session";
DROP SEQUENCE IF EXISTS public."Service_numericId_seq";
DROP TABLE IF EXISTS public."ServiceSmartConfig";
DROP TABLE IF EXISTS public."ServiceRoute";
DROP TABLE IF EXISTS public."ServicePriceHistory";
DROP TABLE IF EXISTS public."ServiceLinkCheck";
DROP TABLE IF EXISTS public."ServiceEditHistory";
DROP TABLE IF EXISTS public."ServiceDraft";
DROP TABLE IF EXISTS public."ServiceCustomerAccess";
DROP TABLE IF EXISTS public."Service";
DROP TABLE IF EXISTS public."SecurityEvent";
DROP TABLE IF EXISTS public."RoutingAuditLog";
DROP SEQUENCE IF EXISTS public."Refill_numericId_seq";
DROP TABLE IF EXISTS public."Refill";
DROP TABLE IF EXISTS public."RateLimit";
DROP TABLE IF EXISTS public."ProviderProxyLog";
DROP TABLE IF EXISTS public."ProviderProxy";
DROP TABLE IF EXISTS public."ProviderOutbox";
DROP TABLE IF EXISTS public."Provider";
DROP TABLE IF EXISTS public."PromoCodeUsage";
DROP TABLE IF EXISTS public."PromoCode";
DROP TABLE IF EXISTS public."ProcessedBonusEvent";
DROP TABLE IF EXISTS public."PreLaunchLead";
DROP TABLE IF EXISTS public."PiiAccessLog";
DROP TABLE IF EXISTS public."Payment";
DROP TABLE IF EXISTS public."Page";
DROP SEQUENCE IF EXISTS public."Order_numericId_seq";
DROP TABLE IF EXISTS public."OrderRecoveryIncident";
DROP TABLE IF EXISTS public."Order";
DROP TABLE IF EXISTS public."Network";
DROP TABLE IF EXISTS public."MessageAttachment";
DROP TABLE IF EXISTS public."ManualBalanceAdjustment";
DROP TABLE IF EXISTS public."LoginLog";
DROP TABLE IF EXISTS public."LegalDocumentVersion";
DROP TABLE IF EXISTS public."LedgerEntry";
DROP TABLE IF EXISTS public."Invoice";
DROP TABLE IF EXISTS public."FeatureFlag";
DROP TABLE IF EXISTS public."EmployeeResponsibilityConsent";
DROP TABLE IF EXISTS public."EconomicOptimizationSnapshot";
DROP TABLE IF EXISTS public."CxApologyCompensation";
DROP TABLE IF EXISTS public."CustomerGroup";
DROP TABLE IF EXISTS public."ContentItem";
DROP TABLE IF EXISTS public."ContentCategory";
DROP TABLE IF EXISTS public."Commission";
DROP TABLE IF EXISTS public."Category";
DROP TABLE IF EXISTS public."BonusRedemptionLog";
DROP TABLE IF EXISTS public."BalanceAdjustmentPolicy";
DROP TABLE IF EXISTS public."AuthToken";
DROP TABLE IF EXISTS public."AuditLog";
DROP TABLE IF EXISTS public."Article";
DROP TABLE IF EXISTS public."ApiConfig";
DROP TABLE IF EXISTS public."AnalyticsEvent";
DROP TABLE IF EXISTS public."AiPricingRecommendation";
DROP TABLE IF EXISTS public."AdminAuditLog";
DROP TYPE IF EXISTS public."UsnScheme";
DROP TYPE IF EXISTS public."TicketStatus";
DROP TYPE IF EXISTS public."TicketSource";
DROP TYPE IF EXISTS public."TelegramBotRole";
DROP TYPE IF EXISTS public."SmartTaskStatus";
DROP TYPE IF EXISTS public."SmartCampaignStatus";
DROP TYPE IF EXISTS public."RecommendationStatus";
DROP TYPE IF EXISTS public."OrderStatus";
DROP TYPE IF EXISTS public."OptimizationSnapshotStatus";
DROP TYPE IF EXISTS public."MessageSender";
DROP TYPE IF EXISTS public."ContentType";
DROP TYPE IF EXISTS public."ArticleStatus";
--
-- Name: ArticleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ArticleStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED'
);


--
-- Name: ContentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ContentType" AS ENUM (
    'PAGE',
    'ACADEMY_LESSON',
    'GLOSSARY_TERM',
    'NEWS_POST'
);


--
-- Name: MessageSender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MessageSender" AS ENUM (
    'USER',
    'STAFF',
    'INTERNAL'
);


--
-- Name: OptimizationSnapshotStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OptimizationSnapshotStatus" AS ENUM (
    'GENERATED',
    'APPLIED',
    'PARTIALLY_APPLIED',
    'REJECTED',
    'EXPIRED',
    'ARCHIVED'
);


--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'AWAITING_PAYMENT',
    'PENDING',
    'PENDING_CHECK',
    'PROVISIONING',
    'IN_PROGRESS',
    'COMPLETED',
    'PARTIAL',
    'CANCELED',
    'ERROR',
    'CANCELING'
);


--
-- Name: RecommendationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RecommendationStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'AUTO_APPLIED'
);


--
-- Name: SmartCampaignStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SmartCampaignStatus" AS ENUM (
    'PLANNED',
    'RUNNING',
    'PAUSED',
    'COMPLETED',
    'ERROR'
);


--
-- Name: SmartTaskStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SmartTaskStatus" AS ENUM (
    'PLANNED',
    'SENT',
    'COMPLETED',
    'ERROR'
);


--
-- Name: TelegramBotRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TelegramBotRole" AS ENUM (
    'STORE_FULL',
    'SUPPORT_ONLY',
    'NEWS_BROADCAST',
    'STAFF_ADMIN',
    'CUSTOM_BUILDER'
);


--
-- Name: TicketSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketSource" AS ENUM (
    'WEB',
    'TELEGRAM',
    'EMAIL'
);


--
-- Name: TicketStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketStatus" AS ENUM (
    'OPEN',
    'PENDING',
    'CLOSED'
);


--
-- Name: UsnScheme; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UsnScheme" AS ENUM (
    'INCOME',
    'INCOME_EXPENSES'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AdminAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AdminAuditLog" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text,
    "adminId" text NOT NULL,
    "adminEmail" text NOT NULL,
    action text NOT NULL,
    target text NOT NULL,
    "targetType" text NOT NULL,
    "oldValue" text,
    "newValue" text,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AiPricingRecommendation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiPricingRecommendation" (
    id text NOT NULL,
    "snapshotId" text NOT NULL,
    "serviceId" text NOT NULL,
    "currentPriceRub" double precision NOT NULL,
    "proposedPriceRub" double precision NOT NULL,
    "currentMarkup" double precision NOT NULL,
    "proposedMarkup" double precision NOT NULL,
    "projectedMonthlyGainRub" double precision DEFAULT 0.0 NOT NULL,
    "confidenceScore" double precision DEFAULT 1.0 NOT NULL,
    status public."RecommendationStatus" DEFAULT 'PENDING'::public."RecommendationStatus" NOT NULL,
    "rejectionReason" text,
    "appliedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnalyticsEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnalyticsEvent" (
    id text NOT NULL,
    event text NOT NULL,
    metadata jsonb,
    "sessionId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ApiConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ApiConfig" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "isApiEnabled" boolean DEFAULT true NOT NULL,
    "prioritySupport" boolean DEFAULT true NOT NULL,
    "webhookUrl" text,
    "webhookSecret" text,
    "isWebhookActive" boolean DEFAULT false NOT NULL,
    "customLimitCents" integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: Article; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Article" (
    id text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    content text NOT NULL,
    status public."ArticleStatus" NOT NULL,
    category text NOT NULL,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "authorName" text DEFAULT 'Михаил'::text NOT NULL,
    "authorRole" text DEFAULT 'Системный архитектор прокси-сетей Smmplan'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    details text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AuthToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuthToken" (
    id text NOT NULL,
    token text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "userId" text NOT NULL,
    used boolean DEFAULT false NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "ipIssued" text,
    "ipUsed" text,
    "userAgentIssued" text,
    "userAgentUsed" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BalanceAdjustmentPolicy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BalanceAdjustmentPolicy" (
    id text NOT NULL,
    "scopeType" text NOT NULL,
    "staffRoleId" text,
    "userId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    "canRequestCredit" boolean DEFAULT false NOT NULL,
    "canRequestDebit" boolean DEFAULT false NOT NULL,
    "canApprove" boolean DEFAULT false NOT NULL,
    "canReject" boolean DEFAULT false NOT NULL,
    "canViewAll" boolean DEFAULT false NOT NULL,
    "canViewStats" boolean DEFAULT false NOT NULL,
    "maxCreditPerRequest" bigint DEFAULT 0 NOT NULL,
    "maxDebitPerRequest" bigint DEFAULT 0 NOT NULL,
    "maxCreditPerDay" bigint DEFAULT 0 NOT NULL,
    "maxDebitPerDay" bigint DEFAULT 0 NOT NULL,
    "maxTotalPerDay" bigint DEFAULT 0 NOT NULL,
    "maxApprovalPerRequest" bigint DEFAULT 0 NOT NULL,
    "allowedCreditReasonCodes" jsonb NOT NULL,
    "allowedDebitReasonCodes" jsonb NOT NULL,
    "allowedTargetRoles" jsonb NOT NULL,
    "requireTicket" boolean DEFAULT true NOT NULL,
    "requireOrderForDebit" boolean DEFAULT false NOT NULL,
    "blockBannedTargets" boolean DEFAULT true NOT NULL,
    "blockDeletedTargets" boolean DEFAULT true NOT NULL,
    "autoExecuteBelow" bigint DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BonusRedemptionLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BonusRedemptionLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "bonusType" text NOT NULL,
    "amountCents" bigint NOT NULL,
    "paymentFingerprint" text,
    "ipAddress" text,
    "userAgent" text,
    status text DEFAULT 'GRANTED'::text NOT NULL,
    "unlockAt" timestamp(3) without time zone,
    reason text,
    "tenantId" text DEFAULT 'smmplan'::text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "networkId" text,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    "activityType" text,
    "requireWarning" boolean DEFAULT false NOT NULL,
    "warningMessage" text,
    "analyzerTags" text,
    icon text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Commission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Commission" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "referrerId" text NOT NULL,
    amount bigint NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ContentCategory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContentCategory" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "parentId" text,
    sort integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ContentItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContentItem" (
    id text NOT NULL,
    type public."ContentType" DEFAULT 'PAGE'::public."ContentType" NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text,
    "coverImage" text,
    "contentJson" text,
    "contentHtml" text,
    "categoryId" text,
    "authorName" text,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "isPublished" boolean DEFAULT false NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "metaTitle" text,
    "metaDescription" text,
    "readTimeMinutes" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CustomerGroup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerGroup" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "discountPercent" double precision DEFAULT 0.0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CxApologyCompensation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CxApologyCompensation" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "orderId" text NOT NULL,
    "amountCents" bigint NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'GRANTED'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EconomicOptimizationSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EconomicOptimizationSnapshot" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "analyzedPeriodDays" integer DEFAULT 30 NOT NULL,
    "totalLeakageRub" double precision DEFAULT 0.0 NOT NULL,
    "leakingServicesCount" integer DEFAULT 0 NOT NULL,
    "executiveSummary" text NOT NULL,
    "toolExecutionTrace" jsonb,
    status public."OptimizationSnapshotStatus" DEFAULT 'GENERATED'::public."OptimizationSnapshotStatus" NOT NULL,
    "appliedBy" text,
    "appliedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: EmployeeResponsibilityConsent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmployeeResponsibilityConsent" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "documentVersionId" text,
    "documentVersionText" text DEFAULT '1.0'::text NOT NULL,
    "documentHash" text NOT NULL,
    "acceptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "acceptedIp" text,
    "acceptedUserAgent" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: FeatureFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FeatureFlag" (
    id text NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    state text DEFAULT 'OFF'::text NOT NULL,
    "updatedBy" text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "userId" text NOT NULL,
    amount bigint NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "fileUrl" text,
    "actUrl" text,
    "paymentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LedgerEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LedgerEntry" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text,
    "userId" text NOT NULL,
    "adminId" text,
    amount bigint NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'APPROVED'::text NOT NULL,
    "idempotencyKey" text,
    "transactionType" text DEFAULT 'PAYMENT'::text NOT NULL,
    immutable boolean DEFAULT false NOT NULL,
    "periodId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LegalDocumentVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LegalDocumentVersion" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    type text NOT NULL,
    version text NOT NULL,
    title text NOT NULL,
    "contentHash" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "effectiveAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LoginLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LoginLog" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text,
    email text NOT NULL,
    "userId" text,
    "ipAddress" text NOT NULL,
    "userAgent" text,
    success boolean NOT NULL,
    "failReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ManualBalanceAdjustment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ManualBalanceAdjustment" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "requestedBy" text NOT NULL,
    direction text NOT NULL,
    amount bigint NOT NULL,
    "reasonCode" text NOT NULL,
    "reasonNote" text NOT NULL,
    "ticketId" text,
    "orderId" text,
    "paymentId" text,
    status text DEFAULT 'PENDING_APPROVAL'::text NOT NULL,
    "idempotencyKey" text NOT NULL,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "rejectedBy" text,
    "rejectedAt" timestamp(3) without time zone,
    "rejectionReason" text,
    "executionError" text,
    "ledgerEntryId" text,
    "policySnapshot" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessageAttachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessageAttachment" (
    id text NOT NULL,
    "messageId" text NOT NULL,
    url text NOT NULL,
    type text NOT NULL,
    "mimeType" text NOT NULL,
    name text NOT NULL,
    size integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Network; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Network" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    icon text,
    sort integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "numericId" integer NOT NULL,
    "userId" text NOT NULL,
    "serviceId" text NOT NULL,
    "providerId" text,
    "providerServiceId" text,
    "externalId" text,
    "dripExternalIds" text[] DEFAULT ARRAY[]::text[],
    link text NOT NULL,
    "isLinkOverridden" boolean DEFAULT false NOT NULL,
    quantity integer NOT NULL,
    status public."OrderStatus" DEFAULT 'AWAITING_PAYMENT'::public."OrderStatus" NOT NULL,
    remains integer DEFAULT 0 NOT NULL,
    start_count integer,
    charge bigint NOT NULL,
    "providerCost" bigint NOT NULL,
    error text,
    "actualProviderCost" bigint,
    "realMarginDelta" bigint,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "isTest" boolean DEFAULT false NOT NULL,
    email text,
    "customData" text,
    "usdToRubRate" double precision,
    "environmentMode" text DEFAULT 'PRODUCTION'::text NOT NULL,
    "isDripFeed" boolean DEFAULT false NOT NULL,
    runs integer,
    "interval" integer,
    "currentRun" integer DEFAULT 0 NOT NULL,
    "nextRunAt" timestamp(3) without time zone,
    "waitingUntil" timestamp(3) without time zone,
    "discountCents" bigint DEFAULT 0 NOT NULL,
    "promoCodeId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "paymentId" text,
    "idempotencyKey" text,
    "abVariant" text,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL
);


--
-- Name: OrderRecoveryIncident; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderRecoveryIncident" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "userId" text NOT NULL,
    "originalProviderId" text NOT NULL,
    "swappedProviderId" text NOT NULL,
    "absorbedDeltaCents" bigint DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'EXECUTED'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Order_numericId_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Order_numericId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Order_numericId_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Order_numericId_seq" OWNED BY public."Order"."numericId";


--
-- Name: Page; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Page" (
    id text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "orderId" text,
    amount bigint NOT NULL,
    currency text DEFAULT 'RUB'::text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "gatewayId" text,
    gateway text DEFAULT 'yookassa'::text NOT NULL,
    "consentIp" text,
    "consentUserAgent" text,
    "consentVersion" text,
    "checkoutUrl" text,
    "receiptId" text,
    "refundReceiptId" text,
    "abVariant" text,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PiiAccessLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PiiAccessLog" (
    id text NOT NULL,
    "staffId" text NOT NULL,
    "staffEmail" text NOT NULL,
    action text NOT NULL,
    "targetId" text NOT NULL,
    "targetType" text NOT NULL,
    fields text[],
    ip text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PreLaunchLead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PreLaunchLead" (
    id text NOT NULL,
    email text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "ipHash" text,
    source text DEFAULT 'holding_page'::text NOT NULL,
    "isNotified" boolean DEFAULT false NOT NULL,
    "notifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ProcessedBonusEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProcessedBonusEvent" (
    id text NOT NULL,
    "eventType" text NOT NULL,
    "eventId" text NOT NULL,
    "userId" text NOT NULL,
    "amountCents" bigint NOT NULL,
    status text DEFAULT 'PROCESSED'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PromoCode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PromoCode" (
    id text NOT NULL,
    code text NOT NULL,
    type text DEFAULT 'DISCOUNT'::text NOT NULL,
    "discountPercent" double precision NOT NULL,
    amount integer DEFAULT 0 NOT NULL,
    "maxUses" integer DEFAULT 1 NOT NULL,
    uses integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text,
    "utmSource" text,
    "utmMedium" text,
    "utmCampaign" text,
    "budgetCents" integer DEFAULT 0 NOT NULL,
    "isSuspicious" boolean DEFAULT false NOT NULL
);


--
-- Name: PromoCodeUsage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PromoCodeUsage" (
    id text NOT NULL,
    "promoCodeId" text NOT NULL,
    "userId" text NOT NULL,
    "orderId" text,
    "discountCents" bigint NOT NULL,
    "revenueCents" bigint NOT NULL,
    "profitCents" bigint NOT NULL,
    "isSuspicious" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Provider; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Provider" (
    id text NOT NULL,
    name text NOT NULL,
    "apiUrl" text NOT NULL,
    "apiKey" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    metadata jsonb,
    "providerType" text DEFAULT 'SMM_PANEL'::text NOT NULL,
    "syncLock" boolean DEFAULT false NOT NULL,
    "balanceCurrency" text DEFAULT 'USD'::text NOT NULL,
    "ticketUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "errorCount5m" integer DEFAULT 0 NOT NULL,
    "lastErrorAt" timestamp(3) without time zone,
    "lastSuccessAt" timestamp(3) without time zone,
    "avgResponseMs" integer DEFAULT 0 NOT NULL,
    "proxyId" text
);


--
-- Name: ProviderOutbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProviderOutbox" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "providerId" text NOT NULL,
    "idempotencyKey" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "providerOrderId" text,
    payload jsonb NOT NULL,
    "responseBody" jsonb,
    error text,
    attempts integer DEFAULT 0 NOT NULL,
    "lastAttemptAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProviderProxy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProviderProxy" (
    id text NOT NULL,
    label text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    protocol text DEFAULT 'https'::text NOT NULL,
    host text NOT NULL,
    port integer NOT NULL,
    username text,
    "passwordEncrypted" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "isRotating" boolean DEFAULT false NOT NULL,
    "geoCountry" text,
    tags text DEFAULT '[]'::text NOT NULL,
    "lastTestAt" timestamp(3) without time zone,
    "lastTestLatencyMs" integer,
    "lastTestSuccess" boolean,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "lastErrorAt" timestamp(3) without time zone,
    "consecutiveFailures" integer DEFAULT 0 NOT NULL,
    category text DEFAULT 'PAID_PREMIUM'::text NOT NULL,
    "subscriptionUrl" text,
    "expiresAt" timestamp(3) without time zone,
    "trafficUsedBytes" bigint,
    "trafficTotalBytes" bigint,
    "lastSyncAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProviderProxyLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProviderProxyLog" (
    id text NOT NULL,
    "proxyId" text NOT NULL,
    "providerId" text,
    action text NOT NULL,
    url text,
    method text,
    "statusCode" integer,
    "latencyMs" integer,
    error text,
    "bytesSent" integer DEFAULT 0 NOT NULL,
    "bytesReceived" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RateLimit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RateLimit" (
    id text NOT NULL,
    ip text NOT NULL,
    endpoint text NOT NULL,
    hits integer DEFAULT 1 NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Refill; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Refill" (
    id text NOT NULL,
    "numericId" integer NOT NULL,
    "orderId" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "externalId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Refill_numericId_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Refill_numericId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Refill_numericId_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Refill_numericId_seq" OWNED BY public."Refill"."numericId";


--
-- Name: RoutingAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RoutingAuditLog" (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    "adminId" text,
    action text NOT NULL,
    "fromProviderId" text,
    "toProviderId" text,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SecurityEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SecurityEvent" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text,
    event text NOT NULL,
    severity text NOT NULL,
    ip text,
    details jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Service; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Service" (
    id text NOT NULL,
    "numericId" integer NOT NULL,
    name text NOT NULL,
    description text,
    icon text,
    features jsonb,
    "categoryId" text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "providerId" text,
    rate double precision NOT NULL,
    "providerCurrency" text DEFAULT 'USD'::text NOT NULL,
    "costPer1kRub" double precision,
    "currencyCapturedAt" timestamp(3) without time zone,
    "usdRateAtCapture" double precision,
    markup double precision DEFAULT 8.0 NOT NULL,
    "anomalyScore" integer DEFAULT 0 NOT NULL,
    "minQty" integer DEFAULT 10 NOT NULL,
    "maxQty" integer DEFAULT 100000 NOT NULL,
    "externalId" text,
    "dataHash" text,
    "lastSeenAt" timestamp(3) without time zone,
    "isDripFeedEnabled" boolean DEFAULT true NOT NULL,
    "isRefillEnabled" boolean DEFAULT false NOT NULL,
    "isCancelEnabled" boolean DEFAULT false NOT NULL,
    "isCustomName" boolean DEFAULT false NOT NULL,
    "isCustomDescription" boolean DEFAULT false NOT NULL,
    "qualityTier" text DEFAULT 'STANDARD'::text NOT NULL,
    "isQuarantined" boolean DEFAULT false NOT NULL,
    "pendingRate" double precision,
    "quarantineReason" text,
    "quarantinedAt" timestamp(3) without time zone,
    "cooldownUntil" timestamp(3) without time zone,
    "cooldownReason" text,
    "etaP50Seconds" integer,
    "etaP90Seconds" integer,
    "etaSampleCount" integer DEFAULT 0 NOT NULL,
    "etaSpeedClass" text,
    "etaUpdatedAt" timestamp(3) without time zone,
    "targetType" text DEFAULT 'POST'::text NOT NULL,
    "customDataType" text DEFAULT 'NONE'::text NOT NULL,
    "customDataLabel" text,
    "isMediaGroupAware" boolean DEFAULT false NOT NULL,
    "linkValidatorRegex" text,
    "linkPlaceholder" text,
    "linkHint" text,
    "requiresBotAdmin" boolean DEFAULT false NOT NULL,
    "requireWarning" boolean DEFAULT false NOT NULL,
    "warningMessage" text,
    "clientRequirement" text,
    "clientConfirmation" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "pricePer1000Cents" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    slug text,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


--
-- Name: ServiceCustomerAccess; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServiceCustomerAccess" (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    "customerGroupId" text NOT NULL,
    "isCustomPrice" boolean DEFAULT false NOT NULL,
    "customPriceRub" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ServiceDraft; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServiceDraft" (
    id text NOT NULL,
    "serviceId" text,
    "providerId" text,
    "externalId" text,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    name text NOT NULL,
    "cleanName" text,
    description text,
    "categoryId" text,
    "targetType" text DEFAULT 'POST'::text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "procurementRate" double precision DEFAULT 0.0 NOT NULL,
    "procurementCurrency" text DEFAULT 'USD'::text NOT NULL,
    markup double precision DEFAULT 3.0 NOT NULL,
    "retailPriceRub" double precision DEFAULT 0.0 NOT NULL,
    "minQty" integer DEFAULT 10 NOT NULL,
    "maxQty" integer DEFAULT 100000 NOT NULL,
    "validationStatus" text DEFAULT 'PENDING'::text NOT NULL,
    "linkCheckStatus" text DEFAULT 'UNCHECKED'::text NOT NULL,
    payload jsonb,
    "adminId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ServiceEditHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServiceEditHistory" (
    id text NOT NULL,
    "serviceId" text,
    "draftId" text,
    "adminId" text,
    "adminEmail" text,
    "changeType" text DEFAULT 'UPDATE'::text NOT NULL,
    field text,
    "oldValue" text,
    "newValue" text,
    comment text,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ServiceLinkCheck; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServiceLinkCheck" (
    id text NOT NULL,
    "serviceId" text,
    "targetType" text NOT NULL,
    "testUrl" text NOT NULL,
    "isSuccess" boolean DEFAULT false NOT NULL,
    "statusCode" integer,
    "responseTimeMs" integer,
    "errorMessage" text,
    "checkedBy" text,
    "checkedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ServicePriceHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServicePriceHistory" (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    rate double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ServiceRoute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServiceRoute" (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    "providerId" text NOT NULL,
    "providerServiceId" text NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "failoverMode" text DEFAULT 'manual'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ServiceSmartConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServiceSmartConfig" (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    "isEnabled" boolean DEFAULT false NOT NULL,
    "isTestMode" boolean DEFAULT false NOT NULL,
    "minChunk" integer DEFAULT 50 NOT NULL,
    "maxChunk" integer DEFAULT 200 NOT NULL,
    markup double precision DEFAULT 0.15 NOT NULL,
    "providersPriority" text[] DEFAULT ARRAY[]::text[],
    "useInviteBuffer" boolean DEFAULT false NOT NULL,
    "autoCompensate" boolean DEFAULT true NOT NULL,
    "checkIntervalMins" integer DEFAULT 120 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Service_numericId_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Service_numericId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Service_numericId_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Service_numericId_seq" OWNED BY public."Service"."numericId";


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "userAgent" text,
    "ipAddress" text,
    "impersonatedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ShadowService; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ShadowService" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    "externalId" text NOT NULL,
    name text NOT NULL,
    type text,
    category text,
    rate double precision NOT NULL,
    "rateRub" double precision NOT NULL,
    min integer NOT NULL,
    max integer NOT NULL,
    refill boolean DEFAULT false NOT NULL,
    cancel boolean DEFAULT false NOT NULL,
    dripfeed boolean DEFAULT false NOT NULL,
    "cleanName" text,
    platform text,
    "normalizedCategory" text,
    "targetType" text DEFAULT 'POST'::text NOT NULL,
    "customDataType" text DEFAULT 'NONE'::text NOT NULL,
    "isMediaGroupAware" boolean DEFAULT false NOT NULL,
    "isPrivate" boolean DEFAULT false NOT NULL,
    warranty integer DEFAULT 0 NOT NULL,
    geo text,
    velocity integer DEFAULT 0 NOT NULL,
    "anomalyScore" double precision DEFAULT 0.0 NOT NULL,
    "tenantId" text DEFAULT 'all'::text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SlaTelemetrySnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SlaTelemetrySnapshot" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    "serviceId" text,
    "p50Seconds" integer NOT NULL,
    "p90Seconds" integer NOT NULL,
    "p99Seconds" integer NOT NULL,
    "sampleCount" integer NOT NULL,
    "isDegraded" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SmartCampaign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmartCampaign" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "serviceId" text NOT NULL,
    status public."SmartCampaignStatus" DEFAULT 'PLANNED'::public."SmartCampaignStatus" NOT NULL,
    link text NOT NULL,
    "totalQuantity" integer NOT NULL,
    "totalDays" integer NOT NULL,
    "isTestMode" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "paymentId" text,
    "orderId" text
);


--
-- Name: SmartChannelMetric; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmartChannelMetric" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "memberCount" integer NOT NULL,
    delta integer NOT NULL,
    "detectedDrops" integer DEFAULT 0 NOT NULL,
    "compensatedQty" integer DEFAULT 0 NOT NULL
);


--
-- Name: SmartDetectedUser; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmartDetectedUser" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "telegramId" text NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    reasons text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SmartExecution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmartExecution" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "providerId" text,
    "externalOrderId" text,
    "qtySent" integer NOT NULL,
    "qtyDelivered" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SmartSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmartSnapshot" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "channelUrl" text NOT NULL,
    members text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SmartTask; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmartTask" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    quantity integer NOT NULL,
    "runAt" timestamp(3) without time zone NOT NULL,
    status public."SmartTaskStatus" DEFAULT 'PLANNED'::public."SmartTaskStatus" NOT NULL,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StaffPermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StaffPermission" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "roleId" text NOT NULL,
    section text NOT NULL,
    "canView" boolean DEFAULT false NOT NULL,
    "canEdit" boolean DEFAULT false NOT NULL
);


--
-- Name: StaffRole; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StaffRole" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "allowedTenants" text[] DEFAULT ARRAY['smmplan'::text],
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StaffShift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StaffShift" (
    id text NOT NULL,
    "userId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "shiftType" text DEFAULT 'DAY'::text NOT NULL,
    status text DEFAULT 'PLANNED'::text NOT NULL,
    "substituteUserId" text,
    "substituteHours" double precision DEFAULT 0 NOT NULL,
    "rateRubles" double precision DEFAULT 2500 NOT NULL,
    "bonusRubles" double precision DEFAULT 0 NOT NULL,
    "penaltyRubles" double precision DEFAULT 0 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StorefrontKey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StorefrontKey" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    type text NOT NULL,
    "keyPrefix" text NOT NULL,
    "keyHash" text NOT NULL,
    name text,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastUsedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupportFinancialAction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupportFinancialAction" (
    id text NOT NULL,
    "tenantId" text,
    "staffUserId" text NOT NULL,
    "targetUserId" text NOT NULL,
    direction text NOT NULL,
    source text NOT NULL,
    "amountCents" bigint NOT NULL,
    "reasonCode" text NOT NULL,
    "reasonNote" text NOT NULL,
    "ticketId" text,
    "orderId" text,
    "paymentId" text,
    "policyId" text,
    "policySnapshot" jsonb,
    "idempotencyKey" text NOT NULL,
    status text NOT NULL,
    "ledgerEntryId" text,
    "consentId" text,
    "reviewStatus" text DEFAULT 'PENDING'::text NOT NULL,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" text,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupportHourlyUsage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupportHourlyUsage" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text,
    "staffUserId" text NOT NULL,
    "hourKey" text NOT NULL,
    direction text NOT NULL,
    "amountCents" bigint DEFAULT 0 NOT NULL,
    "operationsCount" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupportLimitUsage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupportLimitUsage" (
    id text NOT NULL,
    "tenantId" text,
    "staffUserId" text NOT NULL,
    "dayKey" text NOT NULL,
    direction text NOT NULL,
    "amountCents" bigint DEFAULT 0 NOT NULL,
    "operationsCount" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupportTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupportTemplate" (
    id text NOT NULL,
    shortcut text,
    label text NOT NULL,
    text text NOT NULL,
    category text DEFAULT 'GENERAL'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "useCount" integer DEFAULT 0 NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SystemSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemSetting" (
    key text NOT NULL,
    value text NOT NULL,
    "group" text DEFAULT 'GENERAL'::text NOT NULL,
    description text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "updatedBy" text
);


--
-- Name: SystemSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemSettings" (
    id text NOT NULL,
    "isTestMode" boolean DEFAULT false NOT NULL,
    "environmentMode" text DEFAULT 'PRODUCTION'::text NOT NULL,
    "taxRate" double precision DEFAULT 6.0 NOT NULL,
    "usnScheme" public."UsnScheme" DEFAULT 'INCOME_EXPENSES'::public."UsnScheme" NOT NULL,
    "opexMonthly" integer DEFAULT 0 NOT NULL,
    "maintenanceMode" boolean DEFAULT false NOT NULL,
    "siteName" text DEFAULT 'Smmplan'::text NOT NULL,
    "siteDescription" text DEFAULT ''::text NOT NULL,
    "telegramBotToken" text,
    "telegramBotMode" text DEFAULT 'polling'::text,
    "welcomeMessage" text DEFAULT 'Добро пожаловать в Smmplan! Ваш персональный кабинет готов к работе.'::text,
    "telegramMenuConfig" jsonb,
    "telegramTemplates" jsonb,
    "telegramRatingReasons" jsonb,
    "telegramWebhookSecret" text,
    "telegramAllowedIps" text DEFAULT '[]'::text,
    "telegramRateLimitPerMin" integer DEFAULT 30,
    "telegramMaxMessageLength" integer DEFAULT 4096,
    "telegramProxyId" text,
    "telegramMaintenanceMode" boolean DEFAULT false NOT NULL,
    "telegramLogErrors" boolean DEFAULT true NOT NULL,
    "telegramEnableCsat" boolean DEFAULT true NOT NULL,
    "telegramEnableSmartBind" boolean DEFAULT true NOT NULL,
    "yookassaShopId" text,
    "yookassaSecretKey" text,
    "yookassaWebhookSecret" text,
    "yookassaTestShopId" text,
    "yookassaTestSecretKey" text,
    "cryptoBotToken" text,
    "quarantineThreshold" double precision DEFAULT 0.20 NOT NULL,
    "globalMarkup" double precision DEFAULT 3.0 NOT NULL,
    "safetyFloor" double precision DEFAULT 1.0 NOT NULL,
    "exchangeRateUSD" double precision DEFAULT 90.0 NOT NULL,
    "exchangeRateUpdatedAt" timestamp(3) without time zone,
    "siteLogoUrl" text,
    "siteFaviconUrl" text,
    "emailProvider" text DEFAULT 'SMTP'::text NOT NULL,
    "resendApiKey" text,
    "smtpHost" text,
    "smtpPort" integer DEFAULT 465 NOT NULL,
    "smtpUser" text,
    "smtpPassword" text,
    "supportEmailDomain" text,
    "inboundEmailWebhookSecret" text,
    "robokassaLogin" text,
    "robokassaPassword" text,
    "robokassaWebhookPassword" text,
    "geminiApiKeys" text,
    "geminiProxy" text,
    "alfaBankAccountNumber" text,
    "alfaBankApiKey" text,
    "alfaBankClientSecret" text,
    "alfaBankApiBaseUrl" text DEFAULT 'https://business.alfabank.ru/ext-api/v1'::text,
    "alfaBankIsSandbox" boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "contactSupportEmail" text,
    "contactPrivacyEmail" text,
    "contactTelegramBot" text,
    "contactTelegramChannel" text,
    "contactWhatsApp" text,
    "contactVk" text,
    "legalCompanyName" text,
    "legalCompanyInn" text,
    "legalCompanyOgrnip" text,
    "legalCompanyAddress" text
);


--
-- Name: TelegramBotInstance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TelegramBotInstance" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    name text NOT NULL,
    username text,
    "tokenEncrypted" text NOT NULL,
    role public."TelegramBotRole" DEFAULT 'CUSTOM_BUILDER'::public."TelegramBotRole" NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "maintenanceMode" boolean DEFAULT false NOT NULL,
    "welcomeMessage" text,
    "menuConfig" jsonb,
    templates jsonb,
    "flowConfig" jsonb,
    "allowedUserIds" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TelegramButton; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TelegramButton" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    label text NOT NULL,
    emoji text DEFAULT ''::text NOT NULL,
    command text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    "row" integer DEFAULT 0 NOT NULL,
    col integer DEFAULT 0 NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isVisible" boolean DEFAULT true NOT NULL,
    "isNew" boolean DEFAULT false NOT NULL,
    "requiresAuth" boolean DEFAULT false NOT NULL,
    "openUrl" text,
    style text DEFAULT 'default'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TelegramDailyStat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TelegramDailyStat" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    date date NOT NULL,
    "messagesReceived" integer DEFAULT 0 NOT NULL,
    "messagesSent" integer DEFAULT 0 NOT NULL,
    "commandsHandled" integer DEFAULT 0 NOT NULL,
    "callbacksHandled" integer DEFAULT 0 NOT NULL,
    "newUsers" integer DEFAULT 0 NOT NULL,
    "ordersCreated" integer DEFAULT 0 NOT NULL,
    "ticketsCreated" integer DEFAULT 0 NOT NULL,
    "errorsCount" integer DEFAULT 0 NOT NULL,
    "avgLatencyMs" integer,
    "p99LatencyMs" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TelegramErrorLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TelegramErrorLog" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    level text DEFAULT 'ERROR'::text NOT NULL,
    source text NOT NULL,
    "errorCode" text,
    "errorMessage" text NOT NULL,
    "stackTrace" text,
    "updateData" text,
    "userId" text,
    "chatId" text,
    "isResolved" boolean DEFAULT false NOT NULL,
    "resolvedBy" text,
    "resolvedAt" timestamp(3) without time zone,
    "occurrenceCount" integer DEFAULT 1 NOT NULL,
    "firstSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TelegramProxy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TelegramProxy" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    label text NOT NULL,
    protocol text DEFAULT 'socks5'::text NOT NULL,
    host text NOT NULL,
    port integer NOT NULL,
    username text,
    "passwordEncrypted" text,
    "isActive" boolean DEFAULT false NOT NULL,
    "lastTestAt" timestamp(3) without time zone,
    "lastTestLatencyMs" integer,
    "lastTestSuccess" boolean,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TelegramTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TelegramTemplate" (
    id text NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    body text NOT NULL,
    "parseMode" text DEFAULT 'HTML'::text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    variables text DEFAULT '[]'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    domain text NOT NULL,
    "customDomain" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "vaultSalt" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Ticket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Ticket" (
    id text NOT NULL,
    "userId" text NOT NULL,
    subject text NOT NULL,
    status public."TicketStatus" DEFAULT 'OPEN'::public."TicketStatus" NOT NULL,
    source public."TicketSource" DEFAULT 'WEB'::public."TicketSource" NOT NULL,
    "orderId" text,
    "paymentId" text,
    "firstRespondedAt" timestamp(3) without time zone,
    "resolvedAt" timestamp(3) without time zone,
    tags text[] DEFAULT ARRAY[]::text[],
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL
);


--
-- Name: TicketFeedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TicketFeedback" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    "userId" text NOT NULL,
    score integer NOT NULL,
    reasons text[] DEFAULT ARRAY[]::text[],
    comment text,
    source public."TicketSource" DEFAULT 'TELEGRAM'::public."TicketSource" NOT NULL,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TicketMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TicketMessage" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    sender public."MessageSender" NOT NULL,
    text text NOT NULL,
    "mediaUrl" text,
    "mediaType" text,
    "replyToId" text,
    "telegramMsgId" text,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "isEdited" boolean DEFAULT false NOT NULL,
    "originalText" text,
    "orderId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: UrlPattern; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UrlPattern" (
    id text NOT NULL,
    "networkId" text NOT NULL,
    pattern text NOT NULL,
    "contentType" text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text,
    role text DEFAULT 'USER'::text NOT NULL,
    "preferredDashboard" text DEFAULT 'CLASSIC'::text NOT NULL,
    balance bigint DEFAULT 0 NOT NULL,
    "quarantineBalance" bigint DEFAULT 0 NOT NULL,
    "totalSpent" bigint DEFAULT 0 NOT NULL,
    "personalDiscount" double precision DEFAULT 0.0 NOT NULL,
    "discountEndsAt" timestamp(3) without time zone,
    "supportLimitCents" integer DEFAULT 50000 NOT NULL,
    "supportSpentTodayCents" integer DEFAULT 0 NOT NULL,
    "supportLastResetAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "apiKeyHash" text,
    "referralCode" text,
    "referredById" text,
    "referralBalance" integer DEFAULT 0 NOT NULL,
    "telegramId" text,
    "phoneHash" text,
    "isKycVerified" boolean DEFAULT false NOT NULL,
    "isEmailVerified" boolean DEFAULT true NOT NULL,
    "isBotOnly" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "tosAcceptedAt" timestamp(3) without time zone,
    "tosAcceptedIp" text,
    "adminNote" text,
    "adminNoteUpdatedAt" timestamp(3) without time zone,
    "adminNoteUpdatedBy" text,
    "geminiApiKey" text,
    "twoFactorEnabled" boolean DEFAULT false NOT NULL,
    "twoFactorSecret" text,
    "twoFactorBackupCodes" text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyName" text,
    inn text,
    kpp text,
    ogrn text,
    "legalAddress" text,
    "telegramNotifyOrders" boolean DEFAULT true NOT NULL,
    "telegramNotifyBalance" boolean DEFAULT true NOT NULL,
    "telegramNotifyTickets" boolean DEFAULT true NOT NULL,
    "staffRoleId" text,
    "bonusBalance" bigint DEFAULT 0 NOT NULL,
    "customerGroupId" text,
    "tenantId" text DEFAULT 'smmplan'::text NOT NULL,
    "allowedTenants" text[] DEFAULT ARRAY['smmplan'::text]
);


--
-- Name: UserNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserNote" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "authorId" text,
    content text NOT NULL,
    "orderId" text,
    "ticketId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: api_request_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_request_log (
    id text NOT NULL,
    api_key_hash text NOT NULL,
    action text NOT NULL,
    params jsonb,
    http_status integer NOT NULL,
    latency_ms integer NOT NULL,
    ip text,
    user_agent text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ledger_period; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger_period (
    id text NOT NULL,
    month text NOT NULL,
    start_date timestamp(3) without time zone NOT NULL,
    end_date timestamp(3) without time zone NOT NULL,
    frozen boolean DEFAULT false NOT NULL,
    frozen_at timestamp(3) without time zone,
    frozen_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: provider_service_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_service_backup (
    id text NOT NULL,
    service_id text NOT NULL,
    primary_provider_id text NOT NULL,
    backup_provider_id text NOT NULL,
    backup_external_id text,
    priority integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: reconciliation_report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconciliation_report (
    id text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    bank_total bigint NOT NULL,
    db_total bigint NOT NULL,
    ledger_total bigint NOT NULL,
    delta_bank_vs_db bigint NOT NULL,
    delta_db_vs_ledger bigint NOT NULL,
    status text DEFAULT 'OK'::text NOT NULL,
    details jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: revenue_recognition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revenue_recognition (
    id text NOT NULL,
    order_id text NOT NULL,
    amount bigint NOT NULL,
    recognized_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reversed boolean DEFAULT false NOT NULL,
    reversed_at timestamp(3) without time zone,
    reversal_reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: Order numericId; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order" ALTER COLUMN "numericId" SET DEFAULT nextval('public."Order_numericId_seq"'::regclass);


--
-- Name: Refill numericId; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refill" ALTER COLUMN "numericId" SET DEFAULT nextval('public."Refill_numericId_seq"'::regclass);


--
-- Name: Service numericId; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service" ALTER COLUMN "numericId" SET DEFAULT nextval('public."Service_numericId_seq"'::regclass);


--
-- Data for Name: AdminAuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AdminAuditLog" (id, "tenantId", "adminId", "adminEmail", action, target, "targetType", "oldValue", "newValue", "ipAddress", "createdAt") FROM stdin;
cmug4ul1x000y4u8ukel5y0c0	smmplan	cmug4ul0d000o4u8un6ut0m24	owasp_owner_1790290684380_0.3451263442695478@smmplan.pro	UPDATE_USER_BALANCE	cmug4ul0z000u4u8u9z5ehfs0	PAYMENT_MANUAL_APPROVE	{"status":"PENDING","amount":50000}	{"status":"SUCCEEDED","amount":50000,"gatewayId":"sanitized-tx-1790290684408-0.44025297224816495","notes":"=cmd|'/C calc'!A0; ' OR '1'='1; --","adminRole":"OWNER"}	127.0.0.1	2026-09-24 22:58:04.437
cmug4uluk00194u8ujtnkgfim	smmplan	cmug4ultf00104u8ucyplfxo4	owasp_admin_1790290685427_0.24844209163853992@smmplan.pro	UPDATE_USER_BALANCE	cmug4ultw00154u8ubbjq0kjm	PAYMENT_MANUAL_APPROVE	{"status":"PENDING","amount":150000}	{"status":"SUCCEEDED","amount":150000,"gatewayId":"audit-log-tx-1790290685448-0.2532689644686261","notes":"Проверка фиксации аудита","adminRole":"ADMIN"}	127.0.0.1	2026-09-24 22:58:05.469
cmug4us9t00009xd0nn4ofjhp	smmplan	staff_1	admin@smmplan.pro	TENANT_DOMAIN_VERIFY	gamma-agency	TenantDomain	\N	{"status":"VERIFIED","customDomain":"agency-direct.com"}	\N	2026-09-24 22:58:13.794
cmug4usa400019xd08a8y14px	smmplan	staff_1	admin@smmplan.pro	TENANT_DOMAIN_TOKEN_ROTATE	gamma-agency	TenantDomain	\N	{"token":"[SCRUBBED]"}	\N	2026-09-24 22:58:13.804
cmug4vtor0007ok51rdqcy17t	smmplan	cmug4vtn20000ok51vg56g0ie	pci_admin_1790290742198_0.9631527787865757@smmplan.pro	UPDATE_USER_BALANCE	cmug4vtnf0003ok518y8tektc	PAYMENT_MANUAL_APPROVE	{"status":"PENDING","amount":100000}	{"status":"SUCCEEDED","amount":100000,"gatewayId":"concurrent-tx-0-1790290742241-0.6971087359382304","notes":"Simultaneous click #0","adminRole":"ADMIN"}	127.0.0.1	2026-09-24 22:59:02.283
cmug4vw4m000fok51hv9lp4sg	smmplan	cmug4vw3g0008ok51vxiai0wy	pci_admin_1790290745403_0.14844431822579174@smmplan.pro	UPDATE_USER_BALANCE	cmug4vw3s000bok51rjm2vzly	PAYMENT_MANUAL_APPROVE	{"status":"PENDING","amount":200000}	{"status":"SUCCEEDED","amount":200000,"gatewayId":"race-gateway-1790290745414-0.6363969581499567","notes":"Подтверждено оператором до вебхука","adminRole":"ADMIN"}	127.0.0.1	2026-09-24 22:59:05.446
cmug4vxff000ook51sp30lumm	smmplan	cmug4vxef000hok514qsn81ay	pci_admin_1790290747094_0.7019300000730149@smmplan.pro	UPDATE_USER_BALANCE	cmug4vxeq000kok51v0t14xxy	PAYMENT_MANUAL_APPROVE	{"status":"PENDING","amount":33333}	{"status":"SUCCEEDED","amount":33333,"gatewayId":"exactmath-tx-1790290747111-0.6736276246977544","notes":"Проверка точности до копейки","adminRole":"ADMIN"}	127.0.0.1	2026-09-24 22:59:07.131
cmugkmz5j0000lfw3fddgmthn	smmplan	staff_1	admin@smmplan.pro	TENANT_DOMAIN_VERIFY	gamma-agency	TenantDomain	\N	{"status":"VERIFIED","customDomain":"agency-direct.com"}	\N	2026-09-25 06:20:03.32
cmugkmz5r0001lfw3jggtiprx	smmplan	staff_1	admin@smmplan.pro	TENANT_DOMAIN_TOKEN_ROTATE	gamma-agency	TenantDomain	\N	{"token":"[SCRUBBED]"}	\N	2026-09-25 06:20:03.327
\.


--
-- Data for Name: AiPricingRecommendation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AiPricingRecommendation" (id, "snapshotId", "serviceId", "currentPriceRub", "proposedPriceRub", "currentMarkup", "proposedMarkup", "projectedMonthlyGainRub", "confidenceScore", status, "rejectionReason", "appliedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AnalyticsEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AnalyticsEvent" (id, event, metadata, "sessionId", "createdAt") FROM stdin;
\.


--
-- Data for Name: ApiConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ApiConfig" (id, "userId", "isApiEnabled", "prioritySupport", "webhookUrl", "webhookSecret", "isWebhookActive", "customLimitCents", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: Article; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Article" (id, slug, title, description, content, status, category, "viewCount", "createdAt", "updatedAt", "authorName", "authorRole", priority) FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuditLog" (id, "userId", action, details, "createdAt") FROM stdin;
\.


--
-- Data for Name: AuthToken; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuthToken" (id, token, "tenantId", "userId", used, "usedAt", "expiresAt", "ipIssued", "ipUsed", "userAgentIssued", "userAgentUsed", "createdAt") FROM stdin;
\.


--
-- Data for Name: BalanceAdjustmentPolicy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BalanceAdjustmentPolicy" (id, "scopeType", "staffRoleId", "userId", "isActive", enabled, "canRequestCredit", "canRequestDebit", "canApprove", "canReject", "canViewAll", "canViewStats", "maxCreditPerRequest", "maxDebitPerRequest", "maxCreditPerDay", "maxDebitPerDay", "maxTotalPerDay", "maxApprovalPerRequest", "allowedCreditReasonCodes", "allowedDebitReasonCodes", "allowedTargetRoles", "requireTicket", "requireOrderForDebit", "blockBannedTargets", "blockDeletedTargets", "autoExecuteBelow", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: BonusRedemptionLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BonusRedemptionLog" (id, "userId", "bonusType", "amountCents", "paymentFingerprint", "ipAddress", "userAgent", status, "unlockAt", reason, "tenantId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Category" (id, name, slug, "networkId", "tenantId", sort, "activityType", "requireWarning", "warningMessage", "analyzerTags", icon, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Commission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Commission" (id, "orderId", "referrerId", amount, status, "updatedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: ContentCategory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ContentCategory" (id, name, slug, "parentId", sort, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ContentItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ContentItem" (id, type, slug, title, excerpt, "coverImage", "contentJson", "contentHtml", "categoryId", "authorName", "viewCount", "isPublished", "publishedAt", "metaTitle", "metaDescription", "readTimeMinutes", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: CustomerGroup; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CustomerGroup" (id, name, slug, description, "tenantId", "isDefault", "discountPercent", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: CxApologyCompensation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CxApologyCompensation" (id, "userId", "orderId", "amountCents", reason, status, "createdAt") FROM stdin;
\.


--
-- Data for Name: EconomicOptimizationSnapshot; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."EconomicOptimizationSnapshot" (id, "tenantId", "analyzedPeriodDays", "totalLeakageRub", "leakingServicesCount", "executiveSummary", "toolExecutionTrace", status, "appliedBy", "appliedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: EmployeeResponsibilityConsent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."EmployeeResponsibilityConsent" (id, "userId", "tenantId", "documentVersionId", "documentVersionText", "documentHash", "acceptedAt", "acceptedIp", "acceptedUserAgent", status, "createdAt") FROM stdin;
\.


--
-- Data for Name: FeatureFlag; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FeatureFlag" (id, key, label, description, state, "updatedBy", "updatedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Invoice" (id, "userId", amount, status, "fileUrl", "actUrl", "paymentId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: LedgerEntry; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LedgerEntry" (id, "tenantId", "userId", "adminId", amount, reason, status, "idempotencyKey", "transactionType", immutable, "periodId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: LegalDocumentVersion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LegalDocumentVersion" (id, "tenantId", type, version, title, "contentHash", "isActive", "effectiveAt", "createdBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: LoginLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LoginLog" (id, "tenantId", email, "userId", "ipAddress", "userAgent", success, "failReason", "createdAt") FROM stdin;
\.


--
-- Data for Name: ManualBalanceAdjustment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ManualBalanceAdjustment" (id, "userId", "requestedBy", direction, amount, "reasonCode", "reasonNote", "ticketId", "orderId", "paymentId", status, "idempotencyKey", "approvedBy", "approvedAt", "rejectedBy", "rejectedAt", "rejectionReason", "executionError", "ledgerEntryId", "policySnapshot", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: MessageAttachment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MessageAttachment" (id, "messageId", url, type, "mimeType", name, size, "createdAt") FROM stdin;
\.


--
-- Data for Name: Network; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Network" (id, name, slug, icon, sort, "isActive", "tenantId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Order" (id, "numericId", "userId", "serviceId", "providerId", "providerServiceId", "externalId", "dripExternalIds", link, "isLinkOverridden", quantity, status, remains, start_count, charge, "providerCost", error, "actualProviderCost", "realMarginDelta", "retryCount", "isTest", email, "customData", "usdToRubRate", "environmentMode", "isDripFeed", runs, "interval", "currentRun", "nextRunAt", "waitingUntil", "discountCents", "promoCodeId", "createdAt", "updatedAt", "paymentId", "idempotencyKey", "abVariant", "tenantId") FROM stdin;
\.


--
-- Data for Name: OrderRecoveryIncident; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OrderRecoveryIncident" (id, "orderId", "userId", "originalProviderId", "swappedProviderId", "absorbedDeltaCents", reason, status, "createdAt") FROM stdin;
\.


--
-- Data for Name: Page; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Page" (id, slug, title, content, "updatedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Payment" (id, "userId", "orderId", amount, currency, status, "gatewayId", gateway, "consentIp", "consentUserAgent", "consentVersion", "checkoutUrl", "receiptId", "refundReceiptId", "abVariant", "tenantId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PiiAccessLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PiiAccessLog" (id, "staffId", "staffEmail", action, "targetId", "targetType", fields, ip, "userAgent", "createdAt") FROM stdin;
\.


--
-- Data for Name: PreLaunchLead; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PreLaunchLead" (id, email, "tenantId", "ipHash", source, "isNotified", "notifiedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: ProcessedBonusEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProcessedBonusEvent" (id, "eventType", "eventId", "userId", "amountCents", status, "createdAt") FROM stdin;
\.


--
-- Data for Name: PromoCode; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PromoCode" (id, code, type, "discountPercent", amount, "maxUses", uses, "isActive", "expiresAt", "createdAt", description, "utmSource", "utmMedium", "utmCampaign", "budgetCents", "isSuspicious") FROM stdin;
cmug4u8af0010psld33qc32h1	TESTPROMO_1790290667894_m7a	DISCOUNT	10	0	10	0	t	\N	2026-09-24 22:57:47.895	\N	\N	\N	\N	0	f
cmugkmh9x0010anfjseokehq8	TESTPROMO_1790317180148_50q	DISCOUNT	10	0	10	0	t	\N	2026-09-25 06:19:40.15	\N	\N	\N	\N	0	f
\.


--
-- Data for Name: PromoCodeUsage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PromoCodeUsage" (id, "promoCodeId", "userId", "orderId", "discountCents", "revenueCents", "profitCents", "isSuspicious", "createdAt") FROM stdin;
\.


--
-- Data for Name: Provider; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Provider" (id, name, "apiUrl", "apiKey", "isActive", metadata, "providerType", "syncLock", "balanceCurrency", "ticketUrl", "createdAt", "updatedAt", "errorCount5m", "lastErrorAt", "lastSuccessAt", "avgResponseMs", "proxyId") FROM stdin;
\.


--
-- Data for Name: ProviderOutbox; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProviderOutbox" (id, "orderId", "providerId", "idempotencyKey", status, "providerOrderId", payload, "responseBody", error, attempts, "lastAttemptAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ProviderProxy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProviderProxy" (id, label, description, protocol, host, port, username, "passwordEncrypted", "isActive", "isRotating", "geoCountry", tags, "lastTestAt", "lastTestLatencyMs", "lastTestSuccess", "errorCount", "lastErrorAt", "consecutiveFailures", category, "subscriptionUrl", "expiresAt", "trafficUsedBytes", "trafficTotalBytes", "lastSyncAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ProviderProxyLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProviderProxyLog" (id, "proxyId", "providerId", action, url, method, "statusCode", "latencyMs", error, "bytesSent", "bytesReceived", "createdAt") FROM stdin;
\.


--
-- Data for Name: RateLimit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RateLimit" (id, ip, endpoint, hits, "expiresAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: Refill; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Refill" (id, "numericId", "orderId", status, "externalId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: RoutingAuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RoutingAuditLog" (id, "serviceId", "adminId", action, "fromProviderId", "toProviderId", reason, "createdAt") FROM stdin;
\.


--
-- Data for Name: SecurityEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SecurityEvent" (id, "tenantId", event, severity, ip, details, "createdAt") FROM stdin;
cmufyc3bl0000ddcey90v2flb	smmplan	SPOOFED_IP_WEBHOOK	CRITICAL	172.18.0.1	{"gateway": "yookassa"}	2026-09-24 19:55:43.953
cmufyc3ca0001ddcefeetbx3g	smmplan	SPOOFED_IP_WEBHOOK	CRITICAL	172.18.0.1	{"gateway": "robokassa"}	2026-09-24 19:55:43.978
cmufyeji60002ddcekmsuaway	smmplan	SPOOFED_IP_WEBHOOK	CRITICAL	172.18.0.1	{"gateway": "yookassa"}	2026-09-24 19:57:38.239
cmufyejil0003ddce8tcvrm63	smmplan	SPOOFED_IP_WEBHOOK	CRITICAL	172.18.0.1	{"gateway": "robokassa"}	2026-09-24 19:57:38.254
cmufyi51m000ggs4cc7nkxqct	smmplan	PAYMENT_AMOUNT_MISMATCH_EXPLOIT	CRITICAL	\N	{"gatewayId": "smoke_test_yk_2ea3d6b0-a2c7-4c15-85df-7fa11899e017", "paymentId": "cmufyi3g50006gs4cohx4pi8y", "gatewayType": "yookassa", "expectedAmount": "15000", "receivedAmount": "5000"}	2026-09-24 20:00:24.071
cmug4ti5v000013cc2trgg5rz	smmplan	STAFF_PERMISSION_VIOLATION	HIGH	\N	{"role": "SUPPORT", "reason": "No permission entry for section", "actionMode": "edit", "staffEmail": "support@smmplan.pro", "staffUserId": "staff_support_001", "targetSection": "settings"}	2026-09-24 22:57:14.036
cmug4tki4000113cccybeskv7	smmplan	STAFF_PERMISSION_VIOLATION	HIGH	\N	{"role": "SUPPORT", "reason": "No permission entry for section", "actionMode": "edit", "staffEmail": "support@smmplan.pro", "staffUserId": "staff_support_001", "targetSection": "analytics"}	2026-09-24 22:57:17.068
cmug4tl8d000213cc8y288cg4	smmplan	STAFF_PERMISSION_VIOLATION	HIGH	\N	{"role": "SUPPORT", "reason": "No permission entry for section", "actionMode": "view", "staffEmail": "support@smmplan.pro", "staffUserId": "staff_support_001", "targetSection": "providers"}	2026-09-24 22:57:18.013
cmug4upis000013nd3cr516j3	smmplan	SIGNATURE_FAILED	CRITICAL	0.0.0.0	{"gateway": "robokassa", "paymentId": "pay_123"}	2026-09-24 22:58:10.228
cmugkmlf5000067eje3o1tcs5	smmplan	SIGNATURE_FAILED	CRITICAL	0.0.0.0	{"gateway": "robokassa", "paymentId": "pay_123"}	2026-09-25 06:19:45.522
\.


--
-- Data for Name: Service; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Service" (id, "numericId", name, description, icon, features, "categoryId", "tenantId", "providerId", rate, "providerCurrency", "costPer1kRub", "currencyCapturedAt", "usdRateAtCapture", markup, "anomalyScore", "minQty", "maxQty", "externalId", "dataHash", "lastSeenAt", "isDripFeedEnabled", "isRefillEnabled", "isCancelEnabled", "isCustomName", "isCustomDescription", "qualityTier", "isQuarantined", "pendingRate", "quarantineReason", "quarantinedAt", "cooldownUntil", "cooldownReason", "etaP50Seconds", "etaP90Seconds", "etaSampleCount", "etaSpeedClass", "etaUpdatedAt", "targetType", "customDataType", "customDataLabel", "isMediaGroupAware", "linkValidatorRegex", "linkPlaceholder", "linkHint", "requiresBotAdmin", "requireWarning", "warningMessage", "clientRequirement", "clientConfirmation", "isActive", "pricePer1000Cents", "createdAt", "updatedAt", slug, "sortOrder") FROM stdin;
\.


--
-- Data for Name: ServiceCustomerAccess; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServiceCustomerAccess" (id, "serviceId", "customerGroupId", "isCustomPrice", "customPriceRub", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ServiceDraft; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServiceDraft" (id, "serviceId", "providerId", "externalId", "tenantId", name, "cleanName", description, "categoryId", "targetType", status, "procurementRate", "procurementCurrency", markup, "retailPriceRub", "minQty", "maxQty", "validationStatus", "linkCheckStatus", payload, "adminId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ServiceEditHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServiceEditHistory" (id, "serviceId", "draftId", "adminId", "adminEmail", "changeType", field, "oldValue", "newValue", comment, "ipAddress", "createdAt") FROM stdin;
\.


--
-- Data for Name: ServiceLinkCheck; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServiceLinkCheck" (id, "serviceId", "targetType", "testUrl", "isSuccess", "statusCode", "responseTimeMs", "errorMessage", "checkedBy", "checkedAt") FROM stdin;
\.


--
-- Data for Name: ServicePriceHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServicePriceHistory" (id, "serviceId", rate, "createdAt") FROM stdin;
\.


--
-- Data for Name: ServiceRoute; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServiceRoute" (id, "serviceId", "providerId", "providerServiceId", "isPrimary", "isActive", priority, "failoverMode", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ServiceSmartConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServiceSmartConfig" (id, "serviceId", "isEnabled", "isTestMode", "minChunk", "maxChunk", markup, "providersPriority", "useInviteBuffer", "autoCompensate", "checkIntervalMins", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Session" (id, "userId", "expiresAt", "userAgent", "ipAddress", "impersonatedBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: ShadowService; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ShadowService" (id, "providerId", "externalId", name, type, category, rate, "rateRub", min, max, refill, cancel, dripfeed, "cleanName", platform, "normalizedCategory", "targetType", "customDataType", "isMediaGroupAware", "isPrivate", warranty, geo, velocity, "anomalyScore", "tenantId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SlaTelemetrySnapshot; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SlaTelemetrySnapshot" (id, "providerId", "serviceId", "p50Seconds", "p90Seconds", "p99Seconds", "sampleCount", "isDegraded", "createdAt") FROM stdin;
\.


--
-- Data for Name: SmartCampaign; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SmartCampaign" (id, "userId", "serviceId", status, link, "totalQuantity", "totalDays", "isTestMode", "createdAt", "updatedAt", "paymentId", "orderId") FROM stdin;
\.


--
-- Data for Name: SmartChannelMetric; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SmartChannelMetric" (id, "campaignId", "recordedAt", "memberCount", delta, "detectedDrops", "compensatedQty") FROM stdin;
\.


--
-- Data for Name: SmartDetectedUser; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SmartDetectedUser" (id, "campaignId", "telegramId", score, reasons, "createdAt") FROM stdin;
\.


--
-- Data for Name: SmartExecution; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SmartExecution" (id, "taskId", "providerId", "externalOrderId", "qtySent", "qtyDelivered", status, error, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SmartSnapshot; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SmartSnapshot" (id, "campaignId", "channelUrl", members, "createdAt") FROM stdin;
\.


--
-- Data for Name: SmartTask; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SmartTask" (id, "campaignId", quantity, "runAt", status, error, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: StaffPermission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StaffPermission" (id, "tenantId", "roleId", section, "canView", "canEdit") FROM stdin;
cmufu8mwr0005bm31d0tj80x5	smmplan	cmufu8mtp0000bm31bttvntle	dashboard	t	t
cmufu8mx30007bm31ou6bgqqn	smmplan	cmufu8mtp0000bm31bttvntle	clients	t	t
cmufu8mx70009bm311qwykw9n	smmplan	cmufu8mtp0000bm31bttvntle	orders	t	t
cmufu8mxd000bbm319ft0wfks	smmplan	cmufu8mtp0000bm31bttvntle	refills	t	t
cmufu8mxj000dbm31rw5vc3e6	smmplan	cmufu8mtp0000bm31bttvntle	tickets	t	t
cmufu8mxt000fbm312jsb2vy5	smmplan	cmufu8mtp0000bm31bttvntle	catalog	t	t
cmufu8my0000hbm31717jurmh	smmplan	cmufu8mtp0000bm31bttvntle	providers	t	t
cmufu8my5000jbm31pd60nkhg	smmplan	cmufu8mtp0000bm31bttvntle	marketing	t	t
cmufu8myc000lbm31nya8kynh	smmplan	cmufu8mtp0000bm31bttvntle	content	t	t
cmufu8myh000nbm31z35vm3n6	smmplan	cmufu8mtp0000bm31bttvntle	finance	t	t
cmufu8myr000pbm31q1xzw4bf	smmplan	cmufu8mtp0000bm31bttvntle	balance_requests	t	t
cmufu8myx000rbm31zo06bnlq	smmplan	cmufu8mtp0000bm31bttvntle	balance_approvals	t	t
cmufu8mz1000tbm315z7dusnb	smmplan	cmufu8mtp0000bm31bttvntle	balance_stats	t	t
cmufu8mz6000vbm31g8c8cvjf	smmplan	cmufu8mtp0000bm31bttvntle	balance_policy	t	t
cmufu8mza000xbm31y8675gmq	smmplan	cmufu8mtp0000bm31bttvntle	analytics	t	t
cmufu8mzf000zbm31h7fc1c4c	smmplan	cmufu8mtp0000bm31bttvntle	settings	t	t
cmufu8mzm0011bm314eqs4vbt	smmplan	cmufu8mvg0001bm314gdbbf06	dashboard	t	f
cmufu8mzs0013bm31mh7k687r	smmplan	cmufu8mvg0001bm314gdbbf06	clients	t	t
cmufu8mzw0015bm31fpwv2tq0	smmplan	cmufu8mvg0001bm314gdbbf06	orders	t	t
cmufu8n010017bm31om8oi12i	smmplan	cmufu8mvg0001bm314gdbbf06	refills	t	t
cmufu8n040019bm318al3frpj	smmplan	cmufu8mvg0001bm314gdbbf06	catalog	t	t
cmufu8n08001bbm31pes6rpmk	smmplan	cmufu8mvg0001bm314gdbbf06	providers	t	t
cmufu8n0i001dbm31sg8di37q	smmplan	cmufu8mvg0001bm314gdbbf06	tickets	t	t
cmufu8n0n001fbm31fc4a3cvm	smmplan	cmufu8mvg0001bm314gdbbf06	marketing	t	t
cmufu8n0s001hbm315pxsv2ph	smmplan	cmufu8mvg0001bm314gdbbf06	content	t	t
cmufu8n0x001jbm3124y6tagy	smmplan	cmufu8mvg0001bm314gdbbf06	analytics	t	f
cmufu8n11001lbm318q8yl22n	smmplan	cmufu8mvt0002bm31ratrfa72	dashboard	t	f
cmufu8n14001nbm31shb3kse7	smmplan	cmufu8mvt0002bm31ratrfa72	clients	t	f
cmufu8n18001pbm314glq3qi3	smmplan	cmufu8mvt0002bm31ratrfa72	orders	t	f
cmufu8n1f001rbm3194efna8q	smmplan	cmufu8mvt0002bm31ratrfa72	refills	t	t
cmufu8n1k001tbm311xbmqy0d	smmplan	cmufu8mvt0002bm31ratrfa72	tickets	t	t
cmufu8n1t001vbm311f8u1nhc	smmplan	cmufu8mwd0003bm31iyqk37e9	dashboard	t	f
cmufu8n1x001xbm31ioecvwsq	smmplan	cmufu8mwd0003bm31iyqk37e9	balance_requests	t	t
cmufu8n21001zbm31d8mjxzsl	smmplan	cmufu8mwd0003bm31iyqk37e9	balance_approvals	t	t
cmufu8n2a0021bm31361r94cz	smmplan	cmufu8mwd0003bm31iyqk37e9	balance_stats	t	f
\.


--
-- Data for Name: StaffRole; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StaffRole" (id, "tenantId", "allowedTenants", name, description, "isSystem", "createdAt", "updatedAt") FROM stdin;
cmufu8mtp0000bm31bttvntle	smmplan	{smmplan}	Admin	Полный доступ ко всем модулям	t	2026-09-24 18:01:04.141	2026-09-24 18:01:04.141
cmufu8mvg0001bm314gdbbf06	smmplan	{smmplan}	Manager	Менеджер платформы (без финансов)	t	2026-09-24 18:01:04.204	2026-09-24 18:01:04.204
cmufu8mvt0002bm31ratrfa72	smmplan	{smmplan}	Support	Старший модератор/Саппорт	t	2026-09-24 18:01:04.218	2026-09-24 18:01:04.218
cmufu8mwd0003bm31iyqk37e9	smmplan	{smmplan}	Cashier	Кассир (согласование балансовых заявок)	t	2026-09-24 18:01:04.237	2026-09-24 18:01:04.237
\.


--
-- Data for Name: StaffShift; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StaffShift" (id, "userId", date, "shiftType", status, "substituteUserId", "substituteHours", "rateRubles", "bonusRubles", "penaltyRubles", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: StorefrontKey; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StorefrontKey" (id, "tenantId", type, "keyPrefix", "keyHash", name, "isActive", "lastUsedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SupportFinancialAction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SupportFinancialAction" (id, "tenantId", "staffUserId", "targetUserId", direction, source, "amountCents", "reasonCode", "reasonNote", "ticketId", "orderId", "paymentId", "policyId", "policySnapshot", "idempotencyKey", status, "ledgerEntryId", "consentId", "reviewStatus", "reviewedBy", "reviewedAt", "reviewNote", "ipAddress", "userAgent", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SupportHourlyUsage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SupportHourlyUsage" (id, "tenantId", "staffUserId", "hourKey", direction, "amountCents", "operationsCount", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SupportLimitUsage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SupportLimitUsage" (id, "tenantId", "staffUserId", "dayKey", direction, "amountCents", "operationsCount", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SupportTemplate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SupportTemplate" (id, shortcut, label, text, category, "isActive", "useCount", sort, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SystemSetting; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SystemSetting" (key, value, "group", description, "updatedAt", "updatedBy") FROM stdin;
\.


--
-- Data for Name: SystemSettings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SystemSettings" (id, "isTestMode", "environmentMode", "taxRate", "usnScheme", "opexMonthly", "maintenanceMode", "siteName", "siteDescription", "telegramBotToken", "telegramBotMode", "welcomeMessage", "telegramMenuConfig", "telegramTemplates", "telegramRatingReasons", "telegramWebhookSecret", "telegramAllowedIps", "telegramRateLimitPerMin", "telegramMaxMessageLength", "telegramProxyId", "telegramMaintenanceMode", "telegramLogErrors", "telegramEnableCsat", "telegramEnableSmartBind", "yookassaShopId", "yookassaSecretKey", "yookassaWebhookSecret", "yookassaTestShopId", "yookassaTestSecretKey", "cryptoBotToken", "quarantineThreshold", "globalMarkup", "safetyFloor", "exchangeRateUSD", "exchangeRateUpdatedAt", "siteLogoUrl", "siteFaviconUrl", "emailProvider", "resendApiKey", "smtpHost", "smtpPort", "smtpUser", "smtpPassword", "supportEmailDomain", "inboundEmailWebhookSecret", "robokassaLogin", "robokassaPassword", "robokassaWebhookPassword", "geminiApiKeys", "geminiProxy", "alfaBankAccountNumber", "alfaBankApiKey", "alfaBankClientSecret", "alfaBankApiBaseUrl", "alfaBankIsSandbox", "updatedAt", "contactSupportEmail", "contactPrivacyEmail", "contactTelegramBot", "contactTelegramChannel", "contactWhatsApp", "contactVk", "legalCompanyName", "legalCompanyInn", "legalCompanyOgrnip", "legalCompanyAddress") FROM stdin;
smmplan	f	PRODUCTION	6	INCOME_EXPENSES	0	f	SMMplan		\N	polling	Добро пожаловать в Smmplan! Ваш персональный кабинет готов к работе.	\N	\N	\N	\N	[]	30	4096	\N	f	t	t	t	\N	\N	\N	\N	\N	\N	0.2	3	1	95	2026-09-25 06:00:00.585	\N	\N	SMTP	\N	\N	465	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://business.alfabank.ru/ext-api/v1	t	2026-09-25 06:59:02.415	support@smmplan.pro	privacy@smmplan.pro	smmplan_support_bot	smmplan_support	\N	\N	ИП Соколов Артём Андреевич	695006320024	\N	Российская Федерация, Тверская область, г. Тверь
lovable	f	PRODUCTION	6	INCOME_EXPENSES	0	f	SMMflux		\N	polling	Добро пожаловать в Smmplan! Ваш персональный кабинет готов к работе.	\N	\N	\N	\N	[]	30	4096	\N	f	t	t	t	\N	\N	\N	\N	\N	\N	0.2	3	1	95	\N	\N	\N	SMTP	\N	\N	465	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://business.alfabank.ru/ext-api/v1	t	2026-09-25 06:59:02.421	support@lovable.pro	privacy@lovable.pro	lovable_support_bot	lovable_support	\N	\N	Lovable Inc	\N	\N	\N
global	f	PRODUCTION	6	INCOME_EXPENSES	0	f	SMMplan		\N	polling	Добро пожаловать в Smmplan! Ваш персональный кабинет готов к работе.	\N	\N	\N	\N	[]	30	4096	\N	f	t	t	t	\N	\N	\N	\N	\N	\N	0.2	3	1	95	\N	\N	\N	SMTP	\N	\N	465	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	https://business.alfabank.ru/ext-api/v1	t	2026-09-25 06:59:02.428	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: TelegramBotInstance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TelegramBotInstance" (id, "tenantId", name, username, "tokenEncrypted", role, description, "isActive", "maintenanceMode", "welcomeMessage", "menuConfig", templates, "flowConfig", "allowedUserIds", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TelegramButton; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TelegramButton" (id, "tenantId", label, emoji, command, description, "row", col, "sortOrder", "isVisible", "isNew", "requiresAuth", "openUrl", style, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TelegramDailyStat; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TelegramDailyStat" (id, "tenantId", date, "messagesReceived", "messagesSent", "commandsHandled", "callbacksHandled", "newUsers", "ordersCreated", "ticketsCreated", "errorsCount", "avgLatencyMs", "p99LatencyMs", "createdAt") FROM stdin;
\.


--
-- Data for Name: TelegramErrorLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TelegramErrorLog" (id, "tenantId", level, source, "errorCode", "errorMessage", "stackTrace", "updateData", "userId", "chatId", "isResolved", "resolvedBy", "resolvedAt", "occurrenceCount", "firstSeenAt", "lastSeenAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: TelegramProxy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TelegramProxy" (id, "tenantId", label, protocol, host, port, username, "passwordEncrypted", "isActive", "lastTestAt", "lastTestLatencyMs", "lastTestSuccess", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TelegramTemplate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TelegramTemplate" (id, "tenantId", name, slug, description, body, "parseMode", category, variables, "isActive", version, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Tenant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Tenant" (id, name, slug, domain, "customDomain", "isActive", "vaultSalt", "createdAt", "updatedAt") FROM stdin;
smmplan	smmplan	smmplan	smmplan.local	\N	t	5730f46a8e9f7fbfc76b4a47ca217650e22b90d017a0dee5192492583e084eb7	2026-09-24 18:01:00.141	2026-09-25 06:59:02.411
lovable	lovable	lovable	lovable.local	\N	t	44e318768afb014079cc9f18b64ba2b21d1b7c95b13fc28a37f2f1a7d39e59f4	2026-09-24 18:01:00.236	2026-09-25 06:59:02.418
global	global	global	global.local	\N	t	test-salt	2026-09-24 22:57:13.981	2026-09-25 06:59:02.424
\.


--
-- Data for Name: Ticket; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Ticket" (id, "userId", subject, status, source, "orderId", "paymentId", "firstRespondedAt", "resolvedAt", tags, "updatedAt", "createdAt", "tenantId") FROM stdin;
\.


--
-- Data for Name: TicketFeedback; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TicketFeedback" (id, "ticketId", "userId", score, reasons, comment, source, "tenantId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TicketMessage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TicketMessage" (id, "ticketId", sender, text, "mediaUrl", "mediaType", "replyToId", "telegramMsgId", "isDeleted", "isEdited", "originalText", "orderId", "createdAt") FROM stdin;
\.


--
-- Data for Name: UrlPattern; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UrlPattern" (id, "networkId", pattern, "contentType", sort, "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, "passwordHash", role, "preferredDashboard", balance, "quarantineBalance", "totalSpent", "personalDiscount", "discountEndsAt", "supportLimitCents", "supportSpentTodayCents", "supportLastResetAt", "apiKeyHash", "referralCode", "referredById", "referralBalance", "telegramId", "phoneHash", "isKycVerified", "isEmailVerified", "isBotOnly", "isActive", "isDeleted", "tosAcceptedAt", "tosAcceptedIp", "adminNote", "adminNoteUpdatedAt", "adminNoteUpdatedBy", "geminiApiKey", "twoFactorEnabled", "twoFactorSecret", "twoFactorBackupCodes", "createdAt", "updatedAt", "companyName", inn, kpp, ogrn, "legalAddress", "telegramNotifyOrders", "telegramNotifyBalance", "telegramNotifyTickets", "staffRoleId", "bonusBalance", "customerGroupId", "tenantId", "allowedTenants") FROM stdin;
\.


--
-- Data for Name: UserNote; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserNote" (id, "userId", "authorId", content, "orderId", "ticketId", "createdAt") FROM stdin;
\.


--
-- Data for Name: api_request_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.api_request_log (id, api_key_hash, action, params, http_status, latency_ms, ip, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: ledger_period; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ledger_period (id, month, start_date, end_date, frozen, frozen_at, frozen_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: provider_service_backup; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_service_backup (id, service_id, primary_provider_id, backup_provider_id, backup_external_id, priority, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: reconciliation_report; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reconciliation_report (id, date, bank_total, db_total, ledger_total, delta_bank_vs_db, delta_db_vs_ledger, status, details, created_at) FROM stdin;
\.


--
-- Data for Name: revenue_recognition; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.revenue_recognition (id, order_id, amount, recognized_at, reversed, reversed_at, reversal_reason, created_at, updated_at) FROM stdin;
\.


--
-- Name: Order_numericId_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Order_numericId_seq"', 16, true);


--
-- Name: Refill_numericId_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Refill_numericId_seq"', 1, false);


--
-- Name: Service_numericId_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Service_numericId_seq"', 28, true);


--
-- Name: AdminAuditLog AdminAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdminAuditLog"
    ADD CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AiPricingRecommendation AiPricingRecommendation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiPricingRecommendation"
    ADD CONSTRAINT "AiPricingRecommendation_pkey" PRIMARY KEY (id);


--
-- Name: AnalyticsEvent AnalyticsEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnalyticsEvent"
    ADD CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY (id);


--
-- Name: ApiConfig ApiConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApiConfig"
    ADD CONSTRAINT "ApiConfig_pkey" PRIMARY KEY (id);


--
-- Name: Article Article_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Article"
    ADD CONSTRAINT "Article_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AuthToken AuthToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuthToken"
    ADD CONSTRAINT "AuthToken_pkey" PRIMARY KEY (id);


--
-- Name: BalanceAdjustmentPolicy BalanceAdjustmentPolicy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BalanceAdjustmentPolicy"
    ADD CONSTRAINT "BalanceAdjustmentPolicy_pkey" PRIMARY KEY (id);


--
-- Name: BonusRedemptionLog BonusRedemptionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BonusRedemptionLog"
    ADD CONSTRAINT "BonusRedemptionLog_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: Commission Commission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Commission"
    ADD CONSTRAINT "Commission_pkey" PRIMARY KEY (id);


--
-- Name: ContentCategory ContentCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentCategory"
    ADD CONSTRAINT "ContentCategory_pkey" PRIMARY KEY (id);


--
-- Name: ContentItem ContentItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentItem"
    ADD CONSTRAINT "ContentItem_pkey" PRIMARY KEY (id);


--
-- Name: CustomerGroup CustomerGroup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerGroup"
    ADD CONSTRAINT "CustomerGroup_pkey" PRIMARY KEY (id);


--
-- Name: CxApologyCompensation CxApologyCompensation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CxApologyCompensation"
    ADD CONSTRAINT "CxApologyCompensation_pkey" PRIMARY KEY (id);


--
-- Name: EconomicOptimizationSnapshot EconomicOptimizationSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EconomicOptimizationSnapshot"
    ADD CONSTRAINT "EconomicOptimizationSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeResponsibilityConsent EmployeeResponsibilityConsent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmployeeResponsibilityConsent"
    ADD CONSTRAINT "EmployeeResponsibilityConsent_pkey" PRIMARY KEY (id);


--
-- Name: FeatureFlag FeatureFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeatureFlag"
    ADD CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: LedgerEntry LedgerEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY (id);


--
-- Name: LegalDocumentVersion LegalDocumentVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LegalDocumentVersion"
    ADD CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY (id);


--
-- Name: LoginLog LoginLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LoginLog"
    ADD CONSTRAINT "LoginLog_pkey" PRIMARY KEY (id);


--
-- Name: ManualBalanceAdjustment ManualBalanceAdjustment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ManualBalanceAdjustment"
    ADD CONSTRAINT "ManualBalanceAdjustment_pkey" PRIMARY KEY (id);


--
-- Name: MessageAttachment MessageAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageAttachment"
    ADD CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY (id);


--
-- Name: Network Network_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Network"
    ADD CONSTRAINT "Network_pkey" PRIMARY KEY (id);


--
-- Name: OrderRecoveryIncident OrderRecoveryIncident_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderRecoveryIncident"
    ADD CONSTRAINT "OrderRecoveryIncident_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Page Page_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Page"
    ADD CONSTRAINT "Page_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PiiAccessLog PiiAccessLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PiiAccessLog"
    ADD CONSTRAINT "PiiAccessLog_pkey" PRIMARY KEY (id);


--
-- Name: PreLaunchLead PreLaunchLead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PreLaunchLead"
    ADD CONSTRAINT "PreLaunchLead_pkey" PRIMARY KEY (id);


--
-- Name: ProcessedBonusEvent ProcessedBonusEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProcessedBonusEvent"
    ADD CONSTRAINT "ProcessedBonusEvent_pkey" PRIMARY KEY (id);


--
-- Name: PromoCodeUsage PromoCodeUsage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromoCodeUsage"
    ADD CONSTRAINT "PromoCodeUsage_pkey" PRIMARY KEY (id);


--
-- Name: PromoCode PromoCode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromoCode"
    ADD CONSTRAINT "PromoCode_pkey" PRIMARY KEY (id);


--
-- Name: ProviderOutbox ProviderOutbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderOutbox"
    ADD CONSTRAINT "ProviderOutbox_pkey" PRIMARY KEY (id);


--
-- Name: ProviderProxyLog ProviderProxyLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderProxyLog"
    ADD CONSTRAINT "ProviderProxyLog_pkey" PRIMARY KEY (id);


--
-- Name: ProviderProxy ProviderProxy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderProxy"
    ADD CONSTRAINT "ProviderProxy_pkey" PRIMARY KEY (id);


--
-- Name: Provider Provider_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Provider"
    ADD CONSTRAINT "Provider_pkey" PRIMARY KEY (id);


--
-- Name: RateLimit RateLimit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RateLimit"
    ADD CONSTRAINT "RateLimit_pkey" PRIMARY KEY (id);


--
-- Name: Refill Refill_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refill"
    ADD CONSTRAINT "Refill_pkey" PRIMARY KEY (id);


--
-- Name: RoutingAuditLog RoutingAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoutingAuditLog"
    ADD CONSTRAINT "RoutingAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: SecurityEvent SecurityEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SecurityEvent"
    ADD CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY (id);


--
-- Name: ServiceCustomerAccess ServiceCustomerAccess_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceCustomerAccess"
    ADD CONSTRAINT "ServiceCustomerAccess_pkey" PRIMARY KEY (id);


--
-- Name: ServiceDraft ServiceDraft_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceDraft"
    ADD CONSTRAINT "ServiceDraft_pkey" PRIMARY KEY (id);


--
-- Name: ServiceEditHistory ServiceEditHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceEditHistory"
    ADD CONSTRAINT "ServiceEditHistory_pkey" PRIMARY KEY (id);


--
-- Name: ServiceLinkCheck ServiceLinkCheck_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceLinkCheck"
    ADD CONSTRAINT "ServiceLinkCheck_pkey" PRIMARY KEY (id);


--
-- Name: ServicePriceHistory ServicePriceHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServicePriceHistory"
    ADD CONSTRAINT "ServicePriceHistory_pkey" PRIMARY KEY (id);


--
-- Name: ServiceRoute ServiceRoute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceRoute"
    ADD CONSTRAINT "ServiceRoute_pkey" PRIMARY KEY (id);


--
-- Name: ServiceSmartConfig ServiceSmartConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceSmartConfig"
    ADD CONSTRAINT "ServiceSmartConfig_pkey" PRIMARY KEY (id);


--
-- Name: Service Service_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: ShadowService ShadowService_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShadowService"
    ADD CONSTRAINT "ShadowService_pkey" PRIMARY KEY (id);


--
-- Name: SlaTelemetrySnapshot SlaTelemetrySnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SlaTelemetrySnapshot"
    ADD CONSTRAINT "SlaTelemetrySnapshot_pkey" PRIMARY KEY (id);


--
-- Name: SmartCampaign SmartCampaign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartCampaign"
    ADD CONSTRAINT "SmartCampaign_pkey" PRIMARY KEY (id);


--
-- Name: SmartChannelMetric SmartChannelMetric_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartChannelMetric"
    ADD CONSTRAINT "SmartChannelMetric_pkey" PRIMARY KEY (id);


--
-- Name: SmartDetectedUser SmartDetectedUser_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartDetectedUser"
    ADD CONSTRAINT "SmartDetectedUser_pkey" PRIMARY KEY (id);


--
-- Name: SmartExecution SmartExecution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartExecution"
    ADD CONSTRAINT "SmartExecution_pkey" PRIMARY KEY (id);


--
-- Name: SmartSnapshot SmartSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartSnapshot"
    ADD CONSTRAINT "SmartSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: SmartTask SmartTask_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartTask"
    ADD CONSTRAINT "SmartTask_pkey" PRIMARY KEY (id);


--
-- Name: StaffPermission StaffPermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StaffPermission"
    ADD CONSTRAINT "StaffPermission_pkey" PRIMARY KEY (id);


--
-- Name: StaffRole StaffRole_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StaffRole"
    ADD CONSTRAINT "StaffRole_pkey" PRIMARY KEY (id);


--
-- Name: StaffShift StaffShift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StaffShift"
    ADD CONSTRAINT "StaffShift_pkey" PRIMARY KEY (id);


--
-- Name: StorefrontKey StorefrontKey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StorefrontKey"
    ADD CONSTRAINT "StorefrontKey_pkey" PRIMARY KEY (id);


--
-- Name: SupportFinancialAction SupportFinancialAction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportFinancialAction"
    ADD CONSTRAINT "SupportFinancialAction_pkey" PRIMARY KEY (id);


--
-- Name: SupportHourlyUsage SupportHourlyUsage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportHourlyUsage"
    ADD CONSTRAINT "SupportHourlyUsage_pkey" PRIMARY KEY (id);


--
-- Name: SupportLimitUsage SupportLimitUsage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportLimitUsage"
    ADD CONSTRAINT "SupportLimitUsage_pkey" PRIMARY KEY (id);


--
-- Name: SupportTemplate SupportTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTemplate"
    ADD CONSTRAINT "SupportTemplate_pkey" PRIMARY KEY (id);


--
-- Name: SystemSetting SystemSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemSetting"
    ADD CONSTRAINT "SystemSetting_pkey" PRIMARY KEY (key);


--
-- Name: SystemSettings SystemSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemSettings"
    ADD CONSTRAINT "SystemSettings_pkey" PRIMARY KEY (id);


--
-- Name: TelegramBotInstance TelegramBotInstance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TelegramBotInstance"
    ADD CONSTRAINT "TelegramBotInstance_pkey" PRIMARY KEY (id);


--
-- Name: TelegramButton TelegramButton_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TelegramButton"
    ADD CONSTRAINT "TelegramButton_pkey" PRIMARY KEY (id);


--
-- Name: TelegramDailyStat TelegramDailyStat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TelegramDailyStat"
    ADD CONSTRAINT "TelegramDailyStat_pkey" PRIMARY KEY (id);


--
-- Name: TelegramErrorLog TelegramErrorLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TelegramErrorLog"
    ADD CONSTRAINT "TelegramErrorLog_pkey" PRIMARY KEY (id);


--
-- Name: TelegramProxy TelegramProxy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TelegramProxy"
    ADD CONSTRAINT "TelegramProxy_pkey" PRIMARY KEY (id);


--
-- Name: TelegramTemplate TelegramTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TelegramTemplate"
    ADD CONSTRAINT "TelegramTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: TicketFeedback TicketFeedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketFeedback"
    ADD CONSTRAINT "TicketFeedback_pkey" PRIMARY KEY (id);


--
-- Name: TicketMessage TicketMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketMessage"
    ADD CONSTRAINT "TicketMessage_pkey" PRIMARY KEY (id);


--
-- Name: Ticket Ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_pkey" PRIMARY KEY (id);


--
-- Name: UrlPattern UrlPattern_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UrlPattern"
    ADD CONSTRAINT "UrlPattern_pkey" PRIMARY KEY (id);


--
-- Name: UserNote UserNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNote"
    ADD CONSTRAINT "UserNote_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: api_request_log api_request_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_request_log
    ADD CONSTRAINT api_request_log_pkey PRIMARY KEY (id);


--
-- Name: ledger_period ledger_period_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_period
    ADD CONSTRAINT ledger_period_pkey PRIMARY KEY (id);


--
-- Name: provider_service_backup provider_service_backup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_service_backup
    ADD CONSTRAINT provider_service_backup_pkey PRIMARY KEY (id);


--
-- Name: reconciliation_report reconciliation_report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_report
    ADD CONSTRAINT reconciliation_report_pkey PRIMARY KEY (id);


--
-- Name: revenue_recognition revenue_recognition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_recognition
    ADD CONSTRAINT revenue_recognition_pkey PRIMARY KEY (id);


--
-- Name: AdminAuditLog_adminId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdminAuditLog_adminId_idx" ON public."AdminAuditLog" USING btree ("adminId");


--
-- Name: AdminAuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdminAuditLog_createdAt_idx" ON public."AdminAuditLog" USING btree ("createdAt");


--
-- Name: AdminAuditLog_targetType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdminAuditLog_targetType_idx" ON public."AdminAuditLog" USING btree ("targetType");


--
-- Name: AdminAuditLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdminAuditLog_tenantId_idx" ON public."AdminAuditLog" USING btree ("tenantId");


--
-- Name: AiPricingRecommendation_confidenceScore_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiPricingRecommendation_confidenceScore_idx" ON public."AiPricingRecommendation" USING btree ("confidenceScore");


--
-- Name: AiPricingRecommendation_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiPricingRecommendation_serviceId_idx" ON public."AiPricingRecommendation" USING btree ("serviceId");


--
-- Name: AiPricingRecommendation_snapshotId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiPricingRecommendation_snapshotId_idx" ON public."AiPricingRecommendation" USING btree ("snapshotId");


--
-- Name: AiPricingRecommendation_snapshotId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiPricingRecommendation_snapshotId_status_idx" ON public."AiPricingRecommendation" USING btree ("snapshotId", status);


--
-- Name: AiPricingRecommendation_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiPricingRecommendation_status_idx" ON public."AiPricingRecommendation" USING btree (status);


--
-- Name: AnalyticsEvent_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalyticsEvent_createdAt_idx" ON public."AnalyticsEvent" USING btree ("createdAt");


--
-- Name: AnalyticsEvent_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalyticsEvent_event_idx" ON public."AnalyticsEvent" USING btree (event);


--
-- Name: ApiConfig_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ApiConfig_userId_key" ON public."ApiConfig" USING btree ("userId");


--
-- Name: Article_category_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Article_category_status_idx" ON public."Article" USING btree (category, status);


--
-- Name: Article_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Article_slug_key" ON public."Article" USING btree (slug);


--
-- Name: Article_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Article_status_idx" ON public."Article" USING btree (status);


--
-- Name: AuditLog_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_userId_idx" ON public."AuditLog" USING btree ("userId");


--
-- Name: AuthToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuthToken_expiresAt_idx" ON public."AuthToken" USING btree ("expiresAt");


--
-- Name: AuthToken_token_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AuthToken_token_tenantId_key" ON public."AuthToken" USING btree (token, "tenantId");


--
-- Name: AuthToken_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuthToken_userId_createdAt_idx" ON public."AuthToken" USING btree ("userId", "createdAt");


--
-- Name: BalanceAdjustmentPolicy_scopeType_staffRoleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BalanceAdjustmentPolicy_scopeType_staffRoleId_idx" ON public."BalanceAdjustmentPolicy" USING btree ("scopeType", "staffRoleId");


--
-- Name: BalanceAdjustmentPolicy_scopeType_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BalanceAdjustmentPolicy_scopeType_userId_idx" ON public."BalanceAdjustmentPolicy" USING btree ("scopeType", "userId");


--
-- Name: BonusRedemptionLog_paymentFingerprint_bonusType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BonusRedemptionLog_paymentFingerprint_bonusType_idx" ON public."BonusRedemptionLog" USING btree ("paymentFingerprint", "bonusType");


--
-- Name: BonusRedemptionLog_status_unlockAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BonusRedemptionLog_status_unlockAt_idx" ON public."BonusRedemptionLog" USING btree (status, "unlockAt");


--
-- Name: BonusRedemptionLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BonusRedemptionLog_tenantId_idx" ON public."BonusRedemptionLog" USING btree ("tenantId");


--
-- Name: BonusRedemptionLog_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BonusRedemptionLog_userId_idx" ON public."BonusRedemptionLog" USING btree ("userId");


--
-- Name: Category_activityType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Category_activityType_idx" ON public."Category" USING btree ("activityType");


--
-- Name: Category_networkId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Category_networkId_idx" ON public."Category" USING btree ("networkId");


--
-- Name: Category_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Category_slug_key" ON public."Category" USING btree (slug);


--
-- Name: Category_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Category_tenantId_idx" ON public."Category" USING btree ("tenantId");


--
-- Name: Commission_orderId_referrerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Commission_orderId_referrerId_key" ON public."Commission" USING btree ("orderId", "referrerId");


--
-- Name: Commission_referrerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Commission_referrerId_idx" ON public."Commission" USING btree ("referrerId");


--
-- Name: ContentCategory_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentCategory_parentId_idx" ON public."ContentCategory" USING btree ("parentId");


--
-- Name: ContentCategory_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ContentCategory_slug_key" ON public."ContentCategory" USING btree (slug);


--
-- Name: ContentItem_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentItem_categoryId_idx" ON public."ContentItem" USING btree ("categoryId");


--
-- Name: ContentItem_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentItem_slug_idx" ON public."ContentItem" USING btree (slug);


--
-- Name: ContentItem_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ContentItem_slug_key" ON public."ContentItem" USING btree (slug);


--
-- Name: ContentItem_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentItem_type_idx" ON public."ContentItem" USING btree (type);


--
-- Name: CustomerGroup_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerGroup_tenantId_idx" ON public."CustomerGroup" USING btree ("tenantId");


--
-- Name: CustomerGroup_tenantId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomerGroup_tenantId_slug_key" ON public."CustomerGroup" USING btree ("tenantId", slug);


--
-- Name: CxApologyCompensation_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CxApologyCompensation_orderId_idx" ON public."CxApologyCompensation" USING btree ("orderId");


--
-- Name: CxApologyCompensation_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CxApologyCompensation_status_idx" ON public."CxApologyCompensation" USING btree (status);


--
-- Name: CxApologyCompensation_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CxApologyCompensation_userId_createdAt_idx" ON public."CxApologyCompensation" USING btree ("userId", "createdAt");


--
-- Name: EconomicOptimizationSnapshot_appliedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EconomicOptimizationSnapshot_appliedBy_idx" ON public."EconomicOptimizationSnapshot" USING btree ("appliedBy");


--
-- Name: EconomicOptimizationSnapshot_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EconomicOptimizationSnapshot_status_idx" ON public."EconomicOptimizationSnapshot" USING btree (status);


--
-- Name: EconomicOptimizationSnapshot_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EconomicOptimizationSnapshot_tenantId_createdAt_idx" ON public."EconomicOptimizationSnapshot" USING btree ("tenantId", "createdAt" DESC);


--
-- Name: EconomicOptimizationSnapshot_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EconomicOptimizationSnapshot_tenantId_status_idx" ON public."EconomicOptimizationSnapshot" USING btree ("tenantId", status);


--
-- Name: EmployeeResponsibilityConsent_documentVersionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeResponsibilityConsent_documentVersionId_idx" ON public."EmployeeResponsibilityConsent" USING btree ("documentVersionId");


--
-- Name: EmployeeResponsibilityConsent_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeResponsibilityConsent_tenantId_idx" ON public."EmployeeResponsibilityConsent" USING btree ("tenantId");


--
-- Name: EmployeeResponsibilityConsent_userId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmployeeResponsibilityConsent_userId_status_idx" ON public."EmployeeResponsibilityConsent" USING btree ("userId", status);


--
-- Name: FeatureFlag_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureFlag_key_idx" ON public."FeatureFlag" USING btree (key);


--
-- Name: FeatureFlag_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FeatureFlag_key_key" ON public."FeatureFlag" USING btree (key);


--
-- Name: Invoice_paymentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_paymentId_key" ON public."Invoice" USING btree ("paymentId");


--
-- Name: Invoice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_status_idx" ON public."Invoice" USING btree (status);


--
-- Name: Invoice_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_userId_idx" ON public."Invoice" USING btree ("userId");


--
-- Name: LedgerEntry_adminId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_adminId_createdAt_idx" ON public."LedgerEntry" USING btree ("adminId", "createdAt");


--
-- Name: LedgerEntry_adminId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_adminId_idx" ON public."LedgerEntry" USING btree ("adminId");


--
-- Name: LedgerEntry_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_createdAt_id_idx" ON public."LedgerEntry" USING btree ("createdAt" DESC, id DESC);


--
-- Name: LedgerEntry_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON public."LedgerEntry" USING btree ("idempotencyKey");


--
-- Name: LedgerEntry_periodId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_periodId_idx" ON public."LedgerEntry" USING btree ("periodId");


--
-- Name: LedgerEntry_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_status_idx" ON public."LedgerEntry" USING btree (status);


--
-- Name: LedgerEntry_tenantId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_tenantId_createdAt_id_idx" ON public."LedgerEntry" USING btree ("tenantId", "createdAt" DESC, id DESC);


--
-- Name: LedgerEntry_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_tenantId_idx" ON public."LedgerEntry" USING btree ("tenantId");


--
-- Name: LedgerEntry_tenantId_transactionType_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_tenantId_transactionType_createdAt_idx" ON public."LedgerEntry" USING btree ("tenantId", "transactionType", "createdAt");


--
-- Name: LedgerEntry_tenantId_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_tenantId_userId_createdAt_idx" ON public."LedgerEntry" USING btree ("tenantId", "userId", "createdAt");


--
-- Name: LedgerEntry_userId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_userId_createdAt_id_idx" ON public."LedgerEntry" USING btree ("userId", "createdAt" DESC, id DESC);


--
-- Name: LedgerEntry_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LedgerEntry_userId_idx" ON public."LedgerEntry" USING btree ("userId");


--
-- Name: LegalDocumentVersion_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LegalDocumentVersion_tenantId_idx" ON public."LegalDocumentVersion" USING btree ("tenantId");


--
-- Name: LegalDocumentVersion_type_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LegalDocumentVersion_type_isActive_idx" ON public."LegalDocumentVersion" USING btree (type, "isActive");


--
-- Name: LegalDocumentVersion_type_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LegalDocumentVersion_type_version_key" ON public."LegalDocumentVersion" USING btree (type, version);


--
-- Name: LoginLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoginLog_createdAt_idx" ON public."LoginLog" USING btree ("createdAt");


--
-- Name: LoginLog_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoginLog_email_idx" ON public."LoginLog" USING btree (email);


--
-- Name: LoginLog_ipAddress_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoginLog_ipAddress_idx" ON public."LoginLog" USING btree ("ipAddress");


--
-- Name: LoginLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoginLog_tenantId_idx" ON public."LoginLog" USING btree ("tenantId");


--
-- Name: ManualBalanceAdjustment_approvedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ManualBalanceAdjustment_approvedBy_idx" ON public."ManualBalanceAdjustment" USING btree ("approvedBy");


--
-- Name: ManualBalanceAdjustment_direction_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ManualBalanceAdjustment_direction_status_createdAt_idx" ON public."ManualBalanceAdjustment" USING btree (direction, status, "createdAt");


--
-- Name: ManualBalanceAdjustment_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ManualBalanceAdjustment_idempotencyKey_key" ON public."ManualBalanceAdjustment" USING btree ("idempotencyKey");


--
-- Name: ManualBalanceAdjustment_rejectedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ManualBalanceAdjustment_rejectedBy_idx" ON public."ManualBalanceAdjustment" USING btree ("rejectedBy");


--
-- Name: ManualBalanceAdjustment_requestedBy_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ManualBalanceAdjustment_requestedBy_createdAt_idx" ON public."ManualBalanceAdjustment" USING btree ("requestedBy", "createdAt");


--
-- Name: ManualBalanceAdjustment_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ManualBalanceAdjustment_status_createdAt_idx" ON public."ManualBalanceAdjustment" USING btree (status, "createdAt");


--
-- Name: ManualBalanceAdjustment_ticketId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ManualBalanceAdjustment_ticketId_idx" ON public."ManualBalanceAdjustment" USING btree ("ticketId");


--
-- Name: ManualBalanceAdjustment_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ManualBalanceAdjustment_userId_createdAt_idx" ON public."ManualBalanceAdjustment" USING btree ("userId", "createdAt");


--
-- Name: MessageAttachment_messageId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessageAttachment_messageId_idx" ON public."MessageAttachment" USING btree ("messageId");


--
-- Name: Network_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Network_name_key" ON public."Network" USING btree (name);


--
-- Name: Network_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Network_slug_key" ON public."Network" USING btree (slug);


--
-- Name: Network_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Network_tenantId_idx" ON public."Network" USING btree ("tenantId");


--
-- Name: OrderRecoveryIncident_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderRecoveryIncident_createdAt_idx" ON public."OrderRecoveryIncident" USING btree ("createdAt");


--
-- Name: OrderRecoveryIncident_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderRecoveryIncident_orderId_idx" ON public."OrderRecoveryIncident" USING btree ("orderId");


--
-- Name: OrderRecoveryIncident_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderRecoveryIncident_userId_idx" ON public."OrderRecoveryIncident" USING btree ("userId");


--
-- Name: Order_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_createdAt_id_idx" ON public."Order" USING btree ("createdAt" DESC, id DESC);


--
-- Name: Order_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_createdAt_idx" ON public."Order" USING btree ("createdAt");


--
-- Name: Order_externalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_externalId_idx" ON public."Order" USING btree ("externalId");


--
-- Name: Order_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON public."Order" USING btree ("idempotencyKey");


--
-- Name: Order_numericId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Order_numericId_key" ON public."Order" USING btree ("numericId");


--
-- Name: Order_paymentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_paymentId_idx" ON public."Order" USING btree ("paymentId");


--
-- Name: Order_promoCodeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_promoCodeId_idx" ON public."Order" USING btree ("promoCodeId");


--
-- Name: Order_providerId_externalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_providerId_externalId_idx" ON public."Order" USING btree ("providerId", "externalId");


--
-- Name: Order_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_serviceId_idx" ON public."Order" USING btree ("serviceId");


--
-- Name: Order_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_status_createdAt_idx" ON public."Order" USING btree (status, "createdAt");


--
-- Name: Order_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_status_idx" ON public."Order" USING btree (status);


--
-- Name: Order_tenantId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_tenantId_createdAt_id_idx" ON public."Order" USING btree ("tenantId", "createdAt" DESC, id DESC);


--
-- Name: Order_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_tenantId_createdAt_idx" ON public."Order" USING btree ("tenantId", "createdAt" DESC);


--
-- Name: Order_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_tenantId_idx" ON public."Order" USING btree ("tenantId");


--
-- Name: Order_tenantId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_tenantId_status_createdAt_idx" ON public."Order" USING btree ("tenantId", status, "createdAt");


--
-- Name: Order_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_tenantId_userId_idx" ON public."Order" USING btree ("tenantId", "userId");


--
-- Name: Order_tenantId_userId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_tenantId_userId_status_createdAt_idx" ON public."Order" USING btree ("tenantId", "userId", status, "createdAt");


--
-- Name: Order_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_userId_idx" ON public."Order" USING btree ("userId");


--
-- Name: Order_userId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_userId_status_createdAt_idx" ON public."Order" USING btree ("userId", status, "createdAt" DESC);


--
-- Name: Order_userId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_userId_status_idx" ON public."Order" USING btree ("userId", status);


--
-- Name: Page_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Page_slug_key" ON public."Page" USING btree (slug);


--
-- Name: Payment_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_createdAt_idx" ON public."Payment" USING btree ("createdAt");


--
-- Name: Payment_gatewayId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_gatewayId_idx" ON public."Payment" USING btree ("gatewayId");


--
-- Name: Payment_gatewayId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payment_gatewayId_key" ON public."Payment" USING btree ("gatewayId");


--
-- Name: Payment_orderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payment_orderId_key" ON public."Payment" USING btree ("orderId");


--
-- Name: Payment_receiptId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payment_receiptId_key" ON public."Payment" USING btree ("receiptId");


--
-- Name: Payment_refundReceiptId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payment_refundReceiptId_key" ON public."Payment" USING btree ("refundReceiptId");


--
-- Name: Payment_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_status_createdAt_idx" ON public."Payment" USING btree (status, "createdAt");


--
-- Name: Payment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_status_idx" ON public."Payment" USING btree (status);


--
-- Name: Payment_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_tenantId_createdAt_idx" ON public."Payment" USING btree ("tenantId", "createdAt" DESC);


--
-- Name: Payment_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_tenantId_idx" ON public."Payment" USING btree ("tenantId");


--
-- Name: Payment_tenantId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_tenantId_status_createdAt_idx" ON public."Payment" USING btree ("tenantId", status, "createdAt");


--
-- Name: Payment_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_tenantId_userId_idx" ON public."Payment" USING btree ("tenantId", "userId");


--
-- Name: Payment_tenantId_userId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_tenantId_userId_status_createdAt_idx" ON public."Payment" USING btree ("tenantId", "userId", status, "createdAt");


--
-- Name: Payment_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_userId_idx" ON public."Payment" USING btree ("userId");


--
-- Name: Payment_userId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_userId_status_createdAt_idx" ON public."Payment" USING btree ("userId", status, "createdAt" DESC);


--
-- Name: PiiAccessLog_staffId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PiiAccessLog_staffId_createdAt_idx" ON public."PiiAccessLog" USING btree ("staffId", "createdAt");


--
-- Name: PiiAccessLog_targetType_targetId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PiiAccessLog_targetType_targetId_idx" ON public."PiiAccessLog" USING btree ("targetType", "targetId");


--
-- Name: PreLaunchLead_email_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PreLaunchLead_email_tenantId_key" ON public."PreLaunchLead" USING btree (email, "tenantId");


--
-- Name: PreLaunchLead_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PreLaunchLead_tenantId_createdAt_idx" ON public."PreLaunchLead" USING btree ("tenantId", "createdAt");


--
-- Name: ProcessedBonusEvent_eventType_eventId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProcessedBonusEvent_eventType_eventId_key" ON public."ProcessedBonusEvent" USING btree ("eventType", "eventId");


--
-- Name: ProcessedBonusEvent_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProcessedBonusEvent_userId_idx" ON public."ProcessedBonusEvent" USING btree ("userId");


--
-- Name: PromoCodeUsage_orderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PromoCodeUsage_orderId_key" ON public."PromoCodeUsage" USING btree ("orderId");


--
-- Name: PromoCodeUsage_promoCodeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PromoCodeUsage_promoCodeId_idx" ON public."PromoCodeUsage" USING btree ("promoCodeId");


--
-- Name: PromoCodeUsage_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PromoCodeUsage_userId_idx" ON public."PromoCodeUsage" USING btree ("userId");


--
-- Name: PromoCode_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PromoCode_code_key" ON public."PromoCode" USING btree (code);


--
-- Name: ProviderOutbox_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProviderOutbox_idempotencyKey_key" ON public."ProviderOutbox" USING btree ("idempotencyKey");


--
-- Name: ProviderOutbox_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderOutbox_orderId_idx" ON public."ProviderOutbox" USING btree ("orderId");


--
-- Name: ProviderOutbox_providerId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderOutbox_providerId_status_idx" ON public."ProviderOutbox" USING btree ("providerId", status);


--
-- Name: ProviderProxyLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderProxyLog_createdAt_idx" ON public."ProviderProxyLog" USING btree ("createdAt");


--
-- Name: ProviderProxyLog_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderProxyLog_providerId_idx" ON public."ProviderProxyLog" USING btree ("providerId");


--
-- Name: ProviderProxyLog_proxyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderProxyLog_proxyId_idx" ON public."ProviderProxyLog" USING btree ("proxyId");


--
-- Name: ProviderProxy_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderProxy_category_idx" ON public."ProviderProxy" USING btree (category);


--
-- Name: ProviderProxy_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderProxy_expiresAt_idx" ON public."ProviderProxy" USING btree ("expiresAt");


--
-- Name: ProviderProxy_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderProxy_isActive_idx" ON public."ProviderProxy" USING btree ("isActive");


--
-- Name: ProviderProxy_protocol_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderProxy_protocol_idx" ON public."ProviderProxy" USING btree (protocol);


--
-- Name: Provider_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Provider_name_key" ON public."Provider" USING btree (name);


--
-- Name: Provider_proxyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Provider_proxyId_key" ON public."Provider" USING btree ("proxyId");


--
-- Name: RateLimit_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RateLimit_expiresAt_idx" ON public."RateLimit" USING btree ("expiresAt");


--
-- Name: RateLimit_ip_endpoint_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RateLimit_ip_endpoint_key" ON public."RateLimit" USING btree (ip, endpoint);


--
-- Name: Refill_numericId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Refill_numericId_key" ON public."Refill" USING btree ("numericId");


--
-- Name: Refill_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Refill_orderId_idx" ON public."Refill" USING btree ("orderId");


--
-- Name: Refill_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Refill_status_idx" ON public."Refill" USING btree (status);


--
-- Name: SecurityEvent_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SecurityEvent_createdAt_idx" ON public."SecurityEvent" USING btree ("createdAt");


--
-- Name: SecurityEvent_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SecurityEvent_event_idx" ON public."SecurityEvent" USING btree (event);


--
-- Name: SecurityEvent_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SecurityEvent_tenantId_idx" ON public."SecurityEvent" USING btree ("tenantId");


--
-- Name: ServiceCustomerAccess_customerGroupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceCustomerAccess_customerGroupId_idx" ON public."ServiceCustomerAccess" USING btree ("customerGroupId");


--
-- Name: ServiceCustomerAccess_serviceId_customerGroupId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ServiceCustomerAccess_serviceId_customerGroupId_key" ON public."ServiceCustomerAccess" USING btree ("serviceId", "customerGroupId");


--
-- Name: ServiceCustomerAccess_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceCustomerAccess_serviceId_idx" ON public."ServiceCustomerAccess" USING btree ("serviceId");


--
-- Name: ServiceDraft_providerId_externalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceDraft_providerId_externalId_idx" ON public."ServiceDraft" USING btree ("providerId", "externalId");


--
-- Name: ServiceDraft_serviceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ServiceDraft_serviceId_key" ON public."ServiceDraft" USING btree ("serviceId");


--
-- Name: ServiceDraft_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceDraft_status_idx" ON public."ServiceDraft" USING btree (status);


--
-- Name: ServiceDraft_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceDraft_tenantId_idx" ON public."ServiceDraft" USING btree ("tenantId");


--
-- Name: ServiceEditHistory_adminId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceEditHistory_adminId_idx" ON public."ServiceEditHistory" USING btree ("adminId");


--
-- Name: ServiceEditHistory_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceEditHistory_createdAt_idx" ON public."ServiceEditHistory" USING btree ("createdAt");


--
-- Name: ServiceEditHistory_draftId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceEditHistory_draftId_idx" ON public."ServiceEditHistory" USING btree ("draftId");


--
-- Name: ServiceEditHistory_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceEditHistory_serviceId_idx" ON public."ServiceEditHistory" USING btree ("serviceId");


--
-- Name: ServiceLinkCheck_checkedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceLinkCheck_checkedAt_idx" ON public."ServiceLinkCheck" USING btree ("checkedAt");


--
-- Name: ServiceLinkCheck_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceLinkCheck_serviceId_idx" ON public."ServiceLinkCheck" USING btree ("serviceId");


--
-- Name: ServiceLinkCheck_targetType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceLinkCheck_targetType_idx" ON public."ServiceLinkCheck" USING btree ("targetType");


--
-- Name: ServicePriceHistory_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServicePriceHistory_createdAt_idx" ON public."ServicePriceHistory" USING btree ("createdAt");


--
-- Name: ServicePriceHistory_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServicePriceHistory_serviceId_idx" ON public."ServicePriceHistory" USING btree ("serviceId");


--
-- Name: ServiceRoute_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceRoute_providerId_idx" ON public."ServiceRoute" USING btree ("providerId");


--
-- Name: ServiceRoute_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceRoute_serviceId_idx" ON public."ServiceRoute" USING btree ("serviceId");


--
-- Name: ServiceRoute_serviceId_providerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ServiceRoute_serviceId_providerId_key" ON public."ServiceRoute" USING btree ("serviceId", "providerId");


--
-- Name: ServiceSmartConfig_serviceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ServiceSmartConfig_serviceId_key" ON public."ServiceSmartConfig" USING btree ("serviceId");


--
-- Name: Service_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_categoryId_idx" ON public."Service" USING btree ("categoryId");


--
-- Name: Service_externalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_externalId_idx" ON public."Service" USING btree ("externalId");


--
-- Name: Service_isQuarantined_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_isQuarantined_idx" ON public."Service" USING btree ("isQuarantined");


--
-- Name: Service_numericId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Service_numericId_key" ON public."Service" USING btree ("numericId");


--
-- Name: Service_providerId_externalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_providerId_externalId_idx" ON public."Service" USING btree ("providerId", "externalId");


--
-- Name: Service_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_providerId_idx" ON public."Service" USING btree ("providerId");


--
-- Name: Service_qualityTier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_qualityTier_idx" ON public."Service" USING btree ("qualityTier");


--
-- Name: Service_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_slug_idx" ON public."Service" USING btree (slug);


--
-- Name: Service_tenantId_categoryId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_tenantId_categoryId_isActive_idx" ON public."Service" USING btree ("tenantId", "categoryId", "isActive");


--
-- Name: Service_tenantId_categoryId_isActive_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_tenantId_categoryId_isActive_sortOrder_idx" ON public."Service" USING btree ("tenantId", "categoryId", "isActive", "sortOrder");


--
-- Name: Service_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_tenantId_idx" ON public."Service" USING btree ("tenantId");


--
-- Name: Service_tenantId_isActive_qualityTier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_tenantId_isActive_qualityTier_idx" ON public."Service" USING btree ("tenantId", "isActive", "qualityTier");


--
-- Name: Service_tenantId_providerId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_tenantId_providerId_isActive_idx" ON public."Service" USING btree ("tenantId", "providerId", "isActive");


--
-- Name: Service_tenantId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Service_tenantId_slug_key" ON public."Service" USING btree ("tenantId", slug);


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: ShadowService_normalizedCategory_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShadowService_normalizedCategory_idx" ON public."ShadowService" USING btree ("normalizedCategory");


--
-- Name: ShadowService_platform_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShadowService_platform_idx" ON public."ShadowService" USING btree (platform);


--
-- Name: ShadowService_providerId_externalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ShadowService_providerId_externalId_key" ON public."ShadowService" USING btree ("providerId", "externalId");


--
-- Name: ShadowService_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShadowService_providerId_idx" ON public."ShadowService" USING btree ("providerId");


--
-- Name: ShadowService_providerId_normalizedCategory_rateRub_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShadowService_providerId_normalizedCategory_rateRub_idx" ON public."ShadowService" USING btree ("providerId", "normalizedCategory", "rateRub");


--
-- Name: ShadowService_rateRub_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShadowService_rateRub_idx" ON public."ShadowService" USING btree ("rateRub");


--
-- Name: ShadowService_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShadowService_tenantId_idx" ON public."ShadowService" USING btree ("tenantId");


--
-- Name: SlaTelemetrySnapshot_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SlaTelemetrySnapshot_createdAt_idx" ON public."SlaTelemetrySnapshot" USING btree ("createdAt");


--
-- Name: SlaTelemetrySnapshot_providerId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SlaTelemetrySnapshot_providerId_createdAt_idx" ON public."SlaTelemetrySnapshot" USING btree ("providerId", "createdAt" DESC);


--
-- Name: SmartCampaign_orderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SmartCampaign_orderId_key" ON public."SmartCampaign" USING btree ("orderId");


--
-- Name: SmartCampaign_paymentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmartCampaign_paymentId_idx" ON public."SmartCampaign" USING btree ("paymentId");


--
-- Name: SmartCampaign_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmartCampaign_serviceId_idx" ON public."SmartCampaign" USING btree ("serviceId");


--
-- Name: SmartCampaign_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmartCampaign_userId_idx" ON public."SmartCampaign" USING btree ("userId");


--
-- Name: SmartChannelMetric_campaignId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmartChannelMetric_campaignId_idx" ON public."SmartChannelMetric" USING btree ("campaignId");


--
-- Name: SmartDetectedUser_campaignId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmartDetectedUser_campaignId_idx" ON public."SmartDetectedUser" USING btree ("campaignId");


--
-- Name: SmartExecution_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmartExecution_providerId_idx" ON public."SmartExecution" USING btree ("providerId");


--
-- Name: SmartExecution_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmartExecution_taskId_idx" ON public."SmartExecution" USING btree ("taskId");


--
-- Name: SmartSnapshot_campaignId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmartSnapshot_campaignId_idx" ON public."SmartSnapshot" USING btree ("campaignId");


--
-- Name: SmartTask_campaignId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmartTask_campaignId_idx" ON public."SmartTask" USING btree ("campaignId");


--
-- Name: SmartTask_runAt_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmartTask_runAt_status_idx" ON public."SmartTask" USING btree ("runAt", status);


--
-- Name: StaffPermission_roleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StaffPermission_roleId_idx" ON public."StaffPermission" USING btree ("roleId");


--
-- Name: StaffPermission_roleId_section_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StaffPermission_roleId_section_key" ON public."StaffPermission" USING btree ("roleId", section);


--
-- Name: StaffPermission_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StaffPermission_tenantId_idx" ON public."StaffPermission" USING btree ("tenantId");


--
-- Name: StaffRole_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StaffRole_name_key" ON public."StaffRole" USING btree (name);


--
-- Name: StaffRole_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StaffRole_tenantId_idx" ON public."StaffRole" USING btree ("tenantId");


--
-- Name: StaffShift_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StaffShift_date_status_idx" ON public."StaffShift" USING btree (date, status);


--
-- Name: StaffShift_substituteUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StaffShift_substituteUserId_idx" ON public."StaffShift" USING btree ("substituteUserId");


--
-- Name: StaffShift_userId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StaffShift_userId_date_idx" ON public."StaffShift" USING btree ("userId", date);


--
-- Name: StaffShift_userId_date_shiftType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StaffShift_userId_date_shiftType_key" ON public."StaffShift" USING btree ("userId", date, "shiftType");


--
-- Name: StorefrontKey_keyHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StorefrontKey_keyHash_key" ON public."StorefrontKey" USING btree ("keyHash");


--
-- Name: StorefrontKey_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StorefrontKey_tenantId_idx" ON public."StorefrontKey" USING btree ("tenantId");


--
-- Name: SupportFinancialAction_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SupportFinancialAction_idempotencyKey_key" ON public."SupportFinancialAction" USING btree ("idempotencyKey");


--
-- Name: SupportFinancialAction_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportFinancialAction_orderId_idx" ON public."SupportFinancialAction" USING btree ("orderId");


--
-- Name: SupportFinancialAction_reviewStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportFinancialAction_reviewStatus_idx" ON public."SupportFinancialAction" USING btree ("reviewStatus");


--
-- Name: SupportFinancialAction_staffUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportFinancialAction_staffUserId_createdAt_idx" ON public."SupportFinancialAction" USING btree ("staffUserId", "createdAt");


--
-- Name: SupportFinancialAction_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportFinancialAction_status_idx" ON public."SupportFinancialAction" USING btree (status);


--
-- Name: SupportFinancialAction_targetUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportFinancialAction_targetUserId_createdAt_idx" ON public."SupportFinancialAction" USING btree ("targetUserId", "createdAt");


--
-- Name: SupportFinancialAction_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportFinancialAction_tenantId_createdAt_idx" ON public."SupportFinancialAction" USING btree ("tenantId", "createdAt");


--
-- Name: SupportFinancialAction_ticketId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportFinancialAction_ticketId_idx" ON public."SupportFinancialAction" USING btree ("ticketId");


--
-- Name: SupportHourlyUsage_staffUserId_hourKey_direction_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SupportHourlyUsage_staffUserId_hourKey_direction_key" ON public."SupportHourlyUsage" USING btree ("staffUserId", "hourKey", direction);


--
-- Name: SupportHourlyUsage_staffUserId_hourKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportHourlyUsage_staffUserId_hourKey_idx" ON public."SupportHourlyUsage" USING btree ("staffUserId", "hourKey");


--
-- Name: SupportHourlyUsage_tenantId_hourKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportHourlyUsage_tenantId_hourKey_idx" ON public."SupportHourlyUsage" USING btree ("tenantId", "hourKey");


--
-- Name: SupportLimitUsage_staffUserId_dayKey_direction_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SupportLimitUsage_staffUserId_dayKey_direction_key" ON public."SupportLimitUsage" USING btree ("staffUserId", "dayKey", direction);


--
-- Name: SupportLimitUsage_staffUserId_dayKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportLimitUsage_staffUserId_dayKey_idx" ON public."SupportLimitUsage" USING btree ("staffUserId", "dayKey");


--
-- Name: SupportLimitUsage_tenantId_dayKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportLimitUsage_tenantId_dayKey_idx" ON public."SupportLimitUsage" USING btree ("tenantId", "dayKey");


--
-- Name: SupportTemplate_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTemplate_category_idx" ON public."SupportTemplate" USING btree (category);


--
-- Name: SupportTemplate_shortcut_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SupportTemplate_shortcut_key" ON public."SupportTemplate" USING btree (shortcut);


--
-- Name: TelegramBotInstance_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramBotInstance_isActive_idx" ON public."TelegramBotInstance" USING btree ("isActive");


--
-- Name: TelegramBotInstance_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramBotInstance_role_idx" ON public."TelegramBotInstance" USING btree (role);


--
-- Name: TelegramBotInstance_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramBotInstance_tenantId_idx" ON public."TelegramBotInstance" USING btree ("tenantId");


--
-- Name: TelegramButton_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramButton_sortOrder_idx" ON public."TelegramButton" USING btree ("sortOrder");


--
-- Name: TelegramButton_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramButton_tenantId_idx" ON public."TelegramButton" USING btree ("tenantId");


--
-- Name: TelegramDailyStat_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramDailyStat_date_idx" ON public."TelegramDailyStat" USING btree (date);


--
-- Name: TelegramDailyStat_date_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TelegramDailyStat_date_tenantId_key" ON public."TelegramDailyStat" USING btree (date, "tenantId");


--
-- Name: TelegramDailyStat_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramDailyStat_tenantId_idx" ON public."TelegramDailyStat" USING btree ("tenantId");


--
-- Name: TelegramErrorLog_errorCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramErrorLog_errorCode_idx" ON public."TelegramErrorLog" USING btree ("errorCode");


--
-- Name: TelegramErrorLog_isResolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramErrorLog_isResolved_idx" ON public."TelegramErrorLog" USING btree ("isResolved");


--
-- Name: TelegramErrorLog_lastSeenAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramErrorLog_lastSeenAt_idx" ON public."TelegramErrorLog" USING btree ("lastSeenAt");


--
-- Name: TelegramErrorLog_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramErrorLog_level_idx" ON public."TelegramErrorLog" USING btree (level);


--
-- Name: TelegramErrorLog_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramErrorLog_source_idx" ON public."TelegramErrorLog" USING btree (source);


--
-- Name: TelegramErrorLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramErrorLog_tenantId_idx" ON public."TelegramErrorLog" USING btree ("tenantId");


--
-- Name: TelegramProxy_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramProxy_tenantId_idx" ON public."TelegramProxy" USING btree ("tenantId");


--
-- Name: TelegramTemplate_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramTemplate_category_idx" ON public."TelegramTemplate" USING btree (category);


--
-- Name: TelegramTemplate_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramTemplate_slug_idx" ON public."TelegramTemplate" USING btree (slug);


--
-- Name: TelegramTemplate_slug_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TelegramTemplate_slug_tenantId_key" ON public."TelegramTemplate" USING btree (slug, "tenantId");


--
-- Name: TelegramTemplate_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelegramTemplate_tenantId_idx" ON public."TelegramTemplate" USING btree ("tenantId");


--
-- Name: Tenant_customDomain_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_customDomain_key" ON public."Tenant" USING btree ("customDomain");


--
-- Name: Tenant_domain_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_domain_key" ON public."Tenant" USING btree (domain);


--
-- Name: Tenant_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);


--
-- Name: TicketFeedback_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TicketFeedback_score_idx" ON public."TicketFeedback" USING btree (score);


--
-- Name: TicketFeedback_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TicketFeedback_tenantId_createdAt_idx" ON public."TicketFeedback" USING btree ("tenantId", "createdAt");


--
-- Name: TicketFeedback_tenantId_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TicketFeedback_tenantId_score_idx" ON public."TicketFeedback" USING btree ("tenantId", score);


--
-- Name: TicketFeedback_ticketId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TicketFeedback_ticketId_key" ON public."TicketFeedback" USING btree ("ticketId");


--
-- Name: TicketFeedback_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TicketFeedback_userId_idx" ON public."TicketFeedback" USING btree ("userId");


--
-- Name: TicketMessage_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TicketMessage_orderId_idx" ON public."TicketMessage" USING btree ("orderId");


--
-- Name: TicketMessage_replyToId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TicketMessage_replyToId_idx" ON public."TicketMessage" USING btree ("replyToId");


--
-- Name: TicketMessage_telegramMsgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TicketMessage_telegramMsgId_idx" ON public."TicketMessage" USING btree ("telegramMsgId");


--
-- Name: TicketMessage_ticketId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON public."TicketMessage" USING btree ("ticketId", "createdAt");


--
-- Name: TicketMessage_ticketId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TicketMessage_ticketId_idx" ON public."TicketMessage" USING btree ("ticketId");


--
-- Name: Ticket_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_orderId_idx" ON public."Ticket" USING btree ("orderId");


--
-- Name: Ticket_paymentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_paymentId_idx" ON public."Ticket" USING btree ("paymentId");


--
-- Name: Ticket_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_source_idx" ON public."Ticket" USING btree (source);


--
-- Name: Ticket_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_status_createdAt_idx" ON public."Ticket" USING btree (status, "createdAt");


--
-- Name: Ticket_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_status_idx" ON public."Ticket" USING btree (status);


--
-- Name: Ticket_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_tenantId_idx" ON public."Ticket" USING btree ("tenantId");


--
-- Name: Ticket_tenantId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_tenantId_status_createdAt_idx" ON public."Ticket" USING btree ("tenantId", status, "createdAt");


--
-- Name: Ticket_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_tenantId_userId_idx" ON public."Ticket" USING btree ("tenantId", "userId");


--
-- Name: Ticket_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_userId_idx" ON public."Ticket" USING btree ("userId");


--
-- Name: Ticket_userId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_userId_status_idx" ON public."Ticket" USING btree ("userId", status);


--
-- Name: UrlPattern_networkId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UrlPattern_networkId_idx" ON public."UrlPattern" USING btree ("networkId");


--
-- Name: UserNote_authorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserNote_authorId_idx" ON public."UserNote" USING btree ("authorId");


--
-- Name: UserNote_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserNote_orderId_idx" ON public."UserNote" USING btree ("orderId");


--
-- Name: UserNote_ticketId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserNote_ticketId_idx" ON public."UserNote" USING btree ("ticketId");


--
-- Name: UserNote_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserNote_userId_idx" ON public."UserNote" USING btree ("userId");


--
-- Name: User_apiKeyHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_apiKeyHash_key" ON public."User" USING btree ("apiKeyHash");


--
-- Name: User_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_createdAt_id_idx" ON public."User" USING btree ("createdAt" DESC, id DESC);


--
-- Name: User_customerGroupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_customerGroupId_idx" ON public."User" USING btree ("customerGroupId");


--
-- Name: User_email_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_tenantId_key" ON public."User" USING btree (email, "tenantId");


--
-- Name: User_phoneHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_phoneHash_key" ON public."User" USING btree ("phoneHash");


--
-- Name: User_referralCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_referralCode_key" ON public."User" USING btree ("referralCode");


--
-- Name: User_referredById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_referredById_idx" ON public."User" USING btree ("referredById");


--
-- Name: User_staffRoleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_staffRoleId_idx" ON public."User" USING btree ("staffRoleId");


--
-- Name: User_tenantId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_tenantId_createdAt_id_idx" ON public."User" USING btree ("tenantId", "createdAt" DESC, id DESC);


--
-- Name: User_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_tenantId_idx" ON public."User" USING btree ("tenantId");


--
-- Name: api_request_log_api_key_hash_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_request_log_api_key_hash_created_at_idx ON public.api_request_log USING btree (api_key_hash, created_at);


--
-- Name: api_request_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_request_log_created_at_idx ON public.api_request_log USING btree (created_at);


--
-- Name: ledger_period_month_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ledger_period_month_key ON public.ledger_period USING btree (month);


--
-- Name: provider_service_backup_service_id_backup_provider_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX provider_service_backup_service_id_backup_provider_id_key ON public.provider_service_backup USING btree (service_id, backup_provider_id);


--
-- Name: provider_service_backup_service_id_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_service_backup_service_id_priority_idx ON public.provider_service_backup USING btree (service_id, priority);


--
-- Name: reconciliation_report_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reconciliation_report_date_idx ON public.reconciliation_report USING btree (date);


--
-- Name: revenue_recognition_order_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX revenue_recognition_order_id_key ON public.revenue_recognition USING btree (order_id);


--
-- Name: AiPricingRecommendation AiPricingRecommendation_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiPricingRecommendation"
    ADD CONSTRAINT "AiPricingRecommendation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AiPricingRecommendation AiPricingRecommendation_snapshotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiPricingRecommendation"
    ADD CONSTRAINT "AiPricingRecommendation_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES public."EconomicOptimizationSnapshot"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ApiConfig ApiConfig_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApiConfig"
    ADD CONSTRAINT "ApiConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuthToken AuthToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuthToken"
    ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Category Category_networkId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES public."Network"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Commission Commission_referrerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Commission"
    ADD CONSTRAINT "Commission_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ContentCategory ContentCategory_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentCategory"
    ADD CONSTRAINT "ContentCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."ContentCategory"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ContentItem ContentItem_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentItem"
    ADD CONSTRAINT "ContentItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."ContentCategory"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CxApologyCompensation CxApologyCompensation_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CxApologyCompensation"
    ADD CONSTRAINT "CxApologyCompensation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CxApologyCompensation CxApologyCompensation_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CxApologyCompensation"
    ADD CONSTRAINT "CxApologyCompensation_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EconomicOptimizationSnapshot EconomicOptimizationSnapshot_appliedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EconomicOptimizationSnapshot"
    ADD CONSTRAINT "EconomicOptimizationSnapshot_appliedBy_fkey" FOREIGN KEY ("appliedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmployeeResponsibilityConsent EmployeeResponsibilityConsent_documentVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmployeeResponsibilityConsent"
    ADD CONSTRAINT "EmployeeResponsibilityConsent_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES public."LegalDocumentVersion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmployeeResponsibilityConsent EmployeeResponsibilityConsent_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmployeeResponsibilityConsent"
    ADD CONSTRAINT "EmployeeResponsibilityConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Invoice Invoice_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public."Payment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LedgerEntry LedgerEntry_periodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES public.ledger_period(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LedgerEntry LedgerEntry_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ManualBalanceAdjustment ManualBalanceAdjustment_approvedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ManualBalanceAdjustment"
    ADD CONSTRAINT "ManualBalanceAdjustment_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ManualBalanceAdjustment ManualBalanceAdjustment_rejectedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ManualBalanceAdjustment"
    ADD CONSTRAINT "ManualBalanceAdjustment_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ManualBalanceAdjustment ManualBalanceAdjustment_requestedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ManualBalanceAdjustment"
    ADD CONSTRAINT "ManualBalanceAdjustment_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ManualBalanceAdjustment ManualBalanceAdjustment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ManualBalanceAdjustment"
    ADD CONSTRAINT "ManualBalanceAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MessageAttachment MessageAttachment_messageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageAttachment"
    ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES public."TicketMessage"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderRecoveryIncident OrderRecoveryIncident_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderRecoveryIncident"
    ADD CONSTRAINT "OrderRecoveryIncident_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderRecoveryIncident OrderRecoveryIncident_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderRecoveryIncident"
    ADD CONSTRAINT "OrderRecoveryIncident_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Order Order_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public."Payment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Order Order_promoCodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES public."PromoCode"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Order Order_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Order Order_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Payment Payment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PromoCodeUsage PromoCodeUsage_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromoCodeUsage"
    ADD CONSTRAINT "PromoCodeUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PromoCodeUsage PromoCodeUsage_promoCodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromoCodeUsage"
    ADD CONSTRAINT "PromoCodeUsage_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES public."PromoCode"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PromoCodeUsage PromoCodeUsage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromoCodeUsage"
    ADD CONSTRAINT "PromoCodeUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProviderProxyLog ProviderProxyLog_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderProxyLog"
    ADD CONSTRAINT "ProviderProxyLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ProviderProxyLog ProviderProxyLog_proxyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderProxyLog"
    ADD CONSTRAINT "ProviderProxyLog_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES public."ProviderProxy"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Provider Provider_proxyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Provider"
    ADD CONSTRAINT "Provider_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES public."ProviderProxy"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Refill Refill_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refill"
    ADD CONSTRAINT "Refill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceCustomerAccess ServiceCustomerAccess_customerGroupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceCustomerAccess"
    ADD CONSTRAINT "ServiceCustomerAccess_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES public."CustomerGroup"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceCustomerAccess ServiceCustomerAccess_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceCustomerAccess"
    ADD CONSTRAINT "ServiceCustomerAccess_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceDraft ServiceDraft_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceDraft"
    ADD CONSTRAINT "ServiceDraft_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceEditHistory ServiceEditHistory_draftId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceEditHistory"
    ADD CONSTRAINT "ServiceEditHistory_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES public."ServiceDraft"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceEditHistory ServiceEditHistory_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceEditHistory"
    ADD CONSTRAINT "ServiceEditHistory_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceLinkCheck ServiceLinkCheck_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceLinkCheck"
    ADD CONSTRAINT "ServiceLinkCheck_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServicePriceHistory ServicePriceHistory_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServicePriceHistory"
    ADD CONSTRAINT "ServicePriceHistory_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceRoute ServiceRoute_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceRoute"
    ADD CONSTRAINT "ServiceRoute_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServiceRoute ServiceRoute_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceRoute"
    ADD CONSTRAINT "ServiceRoute_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceSmartConfig ServiceSmartConfig_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceSmartConfig"
    ADD CONSTRAINT "ServiceSmartConfig_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Service Service_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Service Service_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShadowService ShadowService_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShadowService"
    ADD CONSTRAINT "ShadowService_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SmartCampaign SmartCampaign_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartCampaign"
    ADD CONSTRAINT "SmartCampaign_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SmartCampaign SmartCampaign_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartCampaign"
    ADD CONSTRAINT "SmartCampaign_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public."Payment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SmartCampaign SmartCampaign_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartCampaign"
    ADD CONSTRAINT "SmartCampaign_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SmartCampaign SmartCampaign_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartCampaign"
    ADD CONSTRAINT "SmartCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SmartChannelMetric SmartChannelMetric_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartChannelMetric"
    ADD CONSTRAINT "SmartChannelMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public."SmartCampaign"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SmartExecution SmartExecution_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartExecution"
    ADD CONSTRAINT "SmartExecution_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SmartExecution SmartExecution_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartExecution"
    ADD CONSTRAINT "SmartExecution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."SmartTask"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SmartSnapshot SmartSnapshot_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartSnapshot"
    ADD CONSTRAINT "SmartSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public."SmartCampaign"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SmartTask SmartTask_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmartTask"
    ADD CONSTRAINT "SmartTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public."SmartCampaign"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StaffPermission StaffPermission_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StaffPermission"
    ADD CONSTRAINT "StaffPermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."StaffRole"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StaffShift StaffShift_substituteUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StaffShift"
    ADD CONSTRAINT "StaffShift_substituteUserId_fkey" FOREIGN KEY ("substituteUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StaffShift StaffShift_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StaffShift"
    ADD CONSTRAINT "StaffShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StorefrontKey StorefrontKey_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StorefrontKey"
    ADD CONSTRAINT "StorefrontKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupportFinancialAction SupportFinancialAction_staffUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportFinancialAction"
    ADD CONSTRAINT "SupportFinancialAction_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SupportFinancialAction SupportFinancialAction_targetUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportFinancialAction"
    ADD CONSTRAINT "SupportFinancialAction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SystemSettings SystemSettings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemSettings"
    ADD CONSTRAINT "SystemSettings_id_fkey" FOREIGN KEY (id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TicketFeedback TicketFeedback_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketFeedback"
    ADD CONSTRAINT "TicketFeedback_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TicketFeedback TicketFeedback_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketFeedback"
    ADD CONSTRAINT "TicketFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TicketMessage TicketMessage_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketMessage"
    ADD CONSTRAINT "TicketMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TicketMessage TicketMessage_replyToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketMessage"
    ADD CONSTRAINT "TicketMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES public."TicketMessage"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TicketMessage TicketMessage_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketMessage"
    ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Ticket Ticket_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public."Payment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UrlPattern UrlPattern_networkId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UrlPattern"
    ADD CONSTRAINT "UrlPattern_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES public."Network"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserNote UserNote_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNote"
    ADD CONSTRAINT "UserNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UserNote UserNote_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNote"
    ADD CONSTRAINT "UserNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UserNote UserNote_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNote"
    ADD CONSTRAINT "UserNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UserNote UserNote_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNote"
    ADD CONSTRAINT "UserNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_customerGroupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES public."CustomerGroup"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_referredById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_staffRoleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_staffRoleId_fkey" FOREIGN KEY ("staffRoleId") REFERENCES public."StaffRole"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict qzva5r0zvYYNYUfC1hNtWxyS2gcBGrBUHznYPei71ySOUg14aAeBjtjuBgimfNq

