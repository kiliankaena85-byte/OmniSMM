# Example: Basic Google Stitch Generative Session

This walkthrough demonstrates an end-to-end Stitch generation session for an SMMflux affiliate dashboard.

---

## 1. Initial Prompt from Developer
```markdown
User: "We need an affiliate referral widget for SMMflux where partners can see their 15% recurring commission, copy their referral link, and view recent payouts in a compact table. Avoid generic AI bento slop."
```

## 2. Agent Decision & Skill Selection
- Agent triggers `stitch-prompt-enhancer` to structure layout, tokens, and anti-slop rules.
- Design DNA: `High-Frequency Financial Terminal` (Linear / Bloomberg aesthetic).
- Target viewport: `desktop` (1440px) with responsive `mobile` (375px) constraint.

## 3. Stitch MCP Tool Call
```json
{
  "ServerName": "StitchMCP",
  "ToolName": "stitch_generate_screen",
  "Arguments": {
    "prompt": "Affiliate referral widget with 15% recurring rev-share, click-to-copy referral link card, 3 KPI metric tiles (Clicks, Conversions, Unpaid Balance), and 5-row compact payout history table with status badges.",
    "brand": "smmflux",
    "designDna": "High-Frequency Financial Terminal",
    "viewport": "desktop",
    "densityTier": "compact"
  }
}
```

## 4. Laya NPU Pruning & Selection
- Candidate A (Score: 68): Rejected — excessive purple mesh gradients.
- Candidate B (Score: 74): Rejected — table rows too spacious, padding > 16px.
- Candidate C (Score: 94): **APPROVED** — strict monospace numbers, subtle border dividers, instant copy feedback.

## 5. React 19 Component Output
Generated component in `src/components/affiliate/AffiliateWidget.tsx`:
- Clean client component with `useOptimistic` for copy link feedback.
- Typed `{ success: boolean, error?: string }` Server Action integration.
- Exactly 164 lines of code (well under the 200-line limit).
