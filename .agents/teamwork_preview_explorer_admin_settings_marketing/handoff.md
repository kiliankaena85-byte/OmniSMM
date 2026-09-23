# Handoff Report — Settings & Marketing Audit

## 1. Observation

During the deep logical audit of the Settings, Marketing, Knowledge Base, CMS, and Analytics modules, the following file paths, line numbers, and implementation details were observed:

### A. Destructive Settings Partial Updates
- **File**: `src/actions/admin/settings.ts`
- **Lines 64-122**:
```typescript
export async function updateGlobalSettings(formData: FormData) {
  const result = await requireStaffPermission("settings", "edit", async (user) => {
    const parsed = globalSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new Error('Validation failed');
    
    const {
      maintenanceMode,
      siteName,
      siteDescription,
      usnScheme,
      ...
    } = parsed.data;

    const oldSettings = await db.systemSettings.findUnique({ where: { id: 'global' } });

    const dataToUpdate: any = { 
      maintenanceMode, 
      siteName, 
      siteDescription,
      usnScheme,
      ...
```
- **File**: `src/validators/admin.validators.ts`
- **Lines 48-52**:
```typescript
export const globalSettingsSchema = z.object({
  maintenanceMode: z.any().transform((val) => val === 'true' || val === 'on'),
  siteName: z.string().trim().max(100).optional().default('SMMplan'),
  siteDescription: z.string().trim().max(500).optional().default(''),
  usnScheme: z.enum(['INCOME', 'INCOME_EXPENSES']).optional().default('INCOME_EXPENSES'),
```
- **File**: `src/app/admin/settings/integrations-settings.tsx`
- **Description**: Contains three separate forms (Telegram Bot form, Payments form, Email form) all submitting via `formAction` to `updateGlobalSettings` Server Action.
- **File**: `src/app/admin/settings/general-settings.tsx`
- **Description**: Contains the main system settings form.

### B. Promo Code / Voucher 100x Discrepancy
- **File**: `src/app/admin/marketing/create-promo-form.tsx`
- **Lines 107-112**:
```tsx
        {type === 'VOUCHER' && (
          <div className="animate-fade-in space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-extrabold">Сумма (₽)</Label>
            <Input name="amount" type="number" placeholder="500" defaultValue="0" required disabled={isPending} className="bg-muted/60 font-mono tracking-widest border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 h-[44px]" />
          </div>
        )}
```
- **File**: `src/actions/admin/marketing.ts`
- **Lines 13-14 & 68-73**:
```typescript
  amount: z.coerce.number().int().min(0, "Сумма не может быть отрицательной").max(500000, "Максимальная сумма ваучера 500,000 копеек (5,000 ₽)").optional().default(0),
...
    const budgetCents = Math.round(budget * 100);

    await adminMarketingService.createPromoCode({
      code,
      type,
      discountPercent,
      amount,
```
- **File**: `prisma/schema.prisma`
- **Line 94**:
```prisma
  amount          Int       @default(0) // Fixed amount in Cents (used when type=VOUCHER)
```

### C. Schema.org Date Formatting
- **File**: `src/app/knowledge/[slug]/page.tsx`
- **Lines 240-252**:
```typescript
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": article.title,
    "description": article.description,
    "articleBody": article.content,
    "datePublished": article.createdAt.toString(),
    "dateModified": article.updatedAt.toString(),
```
- **File**: `src/app/academy/[slug]/page.tsx`
- **Lines 83-84**:
```typescript
            "datePublished": publishDate.toISOString(),
            "dateModified": article.updatedAt.toISOString(),
```

### D. Duplicate Routing and Preview Redirect Mismatch
- **File**: `src/app/api/draft/route.ts`
- **Lines 32-37**:
```typescript
  // Включаем Draft Mode (Next.js устанавливает cookie)
  const draft = await draftMode();
  draft.enable();

  // Редирект на страницу со статьей
  redirect(`/p/${post.slug}`);
```
- **Files**: `src/app/legal/[slug]/page.tsx`, `src/app/academy/[slug]/page.tsx`, `src/app/p/[slug]/page.tsx`
- **Description**: CMS items of type `PAGE` and `ACADEMY_LESSON` are rendered on specific routes (`/legal/[slug]`, `/academy/[slug]`) and generic routes (`/p/[slug]`) simultaneously, and lack canonical links.

### E. Orphaned Model & Missing UI Fields
- **File**: `prisma/schema.prisma`
- **Lines 807-814**:
```prisma
model ContentCategory {
  id       String            @id @default(cuid())
  name     String
  slug     String            @unique
  parentId String?
  parent   ContentCategory?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children ContentCategory[] @relation("CategoryTree")
  items    ContentItem[]
```
- **Files**: `src/components/admin/cms/CMSForm.tsx`, `src/app/admin/knowledge/ArticleForm.tsx`
- **Description**: `CMSForm` lacks inputs for `coverImage`, `readTimeMinutes`, `metaTitle`, `metaDescription`, and `categoryId`. `ArticleForm` lacks inputs for `priority`. No code in `src/` implements categories for CMS items (`ContentCategory`).

### F. Granular RBAC Permissions Bypassed in CMS Actions
- **File**: `src/actions/admin/content.ts`
- **Lines 26, 78, 108, 144**:
```typescript
  await enforcePageRole(["ADMIN", "OWNER"]);
```

---

## 2. Logic Chain

1. **Destructive Settings Updates**: 
   - A single Server Action (`updateGlobalSettings`) processes fields using `globalSettingsSchema`.
   - The settings layout uses separate form components for general info, mail settings, payment keys, etc.
   - When one form is submitted, only the fields inside it are present in the POST body. 
   - Zod applies defaults (`default('SMMplan')`, `default('')`, `default('INCOME_EXPENSES')`) and transforms missing checkbox values to `false` for fields that are absent in the form.
   - The update payload passed to the service/Prisma contains these default/false values, overwriting the actual customized configuration in the database every time any partial settings form is saved.

2. **Promo Code / Voucher 100x Discrepancy**:
   - The UI field `amount` is labeled "Сумма (₽)", meaning input is interpreted as rubles.
   - In the database schema, `amount` is stored as an integer representing cents (`amount Int @default(0) // Fixed amount in Cents`).
   - The Server Action `createPromoCode` does NOT multiply the received `amount` by 100, unlike `budget` (`const budgetCents = Math.round(budget * 100);`).
   - Consequently, entering "500" in the form saves "500" (cents) to the database, which is worth 5 Rubles. Clients applying this voucher receive 5 Rubles, causing a 100x value loss.

3. **Schema.org Date Formatting**:
   - Schema.org expects ISO 8601 formatting (e.g., `YYYY-MM-DDTHH:mm:ss.sssZ`) for date properties (`datePublished`, `dateModified`).
   - `article.createdAt.toString()` returns a localized timezone text representation (e.g. `Fri Jun 12 2026 07:05:26 GMT+0000`).
   - This invalid string layout will cause structured data validation errors in Google Search Console and other SEO scrapers, degrading search rank.

4. **Duplicate Content Routing & Previews**:
   - `ContentItem` rows are queried and rendered at `/p/[slug]` (generic) and `/legal/[slug]` (legal) or `/academy/[slug]` (academy) concurrently.
   - The absence of canonical URL declarations in metadata leaves search engines to flag this duplicate content.
   - Additionally, draft mode redirects the preview directly to `/p/${post.slug}`, which may not match the actual user-facing public path intended for that page type (e.g., `/academy/...` or `/legal/...`).

5. **Orphaned Categories & Missing Inputs**:
   - In `schema.prisma`, `ContentCategory` is linked to `ContentItem`. However, a search of the codebase returns no endpoints, controllers, actions, or views referencing `ContentCategory` in `src/`.
   - The CMS edit form does not provide fields to upload a cover image, define custom reading times, or specify page-specific meta titles/descriptions. These database columns remain permanently unassigned or default to null.
   - In the Knowledge Base, the database column `priority` (for Drip-Feed queues) is not exposed in the editor UI, preventing admins from adjusting item priorities.

6. **Bypassing Granular RBAC Permissions**:
   - Smmplan features a custom RBAC permissions grid (managed via `requireStaffPermission`) where staff roles can be granted view or edit rights to specific sections (e.g., `pages`).
   - However, CMS server actions (`src/actions/admin/content.ts`) explicitly enforce roles using `enforcePageRole(["ADMIN", "OWNER"])`. 
   - This prevents staff members (e.g. managers or content operators) from editing or publishing articles, even if their assigned staff role is configured with write permissions.

---

## 3. Caveats

- We did not verify the behavior of payment gateways or mail providers with empty keys, but since the keys are reset to empty strings/defaults when forms are partially submitted, they are guaranteed to fail in production.
- We did not verify all custom validators in the database seed files, assuming they match the database schema.

---

## 4. Conclusion

The Settings, Marketing, Knowledge Base, CMS, and Analytics modules contain several critical flaws that will cause severe regressions in production if left unaddressed:
1. **Financial Integrity**: Promocode vouchers are credited at 1/100th of their intended value.
2. **System Availability**: Saving integrations or SMTP settings will immediately break site configuration by disabling maintenance mode and overwriting core branding.
3. **SEO Strategy**: Crawlers will flag duplicate pages on `/p/[slug]` vs `/legal/[slug]` or `/academy/[slug]`, and Schema.org metadata formatting warnings will occur.
4. **RBAC Control**: Custom roles assigned to staff members for CMS/content publishing will have no effect, locking out operators from content updates.

---

## 5. Verification Method

### Step 1: Run the Automated Unit Tests
Run the following commands to verify that existing unit tests execute cleanly and validate content actions:
```powershell
# Run the knowledge base test suite
npx vitest run src/actions/__tests__/knowledge.test.ts

# Run the marketing service test suite
npx vitest run src/services/marketing.service.test.ts
```

### Step 2: Inspect Specific Files
Verify the logic by inspecting the following source lines:
1. **Settings Overwrite**: Check `src/actions/admin/settings.ts` lines 64-122 and verify how `globalSettingsSchema` defaults overwrite the database values.
2. **Promo Code Amount**: Check `src/actions/admin/marketing.ts` lines 68-73 and note that `amount` is passed without multiplication by 100, while `budget` is multiplied.
3. **Date Schema**: Check `src/app/knowledge/[slug]/page.tsx` line 246-247 and verify the use of `.toString()` instead of `.toISOString()`.
4. **RBAC Guard Bypass**: Check `src/actions/admin/content.ts` and verify that `enforcePageRole(["ADMIN", "OWNER"])` is called instead of `requireStaffPermission`.
