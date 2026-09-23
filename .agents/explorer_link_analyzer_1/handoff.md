# Handoff Report: Telegram Private Post Parsing

## 1. Observation

In `src/services/analyzer/link-rules.ts`, the current rules for Telegram are:

```typescript
  // ===================== TELEGRAM =====================
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'post',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/[\w-]+\/(?:s\/)?(\d+)\/?(?:\?.*)?$/i,
      suggestedCategories: [CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.REACTIONS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.STARS],
      context: 'engagement'
  },
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'bot',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/(?:[\w-]+bot|[\w-]+_bot)\/?(?:\?.*)?$/i,
      suggestedCategories: [CATEGORY_LABELS.BOTS, CATEGORY_LABELS.REFERRALS, CATEGORY_LABELS.SUBSCRIBERS],
      context: 'automation'
  },
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'channel',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/(?:joinchat\/|\+)?(?:s\/)?@?([\w-]+)\/?(?:\?.*)?$|web\.telegram\.org\/(?:k|a)\/#@?([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.PREMIUM, CATEGORY_LABELS.BOOSTS, CATEGORY_LABELS.GROUPS, CATEGORY_LABELS.STORIES, CATEGORY_LABELS.STARS, CATEGORY_LABELS.AUTO_VIEWS, CATEGORY_LABELS.AUTO_REACTIONS, CATEGORY_LABELS.AUTO_REPOSTS],
      context: 'global_search_optimization'
  },
```

And the fallback rule is:

```typescript
  // ===================== FALLBACK WEBSITE =====================
  {
      platform: IntelligencePlatform.WEBSITE,
      type: 'seo_traffic',
      pattern: /^https?:\/\/[^/\s]+\.[a-z]{2,}/i,
      suggestedCategories: [CATEGORY_LABELS.TRAFFIC],
      context: 'seo_authority'
  },
```

In `src/services/analyzer/link-analyzer.ts`, the `match(url: string)` function iterates through rules:

```typescript
    private match(url: string): IntelligenceAnalysisResult {
        const decodedUrl = url.replace(/%40/g, '@');
        for (const rule of LINK_RULES) {
            const match = decodedUrl.match(rule.pattern);
            if (match) {
                return {
                    platform: rule.platform,
                    type: rule.type,
                    id: match[1] || match[2] || match[3] || 'unknown',
                    canonicalUrl: decodedUrl,
                    metadata: {
                        isLive: decodedUrl.includes('/live/') || decodedUrl.includes('/reel/'),
                        context: rule.context
                    },
                    suggestedCategories: rule.suggestedCategories,
                    warnings: []
                };
            }
        }
```

---

## 2. Logic Chain

1. **Step 1**: The private post URL `https://t.me/c/2341882599/1046` is sanitized and resolved to `https://t.me/c/2341882599/1046`.
2. **Step 2**: The matching logic tests the URL against the first Telegram rule (public post):
   - The regex is `/(?:t\.me|telegram\.me|telegram\.dog)\/[\w-]+\/(?:s\/)?(\d+)\/?(?:\?.*)?$/i`.
   - `[\w-]+` matches `c`.
   - `(\d+)` matches `2341882599`.
   - However, the end of the string anchors (`(?:\?.*)?$`) prevent matching because there is `/1046` remaining.
   - Thus, the public post rule does not match.
3. **Step 3**: The matching logic tests the URL against the bot rule, which fails because the URL lacks `bot`/`_bot`.
4. **Step 4**: The matching logic tests the URL against the channel rule:
   - The regex is `/(?:t\.me|telegram\.me|telegram\.dog)\/(?:joinchat\/|\+)?(?:s\/)?@?([\w-]+)\/?(?:\?.*)?$|.../i`.
   - `([\w-]+)` matches `c`.
   - The trailing patterns fail to match the rest of the URL (`/2341882599/1046`).
   - Thus, the channel rule does not match.
5. **Step 5**: The matching logic continues to the fallback `WEBSITE` rule:
   - The pattern `^https?:\/\/[^/\s]+\.[a-z]{2,}` matches `https://t.me/`.
   - The match is successful.
6. **Conclusion**: The URL is classified under `IntelligencePlatform.WEBSITE` (type: `'seo_traffic'`, id: `'unknown'`) instead of `IntelligencePlatform.TELEGRAM` (type: `'post'`, id: `'1046'`).

---

## 3. Caveats

* **Assumptions**: We assume the private post URL format follows the standard Telegram private post schema: `t.me/c/CHANNEL_ID/POST_ID` or optionally `t.me/c/CHANNEL_ID/TOPIC_ID/POST_ID`.
* **Scope**: Since this is a read-only investigation, the recommended changes were not applied to the codebase.

---

## 4. Conclusion

The private Telegram post link `https://t.me/c/2341882599/1046` is currently misclassified as a generic `WEBSITE` link with an `unknown` ID. 

**Actionable Recommendation**:
Insert a new rule object in `LINK_RULES` under `src/services/analyzer/link-rules.ts` using the pattern:
`/(?:t\.me|telegram\.me|telegram\.dog)\/c\/(?:\d+)\/(?:(?:\d+)\/)?(\d+)\/?(?:\?.*)?$/i`

This correctly extracts the message/post ID as `match[1]` and assigns it as the link identifier, classifying the link under the `TELEGRAM` platform as a `'post'`.

---

## 5. Verification Method

1. Add the proposed tests from `analysis.md` to `src/services/analyzer/link-analyzer.test.ts`.
2. Run the vitest unit test suite command:
   ```bash
   npx vitest run src/services/analyzer/link-analyzer.test.ts
   ```
3. Verify that the current behavior test passes, and after implementing the proposed fix, the new behavior tests pass.
