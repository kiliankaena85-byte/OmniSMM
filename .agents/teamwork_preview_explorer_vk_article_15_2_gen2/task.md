# Task: Recommend fix strategy for VK Article 15

## Failure Output
The previous iteration failed the Reviewer gate.
Reviewer 2 gave a REQUEST_CHANGES verdict with the following feedback:

### Finding 1: AI Water violation
- What: The text contains significant amounts of generic "AI water" and cliches.
- Where: Throughout the text, e.g., line 23 ("Один из ключевых рисков при запуске любой кампании"), line 43 ("Успешное привлечение первичной аудитории — это лишь первый шаг").
- Why: Violates the explicit constraint "No 'AI water'".
- Suggestion: Rewrite the text to be direct, punchy, and professional. Eliminate generic introductory fluff and jump straight to the technical mechanics and SEO facts.

### Challenge 1: Unrealistic SEO claims (Adversarial Critic)
- Assumption challenged: The article assumes that simple subscriber count ("накрутка") acts as a direct catalyst for SEO in Yandex/Google.
- Attack scenario: Search engines rely heavily on behavioral factors (CTR, bounce rate, dwell time). Fake subscribers do not interact with content. An inflated subscriber count without proportional activity might actually signal low quality to search engines, failing to yield any SEO benefit.
- Mitigation: The text should clarify that subscriber count provides an *initial trust signal* or "social proof" that encourages *real* users to click and stay, which in turn improves behavioral SEO factors. It should not claim that bots alone improve Yandex/Google ranking.

## Instructions
Read the current article at `d:\SMM_plan_2\src\data\knowledge\vk_group_seo_yandex_google.md`.
Recommend a concrete fix strategy for the Worker. Specify exactly which paragraphs to rewrite to remove the remaining AI water, and how to insert the behavioral factors clarification.
Write your fix strategy to `handoff.md`. Send a message when done.
