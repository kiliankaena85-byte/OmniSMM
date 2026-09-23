# COMPREHENSIVE VISUAL & UX AUDIT REPORT — SMMPLAN

## 1. SUMMARY
During the frontend visual and UX audit, we evaluated the desktop and mobile views of the Client Dashboard, Add Funds page, and New Order workflow. The overall system aesthetics are highly professional, modern, and utilize clean tones, but several critical UX blockers and visual flaws were discovered that negatively impact user onboarding and accessibility.

### Issues by Category:
* **Technical Error / Functional Blockers**: 1
* **Data Leak**: 0 (No sensitive details like providerCost or internal APIs were leaked in the HTML/DOM/Console)
* **UX Friction**: 2
* **Visual / Layout Bug**: 2

---

## 2. FINDINGS

### V-001: URL Auto-Detection Failure & Missing Manual Platform Selector
* **Page / URL**: `/dashboard/new-order`
* **Severity**: **CRITICAL**
* **Lense violated**: Client Lens & Business Lens
* **User Impact**: 
  When pasting or typing a completely valid, standard social link (such as `https://t.me/durov` or `t.me/durov`), the system completely fails to auto-detect the service platform. The placeholder states *"Вставьте ссылку, например t.me/channel"*, yet entering matching patterns fails to trigger any tariff options or platform categorization.
  Furthermore, the system displays a text prompt instructing the user to *"выберите нужную платформу вручную"* (choose the required platform manually), but **there is no manual platform selector dropdown or grid of buttons rendered anywhere in the interface**. This completely blocks the user from proceeding with order creation.

---

### V-002: Visual Asymmetry / Missing Action Button in "ПОТРАЧЕНО" Card
* **Page / URL**: `/dashboard`
* **Severity**: **LOW**
* **Lense violated**: Marketing Lens (Visual Polish)
* **User Impact**: 
  The primary metrics display grid contains four structurally identical cards: "БАЛАНС", "ПОТРАЧЕНО", "В РАБОТЕ", and "РЕФЕРАЛЫ". However, the "ПОТРАЧЕНО" card is the only card lacking a primary CTA button at the bottom (instead displaying only standard footer text "за всё время"). This causes a mismatched height alignment and visual asymmetry in the grid.

---

### V-003: Accessibility Violation - Low Color Contrast on Buttons
* **Page / URL**: `/dashboard/add-funds`
* **Severity**: **MEDIUM**
* **Lense violated**: Client Lens & Accessibility
* **User Impact**: 
  Action buttons such as the primary submit button *"Оплатить 1 000 ₽"* and the promocode action *"Применить"* utilize white or light pastel green text on extremely light sage/mint green backgrounds. This very low color contrast violates standard WCAG accessibility rules, making buttons illegible or hard to distinguish for visually impaired users.

---

### V-004: Broken Horizontal Layout / Indentation of Legal Consent Checkbox
* **Page / URL**: `/dashboard/add-funds`
* **Severity**: **LOW**
* **Lense violated**: Client Lens (Visual Quality)
* **User Impact**: 
  The checkbox container for the payment legal consent (*"Я подтверждаю заказ и соглашаюсь..."*) suffers from broken layout spacing. The checkbox element is pushed far to the left margin, leaving an excessive, unnatural whitespace gap of several hundred pixels before the label text starts. This makes the checkbox look detached from its label.

---

### V-005: Mobile Layout Overlay / Floating Theme Switcher Overlaps Navigation
* **Page / URL**: All Pages on mobile viewport (`375×812`)
* **Severity**: **HIGH**
* **Lense violated**: Client Lens & Business Lens (Conversion Rate)
* **User Impact**: 
  When viewing Smmplan on a mobile device, the persistent floating theme switcher and accent color selection widget in the bottom-left corner of the screen renders directly over the bottom navigation bar. It completely covers the primary navigation buttons for *"Главная"* and *"Новый заказ"*, rendering them untappable and breaking mobile navigation entirely.

---

## 3. TOP-5 CRITICAL FIXES (IMMEDIATE ACTION REQUIRED)
1. **Fix URL Platform Detection & Fallback manual grid (V-001)**: Fix the regex/matching logic for `t.me/` links to automatically resolve to the Telegram platform, and render a manual list of platform buttons (Telegram, VK, Instagram, etc.) so users can bypass auto-detection if it fails.
2. **Resolve Theme Switcher Collision on Mobile (V-005)**: Reposition the floating theme-switching bar (or hide it inside settings) on mobile views so it does not collide with or block the sticky bottom navigation bar.
3. **Contrast Adjustments for Primary Buttons (V-003)**: Increase text/background contrast on mint-green buttons (e.g. use dark text on light backgrounds or a darker primary background with white text).
4. **Repair Checkbox Padding (V-004)**: Clean up CSS classes or container flex styles surrounding the checkbox in the Add Funds form to remove the wide margin gap.
5. **Add CTA or Align metrics grid cards (V-002)**: Add a button to the "ПОТРАЧЕНО" card (e.g., "История расходов") or balance out the card structures so they align perfectly.

---

## 4. POSITIVE HIGHLIGHTS
* **Instant Auto-Login Response**: The development bypass auto-login functions seamlessly, taking the user directly to the dashboard page within milliseconds.
* **Modern & Clean Aesthetics**: The application of Tailwind and HeroUI colors creates a very pleasant look and feel. Hover states and navigation transitions are smooth.
* **Zero Security Leaks in DOM**: A strict check of console outputs, HTML source, and response headers revealed no raw leaks of provider API costs, internal admin privileges, or DB details.
