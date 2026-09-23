# Catalog Deep Audit Report

**Total Services Audited:** 921
**Total Issues Found:** 6

## Summary of Issues

- **HIGH Severity:** 6
- **MEDIUM Severity:** 0
- **LOW Severity:** 0

## Detailed Errors Table

| ID | Ext ID | Platform | Category | Name | Issue | Severity | Proposed Fix |
|---|---|---|---|---|---|---|---|
| `cmqqaqxhv003td2qzo50xc8ga` | `35893` | TELEGRAM | 📱 Сториз / Истории | Telegram — Реакции на 1 историю канала (❤️) | Telegram reaction service mapped to '📱 Сториз / Истории' category. It should be in '🎭 Реакции / Эмодзи'. | **HIGH** | {} |
| `cmqqaqxii003zd2qzibgpht31` | `564` | TELEGRAM | 📱 Сториз / Истории | 564. TG Реакции на Истории | Telegram reaction service mapped to '📱 Сториз / Истории' category. It should be in '🎭 Реакции / Эмодзи'. | **HIGH** | {} |
| `cmqqaqxu20071d2qz5m4esh44` | `2783` | VK | ❤️ Лайки / Нравится | VK Лайки на посты [СНГ] [Быстрые] | Service seems to be auto-views or auto-reactions distributed over multiple posts, but targetType is set to 'POST' (which requires a single post link). | **HIGH** | {"targetType":"CHANNEL_POSTS"} |
| `cmqqaqxui0075d2qz1eldxlzz` | `1722` | VK | ❤️ Лайки / Нравится | VK Лайки на посты [Медленные] | Service seems to be auto-views or auto-reactions distributed over multiple posts, but targetType is set to 'POST' (which requires a single post link). | **HIGH** | {"targetType":"CHANNEL_POSTS"} |
| `cmqqaqxqg0063d2qzos2me2xd` | `35261` | TELEGRAM | 🚀 Бусты (Telegram Levels) | Telegram (TG) | Реакции [Признательный буст: 👍 🙏] | Telegram reaction service mapped to '🚀 Бусты (Telegram Levels)' category. It should be in '🎭 Реакции / Эмодзи'. | **HIGH** | {} |
| `cmqqaqysv00fhd2qzfu943p0s` | `461` | YOUTUBE | 👁 Просмотры / Охват | 461. YT Подписчики + Гарантия [30 дней] ♻️ | Category is '👁 Просмотры / Охват' but targetType is 'CHANNEL'. It should be 'POST'. | **HIGH** | {"targetType":"POST"} |


## Action Items & Recommendations
1. **Fix database records:** Run a script to apply the proposed fixes.
2. **Update smart-analyzer.logic.ts:** Refine keyword mappings so that subsequent catalog synchronizations don't re-introduce these errors.
