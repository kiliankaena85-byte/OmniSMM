# Analysis: Outline strategy for VK Refill Guarantee article

## 1. Context & Constraints
- **Goal:** Provide a comprehensive outline for a >500 words article titled "Гарантия (Refill) на услуги ВК: как работает авто-докрутка при отписках."
- **Language:** Russian.
- **Tone/Style:** AI Marketer constraint - no "AI water". Must naturally integrate Smmplan mechanics: `TargetType` link validation, `Drip-Feed`, `PENDING_CHECK`, `PARTIAL`, `Refill`/Гарантия.

## 2. Structural Strategy
The article must bridge the pain point of SMM specialists (VK dropping followers) with Smmplan's technical solutions. It shouldn't sound like a generic text; it must use internal terminology effectively.

- **Introduction:** Acknowledge the problem of VK's aggressive anti-fraud and shadowbans. Introduce Refill as the technical safety net.
- **Section 1: The Initial Filter (`PENDING_CHECK` & `TargetType`)**: Explain how Smmplan minimizes drops before the order even starts. Validating the link ensures that followers go to a group (CHANNEL) and likes to a POST.
- **Section 2: Smooth Growth (`Drip-Feed`)**: Explain how to avoid the algorithms' attention in the first place. 
- **Section 3: The Drop Mechanism & Refill**: How Refill works when VK inevitably wipes some accounts. Mention the background workers (BullMQ).
- **Section 4: The `PARTIAL` Status**: What happens if an order cannot be fully fulfilled safely? Smmplan refunds the missing part.
- **Conclusion**: A summary of why Smmplan's architectural approach is superior for long-term VK promotion.

## 3. Recommended Key Points for the Outline

- The importance of proper `TargetType` validation during the `PENDING_CHECK` stage to prevent sending wrong traffic types to invalid entities, reducing drop risk.
- How `Drip-Feed` simulates organic engagement, effectively lowering the chance of triggering VK algorithms compared to bulk delivery.
- The lifecycle of an order: from `PENDING_CHECK` to `IN_PROGRESS` and then `COMPLETED` or `PARTIAL`.
- The Refill guarantee itself: how it can be triggered to restore dropped metrics back to the ordered amount without extra cost.
- How `PARTIAL` refunds protect the user's budget if a Refill or original order cannot be completed securely.

(End of analysis)
