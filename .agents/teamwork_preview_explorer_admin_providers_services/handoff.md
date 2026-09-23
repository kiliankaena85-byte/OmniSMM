# Providers & Services Logical Audit Report

## 1. Observation
Below are the exact code locations and verbatim lines for the six major logical and security discrepancies found in the Smmplan admin panel catalog, routing, and provider modules:

### Finding 1: Double Currency Conversion in Batch Markup Actions
* **File Path**: `src/actions/admin/catalog/batch.ts`
* **Line 95** (inside `batchSetMarkupAction`):
  ```tsx
  pricePer1000Cents: Math.round(applyBeautifulRounding(s.rate * m * usdToRub) * 100)
  ```
* **Line 146** (inside `updateServiceMarkupAction`):
  ```tsx
  pricePer1000Cents: Math.round(applyBeautifulRounding(service.rate * m * usdToRub) * 100)
  ```
* **Context**: Neither function checks if the service's `providerCurrency` is `'RUB'`. In contrast, `src/services/admin/catalog.service.ts` line 135–136 correctly handles currency checks:
  ```tsx
  const usdToRub = await SettingsProvider.getExchangeRateUSD();
  const exchangeRate = service.providerCurrency === 'RUB' ? 1.0 : usdToRub;
  ```

### Finding 2: Artificially Restrictive Minimum Markup in Batch Actions
* **File Path**: `src/actions/admin/catalog/batch.ts`
* **Line 22**:
  ```tsx
  const MIN_MARKUP = (1 + SAFETY_FLOOR_MARKUP) / (1 - TOTAL_MANDATORY_DEDUCTIONS);
  ```
* **Line 25**:
  ```tsx
  const markupSchema = z.number().min(MIN_MARKUP).max(150);
  ```
* **Context**: `MIN_MARKUP` is computed as `2.33918` (based on safety floor retail price ratio). This schema prevents administrators from bulk-setting the markup multiplier below `2.34` (e.g., setting a multiplier of `1.5` or `1.8`), even though manual service updates (`catalog.service.ts` line 130) allow markup values down to `1.0`.

### Finding 3: Silent Quarantine Bypass via Service Audit Engine
* **File Path**: `src/services/admin/audit-engine.ts`
* **Lines 100–103**:
  ```tsx
  if (originalMarkup < 5.0 || actualMarkup < 5.0) {
    newMarkup = Math.max(originalMarkup, 5.0);
    newPrice = Math.round(applyBeautifulRounding(rate * newMarkup * exchangeRate) * 100);
  }
  ```
* **Lines 111–122**:
  ```tsx
  if (nameChanged || descriptionChanged || priceChanged || markupChanged) {
    await db.service.update({
      where: { id: service.id },
      data: {
        name: cleanedName,
        description: cleanedDescription,
        markup: newMarkup,
        pricePer1000Cents: newPrice,
        isQuarantined: false,
        quarantineReason: null,
        quarantinedAt: null,
      },
    });
  ```
* **Context**: If a service is quarantined and the sync process modifies its name/description or fixes its markup, the database update unconditionally sets `isQuarantined: false`, bypassing the quarantine queue.

### Finding 4: Unapprovable Quarantine Entries when `pendingRate` is Null
* **File Path**: `src/actions/admin/providers/sync-action.ts`
* **Lines 310–312** (inside `approveQuarantinedService`):
  ```tsx
  if (!service?.isQuarantined || service.pendingRate === null) {
    return { success: false, error: "Service not in quarantine" };
  }
  ```
* **Context**: Services quarantined due to "Invalid Provider Rate" (rate is `NaN` or `<= 0`) do not populate `pendingRate`. When trying to approve these from the quarantine list, the system rejects it because `pendingRate` is `null`.

### Finding 5: Stale Rates and Prices on Hot Swap Routing Execution
* **File Path**: `src/actions/admin/routing.actions.ts`
* **Lines 114–120** (inside `executeHotSwap`):
  ```tsx
  await tx.service.update({
    where: { id: serviceId },
    data: {
      providerId: targetRoute.providerId,
      externalId: targetRoute.providerServiceId
    }
  });
  ```
* **Context**: When executing a Hot Swap of a service's route, the new rate from the new provider is not fetched to recalculate the service's `rate` or `pricePer1000Cents`. The service retains the stale rate from the old provider until the next full catalog sync runs.

### Finding 6: Inconsistent and Hardcoded Price Spike Quarantine Thresholds
* **File Path**: `src/actions/admin/providers/sync-action.ts` (Line 151) & `src/services/admin/catalog.service.ts` (Line 230)
* **Line 151** in `sync-action.ts`:
  ```tsx
  if (increaseRatio > 1.10) { // Скачок > 10%
  ```
* **Line 230** in `catalog.service.ts`:
  ```tsx
  const QUARANTINE_THRESHOLD = 0.2; // 20% price increase tolerance
  ```
* **Context**: Both sync paths hardcode their price spike thresholds (10% vs 20%) and completely ignore the user-configurable database field `quarantineThreshold` defined in `SystemSettings` (default `0.20`).

---

## 2. Logic Chain
1. **Double Currency Conversion (Finding 1)**:
   - Observation: `batchSetMarkupAction` multiplies `s.rate` by `usdToRub` directly.
   - Deduction: For services whose provider operates in RUB (`providerCurrency === 'RUB'`), the rate is already in Rubles.
   - Conclusion: Multiplying by `usdToRub` converts the rate a second time, resulting in an inflated retail price (~90x too expensive).

2. **Artificially Restrictive Minimum Markup (Finding 2)**:
   - Observation: `MIN_MARKUP` is set to `(1 + SAFETY_FLOOR_MARKUP) / (1 - TOTAL_MANDATORY_DEDUCTIONS) ≈ 2.34`.
   - Deduction: This represents the break-even selling price ratio to cover tax and acquiring fees under a `1.0` markup floor. It does not represent the minimum raw markup multiplier.
   - Conclusion: Requiring bulk updates to use a minimum multiplier of `2.34` prevents administrators from setting lower markup rates, even though single-service updates allow multipliers down to `1.0`.

3. **Quarantine Bypass (Finding 3)**:
   - Observation: `auditAndFixService` updates the database with `isQuarantined: false` whenever a fix is applied.
   - Deduction: Since `auditAndFixService` runs on all services during catalog synchronization (including those currently quarantined), any minor correction to name, description, or markup clears the quarantine.
   - Conclusion: A price spike or margin floor breach quarantine is silently bypassed, allowing potentially loss-making services to go live without admin approval.

4. **Quarantine Deadlock (Finding 4)**:
   - Observation: `approveQuarantinedService` returns an error if `service.pendingRate === null`.
   - Deduction: When services enter quarantine due to an invalid provider rate (NaN or <= 0), no `pendingRate` is set.
   - Conclusion: These services cannot be approved via the admin UI and are stuck in quarantine forever.

5. **Stale Price on Hot Swap (Finding 5)**:
   - Observation: `executeHotSwap` only updates the service's `providerId` and `externalId`.
   - Deduction: It does not fetch the new provider's rate or recalculate the retail price in RUB cents.
   - Conclusion: Orders will immediately route to the new provider using the cost basis of the old provider, risking financial losses if the new provider's rate is higher.

6. **Inconsistent/Bypassed Settings (Finding 6)**:
   - Observation: `sync-action.ts` hardcodes a 10% threshold, while `catalog.service.ts` hardcodes a 20% threshold.
   - Deduction: Neither queries `SystemSettings.quarantineThreshold`.
   - Conclusion: Settings changed in the admin panel are bypassed, and different sync entry points exhibit inconsistent quarantine behaviors.

---

## 3. Caveats
- We did not audit the background worker schedule frequency for catalog synchronization, which may impact the duration that stale prices persist after a Hot Swap.
- We assume that `usdToRub` is updated daily via CBR sync, but did not investigate the CBR sync cron itself.

---

## 4. Conclusion
The Providers, Services, and Catalog Import modules in Smmplan contain significant business logic errors and edge-case vulnerabilities:
1. **Price errors**: Double currency conversion in batch updates will cause extreme overpricing for RUB-based providers.
2. **Quarantine bypasses**: Automatic text cleaning and markup corrections silently release quarantined services.
3. **Quarantine deadlocks**: Invalid rates quarantine services permanently with no admin UI path to approve.
4. **Hot Swap lag**: Swapping routes leaves the service cost rate stale, risking immediate losses.
5. **Setting ignoring**: Configured quarantine thresholds are ignored in favor of inconsistent hardcoded ratios.

---

## 5. Verification Method
1. Run the existing routing and catalog test suite to verify no regressions:
   `npx vitest run src/actions/admin/providers/__tests__/`
2. Inspect the database schema and compare the update calls in `src/actions/admin/catalog/batch.ts` and `src/actions/admin/routing.actions.ts`.
3. Try bulk updating markup for a RUB-based provider service and observe the resulting `pricePer1000Cents` value.
