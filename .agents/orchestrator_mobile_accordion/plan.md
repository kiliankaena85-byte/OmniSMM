# Implementation Plan — Mobile Order Wizard Redesign (Collapsible Accordion-Wizard Flow)

This document describes the plan for redesigning the mobile order wizard in [MobileWizard.tsx](file:///d:/SMM_plan_2/src/components/landing/order-engine/MobileWizard.tsx) to implement a progressive collapsible accordion-wizard flow, and aligning the visual regression tests in [visual-regression.spec.ts](file:///d:/SMM_plan_2/e2e/visual-regression.spec.ts).

## User Review Required

- **Active Step State**: We introduce a state `activeStep` (1, 2, 3, or 4) to track which step is expanded. 
- **Step Auto-Collapse**: Step 1 collapses and advances only when a link resolves to valid categories. We use a `lastResolvedUrl` state to avoid immediate auto-collapsing when the user clicks "Изменить" on Step 1 while the url input is already valid.
- **Progressive Disclosure**:
  - By default (Step 1), only Step 1 input, "Где взять ссылку?" guide, and "Выбрать из каталога вручную" buttons are visible.
  - Step 2 shows only categories list.
  - Step 3 shows only tariffs/services cards, and a back button to Step 2.
  - Step 4 shows parameters (quantity, email, promo, checkboxes, total price, checkout button), and a back button (either to Step 3 or to manual catalog depending on URL input state).
- **Test Integrity**: The Visual Regression E2E mobile test must be adjusted because it previously assumed all fields were visible on screen. It will now click "Изменить" on Step 1 before filling the link validation warning trigger.

---

## 🛡️ Премортем-анализ (Failure Simulation)

We conduct a pre-mortem analysis to foresee possible system failures and plan corresponding software safeguards.

| Scenario | Risk Score (P×I) | Programmatic Safeguard |
|---|---|---|
| **S1: Instant Auto-Collapse Loop**. User clicks "Изменить" on Step 1. The input already contains a valid URL. Without a tracking variable, the component immediately transitions back to Step 2, preventing the user from ever editing the URL. | High (P=5, I=5) | Implement `lastResolvedUrl` state. We only trigger auto-advance from Step 1 to Step 2 if `url !== lastResolvedUrl` (meaning the user has edited the link and it has resolved again). |
| **S2: Mismatch between Manual Catalog & Accordion Steps**. User chooses a service manually from the catalog. The engine populates `categoryId` and `selectedService`, but the link is not yet filled. The active step remains Step 1, but Step 2 and Step 3 are already solved. When the user finally fills the link, it might skip Step 2 and 3 and go straight to Step 4, or get stuck in Step 2. | Medium (P=3, I=4) | In our auto-advance handler, if a valid link resolves, we check if `selectedService` is already set. If yes, we transition directly to `activeStep = 4`. If only `categoryId` is set, we transition to `activeStep = 3`. Otherwise, we fall back to `activeStep = 2`. |
| **S3: Playwright Test Timeout**. The Playwright test fails because it attempts to fill `input#standard-url-input` when Step 1 is collapsed and the input is no longer present in the DOM. | High (P=5, I=5) | Modify [visual-regression.spec.ts](file:///d:/SMM_plan_2/e2e/visual-regression.spec.ts) to locate and click the Step 1 collapsed summary card (labeled "Ссылка:") to expand Step 1 before filling the warning trigger link (`https://t.me/durov/12`). |
| **S4: Missing/Hardcoded Colors in Summary Cards**. Collapsed summary cards are added with hardcoded styles like `bg-white` or `text-blue-500`, violating the design system and failing the visual audit. | Medium (P=3, I=4) | Use only semantic tokens from [globals.css](file:///d:/SMM_plan_2/src/app/globals.css) (such as `bg-content2`, `border-border/40`, `text-foreground/80`, `text-primary`) for the summary cards. |

---

## Proposed Changes

### 1. Refactoring [MobileWizard.tsx](file:///d:/SMM_plan_2/src/components/landing/order-engine/MobileWizard.tsx)

- Add state variables:
  ```typescript
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [lastResolvedUrl, setLastResolvedUrl] = useState<string>("");
  ```
- Add a `useEffect` hook to handle auto-collapse of Step 1:
  ```typescript
  useEffect(() => {
    const isLinkValid = url.trim().length >= 5 && availableCategories.length > 0 && !isLoading && !validationErrors?.link && !localUrlError;
    if (isLinkValid && url !== lastResolvedUrl) {
      setLastResolvedUrl(url);
      if (selectedService) {
        setActiveStep(4);
      } else if (categoryId) {
        setActiveStep(3);
      } else {
        setActiveStep(2);
      }
    }
  }, [url, availableCategories, isLoading, validationErrors, localUrlError, lastResolvedUrl, selectedService, categoryId]);
  ```
- Redesign the rendering structure into 4 accordion panels:
  - **Step 1 (Link Entry)**:
    - If `activeStep === 1`: Render standard url input field, guide, and manual catalog button.
    - If `activeStep !== 1` and link is valid: Render a collapsed card `🔗 Ссылка: ${url_without_protocol} [Изменить]` with `min-h-[44px]` (WCAG 2.2 AA compliant touch target) which calls `setActiveStep(1)` on click.
  - **Step 2 (Category Selection)**:
    - If `activeStep === 2`: Render available categories list. Add custom click handler on category buttons:
      ```typescript
      onClick={() => {
        setCategoryId(cat.id);
        setActiveStep(3);
      }}
      ```
    - If `activeStep !== 2` and `categoryId` is set: Render collapsed card `📁 Категория: ${selectedCategoryName} [Изменить]` which calls `setActiveStep(2)` on click.
  - **Step 3 (Service Tariff Selection)**:
    - If `activeStep === 3`: Render service list. Add back button `← Назад к выбору категории` (`onClick={() => setActiveStep(2)}`). Add custom select handler on `TariffCard`:
      ```typescript
      onSelect={(srv) => {
        setSelectedService(srv);
        setActiveStep(4);
      }}
      ```
    - If `activeStep !== 3` and `selectedService` is set: Render collapsed card `⚡ Тариф: ${selectedService.name} (${selectedService.pricePerUnitRub} ₽ / шт) [Изменить]` which calls `setActiveStep(3)` on click.
  - **Step 4 (Checkout Parameters)**:
    - If `activeStep === 4`: Render quantity, email, promo inputs, warnings, legal checkbox, price display, checkout button.
    - Add back button at the top:
      - If `url.trim().length < 5` (manual catalog selection): `← Назад к каталогу` which triggers `onOpenCatalog`.
      - Otherwise: `← Назад к выбору тарифа` which triggers `setActiveStep(3)`.

### 2. Updating [visual-regression.spec.ts](file:///d:/SMM_plan_2/e2e/visual-regression.spec.ts)

- Locate the test case `test('9. Mobile UX Warning Block and Validation Checkbox', async ({ browser }) => { ... })` at line 414.
- In section 5 of the test, right before filling the post link `https://t.me/durov/12` to trigger the warning, click the Step 1 collapsed card to expand it:
  ```typescript
  // Click "Изменить" on the collapsed Step 1 to expand it
  const changeLinkBtn = mobilePage.locator('button:has-text("Ссылка:")').first();
  await changeLinkBtn.click();
  await mobilePage.waitForTimeout(500);

  // Вводим ссылку на пост для провоцирования ошибки валидации
  await urlInput.fill('https://t.me/durov/12');
  await mobilePage.waitForTimeout(2000);
  ```

---

## Verification Plan

We will perform automated checks to verify the implementation. Since the orchestrator is forbidden from executing direct commands, these steps will be delegated to subagents.

1. **TypeScript compilation check**:
   Run `npx tsc --noEmit` to ensure there are no compilation or type errors.
2. **ESLint linting check**:
   Run `npm run lint` to ensure there are no code style or layout violations.
3. **Playwright test suite**:
   Run `npm run test:visual` to execute all visual regression specs and verify that the updated mobile test `9. Mobile UX Warning Block and Validation Checkbox` passes successfully.
