# Link Analyzer Investigation: Private Telegram Post Parsing

## Executive Summary
This report analyzes the parsing and classification behavior of the URL `https://t.me/c/2341882599/1046` in SMMplan's link-analyzer. We explain why it currently fails to match Telegram rules, how it is incorrectly classified under the fallback `WEBSITE` rules, suggest unit tests, and recommend a robust solution using a new regex and rule object.

---

## 1. Trace Analysis of `https://t.me/c/2341882599/1046`

When `IntelligenceLinkAnalyzer.analyze('https://t.me/c/2341882599/1046')` is called, it processes the URL through the following pipeline:

### A. Sanitization Phase (`sanitize`)
1. The URL does not match a plain handle structure (it contains slashes and a dot).
2. The URL extraction pattern matches `https://t.me/c/2341882599/1046`.
3. Trailing spaces, query params, and punctuation are stripped (none affect this URL).
4. Since it does not start with `@`, no prefixing is done.
5. The parsed URL is converted using the `URL` constructor and returned: `https://t.me/c/2341882599/1046`.

### B. Resolution Phase (`resolve`)
Since the URL domain `t.me` is not in the list of short domains (`['bit.ly', 'youtu.be', 'vm.tiktok.com', 't.co', 'cutt.ly']`), it bypasses resolution and returns the URL as-is.

### C. Normalization Phase (`normalizeVkUrl`)
The domain is not a VK domain, so the URL remains unchanged: `https://t.me/c/2341882599/1046`.

### D. Matching Phase (`match`)
The analyzer iterates over `LINK_RULES` in `src/services/analyzer/link-rules.ts`. We trace the URL against the current Telegram rules:

#### Telegram Rule 1 (Public Post):
* **Pattern**: `/(?:t\.me|telegram\.me|telegram\.dog)\/[\w-]+\/(?:s\/)?(\d+)\/?(?:\?.*)?$/i`
* **Tracing**:
  - `(?:t\.me|telegram\.me|telegram\.dog)` matches `t.me`
  - `\/` matches `/`
  - `[\w-]+` matches `c` (characters up to the next slash)
  - `\/` matches `/`
  - `(?:s\/)?` matches nothing (optional)
  - `(\d+)` matches `2341882599` (Group 1 capture)
  - `\/?(?:\?.*)?$` matches a trailing slash, optional query params, and the end of the string.
  - **Failure**: The URL has `/1046` after `2341882599`. Since the pattern demands the captured digits to be followed only by an optional slash and query params before the end of the string (`$`), the match fails.

#### Telegram Rule 2 (Bot):
* **Pattern**: `/(?:t\.me|telegram\.me|telegram\.dog)\/(?:[\w-]+bot|[\w-]+_bot)\/?(?:\?.*)?$/i`
* **Failure**: The URL does not contain `bot` or `_bot`, so it fails to match.

#### Telegram Rule 3 (Channel):
* **Pattern**: `/(?:t\.me|telegram\.me|telegram\.dog)\/(?:joinchat\/|\+)?(?:s\/)?@?([\w-]+)\/?(?:\?.*)?$|web\.telegram\.org\/(?:k|a)\/#@?([\w-]+)/i`
* **Tracing (First Branch)**:
  - `(?:t\.me|telegram\.me|telegram\.dog)\/` matches `t.me/`
  - `([\w-]+)` matches `c`
  - `\/?(?:\?.*)?$` demands the end of string. Since we have `/2341882599/1046` after `c`, it fails.
* **Tracing (Second Branch)**: Does not match `web.telegram.org`.
* **Failure**: The match fails.

---

### E. Fallback Match (`WEBSITE`)
Since none of the Telegram rules match, the iteration continues and hits the first fallback rule:
```typescript
  {
      platform: IntelligencePlatform.WEBSITE,
      type: 'seo_traffic',
      pattern: /^https?:\/\/[^/\s]+\.[a-z]{2,}/i,
      suggestedCategories: [CATEGORY_LABELS.TRAFFIC],
      context: 'seo_authority'
  }
```
* **Tracing**:
  - `^https?:\/\/` matches `https://`
  - `[^/\s]+\.[a-z]{2,}` matches `t.me`
* **Outcome**: The rule matches. The `match` method returns:
  - **Platform**: `IntelligencePlatform.WEBSITE` (instead of `TELEGRAM`)
  - **Type**: `'seo_traffic'` (instead of `'post'`)
  - **ID**: `'unknown'` (since there are no capturing groups in the website pattern)
  - **Canonical URL**: `https://t.me/c/2341882599/1046`
  - **Suggested Categories**: `['traffic']` (instead of engagement categories like Views/Reactions/Comments)
  - **Warnings**: `[]`

This causes incorrect category suggestions (Traffic instead of Views/Reactions) and misclassifies the link platform, which breaks the Order Wizard auto-selection.

---

## 2. Proposed Vitest Unit Tests

To verify this behavior, we can write a test case in `src/services/analyzer/link-analyzer.test.ts`.

### A. Test for Current Behavior (Verifies Bug)
```typescript
        it('analyzes private Telegram post links (currently incorrectly classified as WEBSITE)', async () => {
            const url = 'https://t.me/c/2341882599/1046';
            const res = await analyzer.analyze(url);
            
            expect(res.platform).toBe(IntelligencePlatform.WEBSITE);
            expect(res.type).toBe('seo_traffic');
            expect(res.id).toBe('unknown');
            expect(res.canonicalUrl).toBe(url);
        });
```

### B. Test for Corrected Behavior (Verifies Desired Output)
```typescript
        it('correctly classifies private Telegram post links', async () => {
            const url = 'https://t.me/c/2341882599/1046';
            const res = await analyzer.analyze(url);
            
            expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
            expect(res.type).toBe('post');
            expect(res.id).toBe('1046'); // Post ID extracted as ID
            expect(res.canonicalUrl).toBe(url);
            expect(res.suggestedCategories).toContain('Просмотры / Охват');
        });

        it('correctly classifies private Telegram post links with topics', async () => {
            const url = 'https://t.me/c/2341882599/22/1046';
            const res = await analyzer.analyze(url);
            
            expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
            expect(res.type).toBe('post');
            expect(res.id).toBe('1046');
        });
```

---

## 3. Formulated Recommendations

To support private Telegram posts, we need to introduce a new rule in `src/services/analyzer/link-rules.ts`.

### A. Recommended Regex Pattern
```typescript
/(?:t\.me|telegram\.me|telegram\.dog)\/c\/(?:\d+)\/(?:(?:\d+)\/)?(\d+)\/?(?:\?.*)?$/i
```

#### Detailed Breakdown:
1. `(?:t\.me|telegram\.me|telegram\.dog)`: Matches standard Telegram domains.
2. `\/c\/`: Matches `/c/` literally, which indicates private chats/channels in Telegram.
3. `(?:\d+)`: Non-capturing group for the channel ID (e.g. `2341882599`). Making this non-capturing prevents it from overriding the post ID in `match[1] || match[2]`.
4. `\/`: Matches the separator slash.
5. `(?:(?:\d+)\/)?`: Non-capturing optional group for topic IDs (e.g. `22/` in supergroup topic links), ensuring compatibility with private topic links.
6. `(\d+)`: Capturing group 1 for the message/post ID (e.g. `1046`). Since it is the first capturing group, the analyzer will correctly extract it as the entity ID (consistent with public posts).
7. `\/?(?:\?.*)?$`: Matches a trailing slash, optional query params, and the end of the string.

### B. New Rule Object
```typescript
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'post',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/c\/(?:\d+)\/(?:(?:\d+)\/)?(\d+)\/?(?:\?.*)?$/i,
      suggestedCategories: [
          CATEGORY_LABELS.VIEWS,
          CATEGORY_LABELS.REACTIONS,
          CATEGORY_LABELS.COMMENTS,
          CATEGORY_LABELS.REPOSTS,
          CATEGORY_LABELS.STARS
      ],
      context: 'engagement'
  }
```

### C. Suggested Placement
Place this new rule object directly in the `// ===================== TELEGRAM =====================` section of `LINK_RULES` in `src/services/analyzer/link-rules.ts`, preferably right after the public `post` rule. Since it is highly specific (demands `/c/` followed by digits), putting it in the Telegram section is optimal and avoids collision.
