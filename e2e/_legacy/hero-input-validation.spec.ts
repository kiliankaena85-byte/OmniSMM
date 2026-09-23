import { test, expect } from "@playwright/test";

test.describe("HeroInput Bar & URL Validation Suite", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    // Suppress Next.js dev overlay if present
    await page.goto("/");
    await page.addStyleTag({ content: "nextjs-portal, #nextjs-dev-overlay { display: none !important; }" });
    await page.waitForLoadState("domcontentloaded");
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 1. DESKTOP PHYSICAL INPUT & INTERACTIVE UX TESTS
  // ═════════════════════════════════════════════════════════════════════════
  test.describe("🖥️ Desktop Viewport (1920x1080)", () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test("1.1 Empty input submit triggers validation toast and re-focuses input field", async ({ page }) => {
      const input = page.locator("#landing-url");
      await expect(input).toBeVisible();
      await input.clear();

      const showTariffsBtn = page.getByRole("button", { name: /Показать тарифы/i });
      await expect(showTariffsBtn).toBeVisible();
      await showTariffsBtn.click();

      // Toast error should appear
      const toastMsg = page.getByText("Пожалуйста, введите ссылку для продолжения.");
      await expect(toastMsg).toBeVisible({ timeout: 5000 });

      // Input should be focused
      await expect(input).toBeFocused();
    });

    test("1.2 Physical typing + Enter key triggers normalization and navigation", async ({ page }) => {
      const input = page.locator("#landing-url");
      await expect(input).toBeVisible();

      // Type handle without protocol
      await input.fill("t.me/durov");
      await input.press("Enter");

      // On Enter / blur, should normalize
      await input.blur();
      await expect(input).toHaveValue("https://t.me/durov");
    });

    test("1.3 Pasting tracking-heavy URL strips UTM and IGSH garbage with success toast", async ({ page }) => {
      const input = page.locator("#landing-url");
      await expect(input).toBeVisible();
      await input.focus();

      // Dispatch realistic paste event with UTM and IGSH query params
      const dirtyUrl = "https://t.me/durov?utm_source=telegram&igsh=xyz987&fbclid=12345&si=abc";
      await page.evaluate((val) => {
        const el = document.getElementById("landing-url");
        if (el) {
          const dt = new DataTransfer();
          dt.setData("text/plain", val);
          const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: dt,
          });
          el.dispatchEvent(pasteEvent);
        }
      }, dirtyUrl);

      // Verify that query params were completely stripped
      await expect(input).toHaveValue("https://t.me/durov");

      // Verify normalization feedback toast
      const toast = page.getByText("Ссылка очищена и нормализована!");
      await expect(toast).toBeVisible({ timeout: 5000 });
    });

    test("1.4 Accidental Email input shows interactive detection card with quick-save", async ({ page }) => {
      const input = page.locator("#landing-url");
      await expect(input).toBeVisible();

      await input.fill("test-user@smmplan.pro");

      // Detection card should animate in
      const banner = page.getByText("Похоже, вы ввели email-адрес");
      await expect(banner).toBeVisible({ timeout: 4000 });

      // Click "Да, запомнить"
      const saveBtn = page.getByRole("button", { name: "Да, запомнить" });
      await expect(saveBtn).toBeVisible();
      await saveBtn.click();

      // URL input should be cleared for link entry
      await expect(input).toHaveValue("");

      // Success feedback toast
      const successToast = page.getByText(/Мы сохранили ваш Email/i);
      await expect(successToast).toBeVisible({ timeout: 5000 });
    });

    test("1.5 Interactive Step Guide updates dynamically as URL is entered", async ({ page }) => {
      const input = page.locator("#landing-url");
      await expect(input).toBeVisible();

      // Initially Step 1 shows '1'
      await input.fill("");
      const step1Number = page.locator("div:has-text('Шаг 1')").first();
      await expect(step1Number).toBeVisible();

      // Type valid URL
      await input.fill("https://t.me/durov");
      await input.blur();

      // Step 1 should now indicate completion (checkmark)
      await expect(page.locator("text=✓").first()).toBeVisible();
    });

    test("1.6 Visual Link Guide Drawer opens and displays multi-platform instructions", async ({ page }) => {
      const guideBtn = page.getByRole("button", { name: /Как правильно скопировать ссылку/i });
      await expect(guideBtn).toBeVisible();
      await guideBtn.click();

      // Drawer modal should appear
      const modalHeader = page.getByText("Как скопировать ссылку?");
      await expect(modalHeader).toBeVisible({ timeout: 5000 });

      // Check that platform tabs exist (Telegram, Instagram, VK, etc.)
      const tgTab = page.getByRole("button", { name: /Telegram/i }).first();
      await expect(tgTab).toBeVisible();

      // Close drawer
      const closeBtn = page.locator("button[aria-label='Закрыть инструкцию']").first();
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await expect(modalHeader).toBeHidden();
    });

    test("1.7 XSS and malicious script payloads are rendered safely as plaintext", async ({ page }) => {
      const input = page.locator("#landing-url");
      await expect(input).toBeVisible();

      let dialogTriggered = false;
      page.on("dialog", (dialog) => {
        dialogTriggered = true;
        dialog.dismiss();
      });

      await input.fill("<script>alert('XSS')</script>");
      await input.press("Enter");

      // Verify no JS dialog was executed
      expect(dialogTriggered).toBe(false);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 2. MOBILE VIEWPORT & TOUCH INTERACTION TESTS (MobileWizard)
  // ═════════════════════════════════════════════════════════════════════════
  test.describe("📱 Mobile Viewport (iPhone 14 - 390x844)", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("2.1 Mobile layout fits viewport without horizontal overflow and maintains >=44px touch targets", async ({ page }) => {
      const mobileInput = page.locator("#standard-url-input");
      await expect(mobileInput).toBeVisible();

      // Verify touch target dimensions >= 44px
      const inputBBox = await mobileInput.boundingBox();
      expect(inputBBox).not.toBeNull();
      expect(inputBBox!.height).toBeGreaterThanOrEqual(44);

      // Verify no horizontal page overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(overflow).toBe(false);
    });

    test("2.2 Mobile step-by-step wizard seamlessly validates and collapses Step 1 on valid URL input", async ({ page }) => {
      const mobileInput = page.locator("#standard-url-input");
      await expect(mobileInput).toBeVisible();

      await mobileInput.fill("https://t.me/durov");

      // Step 1 collapses into a completed summary card
      const step1Summary = page.locator("button:has-text('1. Ссылка на канал / пост')");
      await expect(step1Summary).toBeVisible({ timeout: 5000 });
      await expect(step1Summary).toContainText("https://t.me/durov");

      // Tapping the completed card re-opens Step 1
      await step1Summary.click();
      await expect(mobileInput).toBeVisible({ timeout: 5000 });
    });
  });
});
