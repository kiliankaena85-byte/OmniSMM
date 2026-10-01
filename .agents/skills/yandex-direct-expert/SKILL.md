---
name: yandex-direct-expert
description: |
  Comprehensive Yandex Direct advertising management, campaign architecture,
  VCG auction bidding, negative keyword cross-subtraction, and API v5 integration.
  Covers Search (Поиск), YAN (РСЯ), Master of Campaigns, and strict compliance
  with Yandex advertising policies (Rule 15 prohibition on bots/fake metrics).
---

# Yandex Direct Expert (v2026.1)

## 1. Overview & Capabilities
This skill manages end-to-end Yandex Direct PPC advertising campaigns for Russian and CIS markets:
* **Campaign Architectures**: Ethereal Search campaigns, Context Network (РСЯ), Smart Banners, Unified Performance Campaigns (ЕПК).
* **VCG Auction & Bid Modeling**: Calculating 5%, 15%, 75%, and 100% traffic volume bids via `KeywordBids` and live metrics.
* **Negative Keyword Defense**: Multi-tier negative keyword lists (Campaign level, AdGroup level, Cross-subtraction `кросс-минусовка`).
* **Yandex Direct API v5 Operations**: Automated campaign CRUD, keyword bids fetching, report generation.
* **Legal & Moderation Compliance**: Full compliance with Federal Law No. 347-FZ (ERIR ad labeling via Yandex ORD) and Rule 15 mitigation (framing SMM automation as B2B software, ORM, and marketing tooling).

## 2. API v5 Architecture & Quick Commands
* **Base URL**: `https://api.direct.yandex.com/json/v5/`
* **Sandbox URL**: `https://api-sandbox.direct.yandex.com/json/v5/`
* **Authentication**: `Authorization: Bearer <TOKEN>`
* **Service Endpoints**:
  * `campaigns`: Campaign management (Search, Text-Image, Dynamic)
  * `adgroups`: Targeting parameters, region IDs (`GeoID: [225]` for Russia)
  * `ads`: Responsive search ads, headers, descriptions, sitelinks (`sitelinks` service)
  * `keywords`: Keyword injection, match types, negative keywords
  * `keywordbids`: Real-time auction pricing (`SearchPrices`, `AuctionBids`)
  * `reports`: Off-line performance statistics (Clicks, Impressions, Cost, AvgCpc, Conversions)

## 3. Moderation & SMM Policy Invariant
> ⚠️ **CRITICAL RULE**: Yandex Direct strictly bans direct promotion of "fake engagement" (накрутка).
* **Forbidden phrasing**: "накрутка ботов", "купить накрутку", "боты дешево", "накрутить лайки".
* **Compliant white framing**: "Автоматизация SMM", "Развитие сообществ и каналов", "Продвижение контента", "SMM-панель для маркетологов", "Оптовый SMM API для агентств".
* **Landing Page Requirements**: Legal entity requisites (ИНН, ОГРНИП/ООО), Public Offer (Оферта), Privacy Policy (152-ФЗ), Payment receipts (54-ФЗ).
