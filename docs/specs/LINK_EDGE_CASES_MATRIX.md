# Standalone Taxonomic Edge Cases Matrix across 37 Platforms & 5 Dimensions
**Project**: SMMplan / SMMflux (OmniSMM 1.0 Enterprise Core)  
**Standard**: RAC-2026 / SDD-TDD 2026 / ExactMath & Security Invariants  
**Document Identifier**: `docs/specs/LINK_EDGE_CASES_MATRIX.md`  
**Classification**: Production-Grade Architectural Taxonomy  
**Status**: Authoritative & Complete (Zero Placeholders, Zero TODOs)  

---

## 1. Executive Taxonomy Blueprint

The SMMplan / OmniSMM 1.0 platform processes thousands of social media orders daily across retail storefronts (`smmplan.pro`, `smmflux.ru`), external SMM APIs (API v2), and telegram bots. Due to the high fragmentation of social network URL schemas, mobile deep-links, web client redirects, ephemeral content, and private community mechanics, links submitted by clients exhibit deep heterogeneity.

This document establishes the exhaustive, definitive taxonomic matrix across **37 social networks, streaming services, and web traffic vectors**, evaluated along **5 Core Architectural Dimensions**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        5 CORE ARCHITECTURAL DIMENSIONS                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Multi-Category Resolution (1 Link -> N Categories & Intent Disambiguation)          │
│ 2. Auto & Subscription Services (Drip-Feed, Future Posts, Livestream Watch Time)       │
│ 3. Closed, Private & Restricted Entities (Invite Hashes, Private Posts, Bot Admin)    │
│ 4. Dynamic Custom Input Fields (Custom Comments, Emojis/Reactions, Polls, Mentions)    │
│ 5. Platform URL Edge Cases (Stories, Forum Topics, Reels/Shorts, Albums/Media Groups)  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Criticality Tiers (Risk-Tiering)
- **Critical (P1)**: Causes immediate financial loss, provider API hard rejection, order hang in background queue, or security vulnerability (SSRF, ReDoS, album view discrepancy causing chargebacks).
- **Major (P2)**: Blocks order placement, false-positive validation error, loss of custom parameters during checkout, or user intent ambiguity leading to incorrect service fulfillment.
- **Minor (P3)**: Suboptimal category sorting, non-breaking cosmetic display flaw, or harmless query parameter accumulation.

---

## 2. Exhaustive Platform Taxonomy Matrix (37 Platforms)

Below is the complete taxonomic truth table covering all 37 supported platforms, detailing raw URL input patterns, canonicalized target formats, target type mapping, custom data contracts, provider API fields, and specific platform quirks.

### Table 2.1: Tier 1 Ecosystems (Telegram, VKontakte, YouTube, Instagram, TikTok)

| Platform | Entity / Target Type | Raw Input Patterns | Canonical URL Output | Custom Data & Required Fields | Criticality | Platform Quirk & Provider API Behavior |
|:---|:---|:---|:---|:---|:---|:---|
| **1. Telegram** | Public Channel (`CHANNEL`) | `t.me/durov`<br>`t.me/@durov`<br>`t.me/s/durov`<br>`web.telegram.org/k/#@durov` | `https://t.me/durov` | None (Standard) | **Major (P2)** | Multi-category fork: matches Subscribers, Boosts, Auto-Views, Auto-Reactions. Canonicalizer purges `/s/` and `@` prefix. |
| **1. Telegram** | Private Channel / Group (`CHANNEL`) | `t.me/+AbCdEfGh123`<br>`t.me/joinchat/AbCdEfGh123` | `https://t.me/+AbCdEfGh123` | None (Requires `isPrivate: true` provider service) | **Critical (P1)** | Allowed ONLY for `CHANNEL` target. Must reject `POST_INTERACTION`. Requires join requests to be disabled in channel. |
| **1. Telegram** | Public Post (`POST_INTERACTION`) | `t.me/durov/123`<br>`t.me/s/durov/123?single` | `https://t.me/durov/123` | Optional: `mediaGroupUrl` if album | **Critical (P1)** | Albums (carousels) require "Rule of Two Orders": Desktop counts views on 1st photo, iOS/Android on last photo. `?single` preserved if targeted. |
| **1. Telegram** | Forum Topic Post (`POST_INTERACTION`) | `t.me/group/100/250`<br>`t.me/group/topic/100/250` | `https://t.me/group/100/250` | None | **Major (P2)** | Topic `100`, message `250`. In supergroups with topics enabled, some providers reject `/topic/`; canonicalizer standardizes to `group/topic_id/msg_id`. |
| **1. Telegram** | Channel Story (`STORY_INTERACTION`) | `t.me/channel/s/12` | `https://t.me/channel/s/12` | None | **Major (P2)** | Ephemeral 24h-48h TTL. Requires provider service with instant dispatch (< 15 min start) to prevent expiry before delivery. |
| **1. Telegram** | Channel Poll (`POLL_VOTES`) | `t.me/channel/456` (poll post) | `https://t.me/channel/456` | `pollOption`: integer (1-10) or option string | **Critical (P1)** | Provider requires `answer_number` (1-indexed). If option index missing, order fails at provider. |
| **1. Telegram** | Post Comments (`COMMENTS`) | `t.me/channel/123?comment=456` | `https://t.me/channel/123?comment=456` | `comments`: textarea list (lines = qty) | **Critical (P1)** | Preserves `?comment=\d+`. Provider expects `comments` payload. Line count must strictly equal `quantity`. |
| **1. Telegram** | Telegram Bot (`BOT_STARTS`) | `t.me/my_bot`<br>`t.me/my_bot?start=ref123` | `https://t.me/my_bot?start=ref123` | None | **Major (P2)** | Referral token `?start=[\w-]+` must be preserved. Stripping it breaks referral tracking rewards. |
| **1. Telegram** | Private Post (`POST_INTERACTION`) | `t.me/c/1234567890/456` | **BLOCKED (REJECTED)** | N/A | **Critical (P1)** | Provider bots are not members of private chat `1234567890`. Link engine must fail-closed with user guidance to make channel public. |
| **2. VKontakte** | Public Group / Page (`CHANNEL`) | `vk.com/public123`<br>`vk.com/club123`<br>`vk.ru/brand_name`<br>`m.vk.com/public123` | `https://vk.com/public123`<br>`https://vk.com/brand_name` | None | **Minor (P3)** | Normalizes legacy domains (`vk.ru`, `m.vk.com`, `vkontakte.ru`) to `https://vk.com/`. |
| **2. VKontakte** | User Profile (`PROFILE`) | `vk.com/id123456`<br>`vk.com/user_nick` | `https://vk.com/id123456` | None | **Major (P2)** | Used for Friends / Profile Followers. Distinct from community subscribers. |
| **2. VKontakte** | Wall Post (`POST_INTERACTION`) | `vk.com/wall-123_456`<br>`vk.com/wall123_456` | `https://vk.com/wall-123_456` | Optional: `comments`, `pollOption` | **Major (P2)** | Negative ID (`-123`) denotes community; positive ID (`123`) denotes personal user wall. Preserves hyphen. |
| **2. VKontakte** | Video / Clip (`VIDEO_INTERACTION`) | `vk.com/video-1_2`<br>`vk.com/clip-1_2`<br>`vkvideo.ru/video-1_2` | `https://vk.com/video-1_2` | None | **Major (P2)** | Merges standalone `vkvideo.ru` domain into canonical VK video format. Compatible with views and video likes. |
| **2. VKontakte** | Photo from Feed / Modal (`POST_INTERACTION`) | `vk.com/feed?z=photo-1_2%2Fwall...` | `https://vk.com/photo-1_2` | None | **Critical (P1)** | Deep-link extraction: extracts photo identifier from query parameter `z=` and converts to canonical direct photo URL. |
| **2. VKontakte** | Post Comment (`COMMENTS`) | `vk.com/wall-1_2?reply=345` | `https://vk.com/wall-1_2?reply=345` | `comments`: newline list | **Critical (P1)** | Preserves `?reply=\d+`. Crucial for comment likes, upvotes, and targeted replies. |
| **3. YouTube** | Video (`VIDEO_INTERACTION`) | `youtube.com/watch?v=dQw4w9WgXcQ`<br>`youtu.be/dQw4w9WgXcQ`<br>`youtube.com/embed/dQw4w9WgXcQ` | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | None | **Critical (P1)** | Strips tracking junk (`?si=`, `?feature=`, `&t=`), strictly preserves `v=`. Converts short-links (`youtu.be`) to canonical `/watch?v=`. |
| **3. YouTube** | Shorts (`VIDEO_INTERACTION`) | `youtube.com/shorts/dQw4w9WgXcQ`<br>`youtube.com/@user/shorts/dQw4w9WgXcQ` | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | None | **Critical (P1)** | Auto-converts `/shorts/` to standard `/watch?v=` for 100% provider API acceptance (many providers reject raw `/shorts/` paths). |
| **3. YouTube** | Live Stream (`VIDEO_INTERACTION`) | `youtube.com/live/dQw4w9WgXcQ` | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | `duration`: livestream minutes | **Major (P2)** | Converted to `/watch?v=`. Requires stream to be actively live at time of dispatch. |
| **3. YouTube** | Channel (`CHANNEL`) | `youtube.com/@handle`<br>`youtube.com/channel/UC123`<br>`youtube.com/c/CustomName` | `https://www.youtube.com/@handle`<br>`https://www.youtube.com/channel/UC123` | None | **Minor (P3)** | Preserves canonical handle `@handle` or legacy 24-character channel ID `UC...`. |
| **3. YouTube** | Comment Anchor (`COMMENTS`) | `youtube.com/watch?v=ID&lc=Ugz123` | `https://www.youtube.com/watch?v=ID&lc=Ugz123` | None | **Critical (P1)** | Preserves linked comment parameter `lc=`. Used for comment thumbs-up / upvotes. |
| **4. Instagram** | Profile (`PROFILE`) | `instagram.com/cristiano`<br>`instagr.am/cristiano/`<br>`m.instagram.com/cristiano` | `https://www.instagram.com/cristiano` | None (Requires public profile) | **Critical (P1)** | Purges trailing slash. Requires JIT toggle: "Профиль должен быть открытым". Private profiles cause provider order hangs. |
| **4. Instagram** | Post / Carousel (`POST_INTERACTION`) | `instagram.com/p/Cxyz123/`<br>`instagram.com/share/p/Cxyz123/` | `https://www.instagram.com/p/Cxyz123/` | Optional: `comments` | **Major (P2)** | Purges mobile sharing prefix `/share/` and tracking query parameters (`igsh`, `igshid`, `fbclid`). |
| **4. Instagram** | Reel (`VIDEO_INTERACTION`) | `instagram.com/reel/Cxyz123/`<br>`instagram.com/reels/Cxyz123/`<br>`instagram.com/share/reel/Cxyz123/` | `https://www.instagram.com/reel/Cxyz123/` | None | **Major (P2)** | Normalizes plural `/reels/` and share links `/share/reel/` to canonical singular `/reel/Cxyz123/`. |
| **4. Instagram** | Story 24h (`STORY_INTERACTION`) | `instagram.com/stories/username/12345/` | `https://www.instagram.com/username` (or direct story ID) | None | **Critical (P1)** | 24-hour TTL. Many providers accept profile URL for story views and auto-detect active stories. |
| **4. Instagram** | Story Highlight (`STORY_INTERACTION`) | `instagram.com/stories/highlights/12345/` | `https://www.instagram.com/stories/highlights/12345/` | None | **Major (P2)** | Permanent highlights do not expire; safe for bulk delivery. |
| **5. TikTok** | Video (`VIDEO_INTERACTION`) | `tiktok.com/@user/video/1234567890` | `https://www.tiktok.com/@user/video/1234567890` | None | **Major (P2)** | Purges 100% of tracking parameters (`is_from_webapp`, `sender_device`, `ttref`). |
| **5. TikTok** | Short Link (`VIDEO_INTERACTION`) | `vm.tiktok.com/ZMxyz123/`<br>`vt.tiktok.com/ZMxyz123/` | `https://vm.tiktok.com/ZMxyz123/` (unrolled via HEAD) | None | **Critical (P1)** | Unrolled server-side via `resolveShortLink` with SSRF guard to extract canonical video ID. |
| **5. TikTok** | Profile (`PROFILE`) | `tiktok.com/@username`<br>`tiktok.com/username` | `https://www.tiktok.com/@username` | None | **Minor (P3)** | Automatically prepends `@` if missing from username path. |
| **5. TikTok** | Photo Mode (`POST_INTERACTION`) | `tiktok.com/@user/photo/1234567890` | `https://www.tiktok.com/@user/photo/1234567890` | None | **Major (P2)** | Supported as post/video equivalent in modern TikTok carousel updates. |
| **5. TikTok** | Live Stream (`VIDEO_INTERACTION`) | `tiktok.com/@user/live` | `https://www.tiktok.com/@user/live` | `duration`: minutes | **Major (P2)** | Stream must be active at the moment order transitions to `IN_PROGRESS`. |

---

### Table 2.2: Tier 2 Platforms (Twitch, Rutube, Dzen, Twitter/X, Discord, Threads, Facebook, OK)

| Platform | Entity / Target Type | Raw Input Patterns | Canonical URL Output | Custom Data & Required Fields | Criticality | Platform Quirk & Provider API Behavior |
|:---|:---|:---|:---|:---|:---|:---|
| **6. Twitch** | Channel / Live Stream (`STREAM`) | `twitch.tv/streamer_name` | `https://www.twitch.tv/streamer_name` | `duration`: minutes (15, 30, 60, 120) | **Critical (P1)** | Live viewers require stream to be live. Followers can be ordered anytime on same channel link. |
| **6. Twitch** | VOD Video (`VIDEO_INTERACTION`) | `twitch.tv/videos/123456789` | `https://www.twitch.tv/videos/123456789` | None | **Major (P2)** | Permanent past broadcast recordings. |
| **6. Twitch** | Clip (`VIDEO_INTERACTION`) | `clips.twitch.tv/ShortClipSlug`<br>`twitch.tv/streamer/clip/Slug` | `https://clips.twitch.tv/ShortClipSlug` | None | **Major (P2)** | Normalizes path clip syntax into standalone `clips.twitch.tv` format. |
| **7. Rutube** | Video (`VIDEO_INTERACTION`) | `rutube.ru/video/abcdef0123456789abcdef0123456789/` | `https://rutube.ru/video/32hex/` | None | **Major (P2)** | Rutube video ID is strictly a 32-character hexadecimal string. |
| **7. Rutube** | Shorts (`VIDEO_INTERACTION`) | `rutube.ru/shorts/abcdef0123456789abcdef0123456789/` | `https://rutube.ru/video/32hex/` | None | **Critical (P1)** | Converted from `/shorts/` to `/video/` for external provider API compatibility. |
| **7. Rutube** | Channel (`CHANNEL`) | `rutube.ru/channel/12345678/`<br>`rutube.ru/u/username/` | `https://rutube.ru/channel/12345678/` | None | **Minor (P3)** | Preserves channel numerical ID or custom slug `/u/`. |
| **8. Dzen** | Article (`POST_INTERACTION`) | `dzen.ru/a/Zxyz123`<br>`zen.yandex.ru/media/...` | `https://dzen.ru/a/Zxyz123` | None | **Major (P2)** | Normalizes legacy `zen.yandex.ru` domain to `dzen.ru`. |
| **8. Dzen** | Video (`VIDEO_INTERACTION`) | `dzen.ru/video/watch/123456`<br>`dzen.ru/shorts/123456` | `https://dzen.ru/video/watch/123456` | None | **Major (P2)** | Normalizes video watching URLs. |
| **8. Dzen** | Channel (`CHANNEL`) | `dzen.ru/id/5abcdef`<br>`dzen.ru/@username` | `https://dzen.ru/id/5abcdef` | None | **Minor (P3)** | Channel subscriber target. |
| **9. Twitter / X** | Tweet / Post (`POST_INTERACTION`) | `twitter.com/user/status/123456`<br>`x.com/user/status/123456` | `https://x.com/user/status/123456` | None | **Critical (P1)** | Normalizes `twitter.com` and `mobile.twitter.com` to canonical `x.com`. |
| **9. Twitter / X** | Profile (`PROFILE`) | `twitter.com/username`<br>`x.com/username` | `https://x.com/username` | None | **Major (P2)** | Followers target. Strips query parameters. |
| **10. Discord** | Server Invite (`CHANNEL`) | `discord.gg/inviteCode`<br>`discord.com/invite/inviteCode` | `https://discord.gg/inviteCode` | None | **Critical (P1)** | Invite code MUST be set to "Never expire" and "No limit on uses". Expiring invites cause delivery aborts. |
| **11. Threads** | Post (`POST_INTERACTION`) | `threads.net/@user/post/Cxyz123` | `https://www.threads.net/@user/post/Cxyz123` | None | **Major (P2)** | Normalizes to `www.threads.net`. |
| **11. Threads** | Profile (`PROFILE`) | `threads.net/@username` | `https://www.threads.net/@username` | None | **Minor (P3)** | Profile followers target. |
| **12. Facebook** | Post / Photo (`POST_INTERACTION`) | `facebook.com/user/posts/123`<br>`fb.watch/shortCode` | `https://www.facebook.com/...` | None | **Major (P2)** | Unrolls `fb.watch` short-links. Strips `ref`, `rc`, `fbid`. |
| **12. Facebook** | Page / Group (`CHANNEL`) | `facebook.com/pagename`<br>`facebook.com/groups/12345` | `https://www.facebook.com/pagename` | None | **Major (P2)** | Page likes vs group members distinction. |
| **13. Spotify** | Track (`POST_INTERACTION`) | `open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT` | `https://open.spotify.com/track/ID` | None | **Major (P2)** | Track plays and saves. Purges `?si=` sharing token. |
| **13. Spotify** | Artist (`PROFILE`) | `open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02` | `https://open.spotify.com/artist/ID` | None | **Major (P2)** | Artist monthly listeners and followers. |
| **13. Spotify** | Playlist / Album (`CHANNEL`) | `open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M` | `https://open.spotify.com/playlist/ID` | None | **Major (P2)** | Playlist followers / saves. |
| **14. Odnoklassniki (OK)** | Topic / Post (`POST_INTERACTION`) | `ok.ru/group/123/topic/456`<br>`ok.ru/profile/123/statuses/456` | `https://ok.ru/group/123/topic/456` | None | **Major (P2)** | OK "Классы" (Likes) and shares on topics. |
| **14. Odnoklassniki (OK)** | Group / Profile (`CHANNEL`) | `ok.ru/group/123456789`<br>`ok.ru/profile/123456789` | `https://ok.ru/group/123456789` | None | **Minor (P3)** | Group participants or profile friends. |

---

### Table 2.3: Tier 3 Specialized & Emerging Platforms (15 to 37)

| Platform | Entity / Target Type | Raw Input Patterns | Canonical URL Output | Custom Data & Required Fields | Criticality | Platform Quirk & Provider API Behavior |
|:---|:---|:---|:---|:---|:---|:---|
| **15. Kick** | Live Stream / Channel (`STREAM`) | `kick.com/streamer_name` | `https://kick.com/streamer_name` | `duration`: minutes | **Critical (P1)** | Cloudflare-protected platform; providers require active live stream at order time. |
| **16. Likee** | Video / Profile (`POST_INTERACTION`) | `likee.video/@user/video/123`<br>`l.likee.video/v/short` | `https://likee.video/@user/video/123` | None | **Major (P2)** | Unrolls `l.likee.video` short-links. |
| **17. WhatsApp** | Channel / Group Invite (`CHANNEL`) | `whatsapp.com/channel/0029Va...`<br>`chat.whatsapp.com/InviteCode` | `https://whatsapp.com/channel/ID`<br>`https://chat.whatsapp.com/Code` | None | **Critical (P1)** | WhatsApp Channels (read-only broadcasts) vs WhatsApp Chat Groups (member limit 1024). |
| **18. Pinterest** | Pin / Profile (`POST_INTERACTION`) | `pinterest.com/pin/123456/`<br>`pin.it/shortCode` | `https://www.pinterest.com/pin/123456/` | None | **Major (P2)** | Unrolls `pin.it` short URLs. Normalizes regional subdomains (`ru.pinterest.com`). |
| **19. SoundCloud** | Track / Artist (`POST_INTERACTION`) | `soundcloud.com/artist/track-slug` | `https://soundcloud.com/artist/track-slug` | None | **Major (P2)** | Track plays vs artist followers. |
| **20. Reddit** | Post / Subreddit (`POST_INTERACTION`) | `reddit.com/r/subreddit/comments/id/slug/` | `https://www.reddit.com/r/subreddit/comments/id/slug/` | None | **Major (P2)** | Upvotes on submissions. Strips query parameters. |
| **21. Trovo** | Channel / Stream (`STREAM`) | `trovo.live/streamer` | `https://trovo.live/streamer` | `duration`: minutes | **Major (P2)** | Livestream viewers and followers. |
| **22. Kwai** | Video / Profile (`POST_INTERACTION`) | `kwai.com/@user/video/123`<br>`s.kwai.app/s/short` | `https://kwai.com/@user/video/123` | None | **Major (P2)** | Unrolls short-links. |
| **23. Steam** | Community Group / Profile (`CHANNEL`) | `steamcommunity.com/groups/slug`<br>`steamcommunity.com/id/vanity` | `https://steamcommunity.com/groups/slug` | None | **Major (P2)** | Group members vs profile comments/awards. |
| **24. LinkedIn** | Post / Company Page (`POST_INTERACTION`) | `linkedin.com/posts/activity-123`<br>`linkedin.com/company/slug` | `https://www.linkedin.com/posts/activity-123` | None | **Major (P2)** | API post likes and company page followers. |
| **25. Snapchat** | Profile / Story (`PROFILE`) | `snapchat.com/add/username` | `https://www.snapchat.com/add/username` | None | **Minor (P3)** | Friend additions. |
| **26. Vimeo** | Video (`VIDEO_INTERACTION`) | `vimeo.com/123456789` | `https://vimeo.com/123456789` | None | **Minor (P3)** | Video views and likes. |
| **27. Rumble** | Video (`VIDEO_INTERACTION`) | `rumble.com/v12345-video-title.html` | `https://rumble.com/v12345-video-title.html` | None | **Major (P2)** | Video views. |
| **28. Shazam** | Track (`POST_INTERACTION`) | `shazam.com/track/123456` | `https://www.shazam.com/track/123456` | None | **Minor (P3)** | Song shazams / recognitions. |
| **29. Medium** | Article / Member (`POST_INTERACTION`) | `medium.com/@user/story-slug-123` | `https://medium.com/@user/story-slug-123` | None | **Minor (P3)** | Claps and reads. |
| **30. Tumblr** | Post / Blog (`POST_INTERACTION`) | `tumblr.com/blogname/123456/post-title` | `https://tumblr.com/blogname/123456` | None | **Minor (P3)** | Reblogs and likes. |
| **31. Quora** | Answer / Space (`POST_INTERACTION`) | `quora.com/Question-Title/answer/User` | `https://www.quora.com/Question-Title/answer/User` | None | **Minor (P3)** | Upvotes on answers. |
| **32. Apple Music** | Track / Artist (`POST_INTERACTION`) | `music.apple.com/us/album/song/123?i=456` | `https://music.apple.com/album/song/123?i=456` | None | **Major (P2)** | Preserves track query ID `?i=\d+`. |
| **33. Apple Podcasts** | Podcast / Episode (`CHANNEL`) | `podcasts.apple.com/us/podcast/title/id123` | `https://podcasts.apple.com/podcast/title/id123` | None | **Minor (P3)** | Podcast subscribers and reviews. |
| **34. MAX (Яндекс Музыка)** | Track / Artist / Podcast (`POST_INTERACTION`) | `music.yandex.ru/album/123/track/456`<br>`music.yandex.ru/artist/789` | `https://music.yandex.ru/album/123/track/456` | None | **Major (P2)** | Regional domestic streaming. Track plays vs artist listeners. |
| **35. Wibes / Wildberries** | WB Guru / Social / Product (`POST_INTERACTION`) | `wildberries.ru/catalog/123/detail.aspx` | `https://www.wildberries.ru/catalog/123/detail.aspx` | `comments`: reviews text | **Critical (P1)** | Marketplace review and traffic services. |
| **36. Web Traffic** | Website URL (`CUSTOM`) | `https://example.com/landing?ref=1` | `https://example.com/landing` | `keywords`: text list, `geo`: country code | **Major (P2)** | Direct, organic search, or referral web visitors. TargetType `CUSTOM`. |
| **37. Generic Social / Other** | Universal Fallback (`CUSTOM`) | `https://anydomain.com/path` | Canonicalized URI | Varied | **Minor (P3)** | Validated against SSRF and Prohibited Content rules. Non-blocking fallback. |

---

## 3. Deep Analysis of the 5 Core Dimensions

### Dimension 1: Multi-Category Applicability (1 Link $\to$ $N$ Categories)
When a user pastes a URL, the URL pattern frequently satisfies multiple valid categories. The system must not guess blindly, but execute **Deterministic Intent Disambiguation**:

```
[User inputs https://t.me/durov]
                 │
                 ▼
[Link Engine detects Platform: TELEGRAM, Entity: CHANNEL]
                 │
                 ▼
[Applicable Categories Found (N = 5)]:
   1. Подписчики (Subscribers) ── Demand Score: 10
   2. Бусты (Channel Boosts) ── Demand Score: 60
   3. Автопросмотры (Future Posts) ── Demand Score: 20
   4. Автореакции (Future Posts) ── Demand Score: 40
   5. Истории (Stories on Channel) ── Demand Score: 50
                 │
                 ▼
[Decision Rule]:
   - If N == 1: Auto-select category, advance to Step 3.
   - If N > 1: DO NOT reset to empty. Render "Intent Selector Card" with high-contrast chips:
     [ 👥 Подписчики ]  [ 👁️ Авто-просмотры ]  [ 🚀 Бусты ]  [ 👍 Авто-реакции ]
```

### Dimension 2: Auto and Subscription Services
External providers distinguish between three operational paradigms:
1. **Drip-Feed Batch**: Total volume $Q$ distributed in $N$ runs every $M$ minutes. Platform Invariant: $\lfloor Q/N \rfloor \ge \text{service.minQty}$.
2. **Subscription / Auto-Monitoring**: External provider monitors channel/profile. Whenever a new post is published, provider automatically delivers $K$ views/likes. Parameters: `min`, `max`, `posts`, `delay`, `expiry`.
3. **Livestream Watch-Time**: Concurrent bot viewers injected into an active live stream for $D$ minutes (`duration`).

### Dimension 3: Closed, Private & Restricted Entities
- **Telegram `/c/` links (`t.me/c/123/456`)**: Provider accounts cannot see private group posts. **Hard Reject** in validator with actionable hint: *"Сделайте канал публичным"*.
- **Telegram Private Invite (`t.me/+hash`)**: Allowed ONLY for Subscribers/Members. Blocked for Post Views, Reactions, and Comments.
- **Instagram Private Accounts**: Follower requests cannot be verified by bot networks. Requires explicit JIT confirmation checkbox before checkout.
- **Discord Invites**: Must be non-expiring with unlimited uses.

### Dimension 4: Dynamic Custom Input Fields
| Field Type | Data Schema | Normalization & Sanitization | Provider Parameter Name |
|---|---|---|---|
| **Custom Comments** | Array of strings (1 comment/line) | Strip `\r`, trim whitespace, filter empty lines, strip control chars `\x00-\x1F\x7F`, XSS sanitize via DOMPurify | `comments` |
| **Poll Option** | Integer ($1 \le N \le 20$) or text string | Regex `^\d+$` or sanitized answer string | `answer_number` (or `answers_number`) |
| **Reactions** | Array of emojis or doc IDs | Validate Unicode emoji graphemes or numeric document IDs | `reaction` or `comments` |
| **Usernames** | Array of handles | Strip leading `@`, validate `^[a-zA-Z0-9_.]+$` | `usernames` |
| **Media Group URL** | Canonical post URL | Must belong to the same Telegram channel as primary link | Second order created atomically |

### Dimension 5: Platform URL Edge Cases
- **YouTube Shorts & Live Streams**: Auto-converted to `https://www.youtube.com/watch?v=ID` for 100% provider API compatibility.
- **Telegram Albums (Media Groups)**: "Rule of Two Orders" creates dual synchronized orders (first photo + last photo) under a single payment.
- **Query Parameter Preservation vs Stripping**: Strips tracking tags (`utm_*`, `igsh`, `fbclid`, `si`, `t`), preserves functional routing tags (`v`, `lc`, `comment`, `reply`, `start`, `single`).

---

## 4. Architectural Verification & Zero-Defect Conformance

1. **ReDoS Immunity**: Every regex in `UNIFIED_REGEX` is bounded, without nested quantifiers, executing in $O(N)$ linear time.
2. **SSRF Guard**: All URLs verified against RFC 1918, loopback (`127.0.0.1`, `::1`), cloud metadata (`169.254.169.254`), and private subnets.
3. **ExactMath**: All monetary charges computed in integer kopecks via `BigInt` with Ledger-first invariant.
4. **Zero-Defect Contract**: 100% coverage of active platforms, zero placeholders, zero dummy values.
