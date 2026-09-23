# ADR-004: Global Master Catalog vs. Tenant-Scoped Service Overrides

**Status:** APPROVED  
**Date:** 2026-07-25  
**Deciders:** Core Architecture Team, Antigravity AI Security Auditor  

---

## 1. Context & Problem Statement

In SMMplan's multi-tenant architecture, external SMM provider API catalogs contain over 5,000+ raw services (e.g. Telegram Views, Instagram Followers).
Storing separate duplicate rows of 5,000+ service definitions per tenant in PostgreSQL would create massive data bloat, sync churn, and database lock contention during nightly provider price syncs.

We must define explicit boundaries for when `Service` and `Category` queries are **Global Master Catalog operations** versus **Tenant-Scoped operations**.

---

## 2. Decision & Architectural Boundaries

### 2.1. Global Master Catalog (Single Source of Truth)
- `Category` and `Service` tables represent the **Global Master Catalog** (imported from SMM Panel providers like JustAnotherPanel, Secser, etc.).
- Provider synchronization workers (`sync-cbr`, provider sync cron, price drift monitoring) and SuperAdmin catalog management tools (`src/actions/admin/catalog/*`) operate on the Global Master Catalog.
- **Query Scoping Rule for Global Master Catalog:**
  Queries in `src/actions/admin/catalog/*` or provider sync scripts that fetch `db.category.findUnique` or `db.service.findUnique` by primary ID are **LECITIMATE GLOBAL OPERATIONS**. They do NOT represent cross-tenant data leaks because master categories and services are shared platform templates.

### 2.2. Tenant-Scoped Overrides & Routing
- Tenant-specific service rules (tenant markup, custom service titles, tenant enable/disable toggles, provider routing) are stored in tenant-scoped tables:
  - `ServiceRoute` (`tenantId`, `serviceId`, `providerId`)
  - `ServiceSmartConfig` / `TenantServiceConfig` (`tenantId`, `serviceId`, `customMargin`)
  - `Order` (`tenantId`, `serviceId`, `userId`, `amount`)
- **Query Scoping Rule for Tenant Operations:**
  All user-facing operations (checkout, client catalog display, order creation, user balance deductions) **MUST ENFORCE `tenantId`**. Querying an `Order`, `Payment`, `SmartCampaign`, or tenant service config without `tenantId` is a **CRITICAL CROSS-TENANT SECURITY VIOLATION (SC03)**.

---

## 3. ALSH SC03 Enforcement Policy

Based on this ADR:
1. **BLOCK:** Any tenant-scoped entity (`Order`, `Payment`, `SmartCampaign`, `SmartTask`, `Commission`, `Ticket`) queried without `tenantId` filter or `tenantWhere` guard in customer-facing code.
2. **ALLOWLIST / WARN:** Global Master Catalog queries on `Service` or `Category` located inside `src/actions/admin/catalog/*` or provider sync background workers.
3. **BLOCK:** Any user-facing action (`src/actions/order/*`, `src/actions/user/*`) querying tenant data without explicit tenant boundaries.
