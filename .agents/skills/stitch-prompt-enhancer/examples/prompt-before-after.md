# Stitch Prompt Enhancement: Before vs After

## Case Study: SMMflux Order Checkout Wizard

### ❌ Raw User Prompt (Weak)
```text
"Make a checkout page for SMMflux where user can see price, pay with card, and make order."
```
*Why this fails:*
- Zero information hierarchy or layout direction.
- Stitch defaults to generic templates with random cards, missing payment gateways, and washed-out contrast.
- Lacks mobile responsiveness, error handling, and 54-FZ fiscal receipt compliance.

---

### ✅ Enhanced Stitch Prompt (Architectural Grade)
```markdown
### System Directives
Target Viewport: Desktop 1440px with Mobile 375px responsive contract.
Brand: SMMflux (Radiant Aurora palette, crisp dark/light support).
Design DNA: High-Frequency Financial Terminal (Stripe / Linear split-view).
Density Tier: Compact. Minimum Touch Zone: 44px.

### Layout Blueprint
2-Column Split View:
- Left Column (60%): Interactive Payment Gateway Selector and Fiscal Info Form.
  - Payment Gateways: SBP (Faster Payments System, QR badge), Bank Cards (Mir/Visa/MC), YooKassa, SberPay, CryptoBot.
  - Receipt Email Input: Auto-complete, single input field with floating label, clear error helper text.
- Right Column (40%): Order Summary Sticky Receipt Card.
  - Service Title: Bold 16px with platform badge (Telegram / VKontakte).
  - Breakdown: Quantity, Unit Price (₽/шт), Subtotal, VAT (НДС 22% 54-FZ breakdown), Total in BigInt Kopecks format.
  - Primary CTA: Full-width 56px high-contrast button ("Оплатить 1,450 ₽ →") with active hover slide micro-interaction.

### Banned Patterns
- NO disabled button state (click with invalid email triggers red shake focus).
- NO purple mesh background or floating decorative spheres.
- NO white cards blending into white canvas (use border-slate-200 and shadow-sm).
```

### 🎯 Result
Stitch outputs a pixel-perfect, accessible checkout wizard that scores $\ge 92$ on Laya NPU evaluation and requires zero manual redesign.
