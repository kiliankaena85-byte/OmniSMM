# OmniProxy — DePIN VPN-клиент (Архитектурная спецификация)

> Дата: 2026-09-30 | Статус: Планирование | ADR-2026-59

---

## 1. Концепция и конкурентное позиционирование

### Суть идеи
Пользователь устанавливает **бесплатный VPN-клиент OmniProxy**.
В обмен на VPN-доступ клиент выполняет фоновые HTTP-просмотры постов Telegram — реальные коммерческие задания SMM-клиентов OmniSMM.

### Аналоги на рынке (proof of concept бизнес-модели)

| Продукт | Дают | Берут | ARR |
|---------|------|-------|-----|
| Honeygain | ~$3/мес кэшбэк | Сетевой трафик (residential proxy) | $30M+ |
| EarnApp (Bright Data) | Деньги за bandwidth | Residential IP для корпораций | $300M+ |
| PacketStream | $0.10/GB | Proxy для web scraping | Продан за $50M |
| **OmniProxy** | **Бесплатный VPN + AI** | **Выполнение SMM-заказов** | **Target: $5M ARR** |

### Ключевое отличие от Hamster Kombat
- Honeygain/EarnApp: продают трафик корпорациям — пассивный доход для пользователя
- OmniProxy: выполняет реальные оплаченные SMM-заказы — прямой бизнес-поток
- Нет токенов, нет аирдропа — мгновенный вывод в рубли или VPN-баллы

---

## 2. Форм-факторы и технологический стек

### Форм-фактор A: Desktop (Windows / macOS / Linux)
```
Технология: Tauri v2 (Rust backend + WebView2 frontend)
Форк: clash-verge-rev (MIT, 38k GitHub stars)
VPN-ядро: Mihomo (Clash.Meta) — Go, battle-tested, VLESS/Shadowsocks/Reality
OmniNode sidecar: Rust background thread внутри Tauri процесса
```

### Форм-фактор B: Android APK
```
Технология: Flutter 3.x (Dart)
Форк: hiddify-app (MIT, 18k GitHub stars) — поддерживает sing-box ядро
VPN-ядро: sing-box (Go) — современнее Mihomo
OmniNode sidecar: Dart Isolate (работает как Android Foreground Service)
```

---

## 3. Архитектура: Единый API-шлюз

```
┌───────────────────────────────────────────────────────────────────┐
│                    OmniSMM Server (Next.js 16)                    │
│                                                                   │
│  /api/depin/ws        — WebSocket: push задач в реальном времени │
│  /api/depin/auth      — HMAC nodeId привязка (уже реализовано)   │
│  /api/depin/proxy     — Серверный прокси для верификации просмотра │
│  /api/vpn/provision   — Выдача VPN-конфига (VLESS link) по nodeId │
│  /api/vpn/balance     — Баланс VPN-минут по выполненным задачам  │
└──────────────┬───────────────────────────────────────────────────┘
               │ HTTPS + WebSocket
    ┌──────────┴───────────┐
    │                      │
┌───▼──────────────────┐  ┌▼──────────────────────┐
│  Tauri Desktop App   │  │  Flutter Android APK  │
│  Mihomo ядро (Go)    │  │  sing-box ядро (Go)   │
│  OmniNode (Rust)     │  │  OmniNode (Dart)      │
│  UI: React+Tailwind  │  │  UI: Flutter Material  │
└──────────────────────┘  └──────────────────────┘
```

### API-контракт /api/vpn/provision
```typescript
POST /api/vpn/provision
Body: { nodeId: string, platform: 'desktop' | 'android' }

Response: {
  vlessLink: "vless://uuid@server:443?type=tcp&security=reality&...",
  tier: 'free' | 'full' | 'premium',
  tasksThisMonth: number,
  tasksForUpgrade: number,  // сколько задач до следующего tier
}
```

---

## 4. Юридическая архитектура (ОБЯЗАТЕЛЬНО)

### Экран Informed Consent при первой установке
```
╔══════════════════════════════════════════╗
║        OmniProxy — Как это работает      ║
╠══════════════════════════════════════════╣
║  ✅ Вы получаете:                        ║
║     • Бесплатный VPN (VLESS/Reality)     ║
║     • AI-копирайтер на Gemini            ║
║     • OmniCredits → реальные рубли       ║
║                                          ║
║  📡 Приложение использует (~50 МБ/час):  ║
║     Ваш интернет для просмотра           ║
║     публичных постов Telegram            ║
║                                          ║
║  🔒 Не использует:                       ║
║     Пароли, переписки, файлы             ║
║                                          ║
║  [✓ Согласен] [Использовать без VPN]    ║
╚══════════════════════════════════════════╝
```

Только публичные GET `https://t.me/s/{channel}/{post}` — никакого residential proxy.

---

## 5. Бизнес-модель (Unit Economics)

### На 1 пользователя/месяц
```
Задач: 50/день × 30 = 1500/мес
Выручка: 1500 × 0.035 ₽ = 52.50 ₽/мес
Затраты:
  VPN сервер:     0.30 ₽/мес
  Gemini API:     5.00 ₽/мес
  OmniCredits:   15.00 ₽/мес
Маржа:          32.20 ₽/мес (~61%)
```

### Масштаб
| Пользователей | Прибыль/мес |
|--------------|-------------|
| 10,000 | 322,000 ₽ |
| 100,000 | 3,220,000 ₽ |
| 1,000,000 | 32,200,000 ₽ |

### Tier система VPN
```
FREE:     5 GB/мес, 10 Мбит — при установке без отключения Node
FULL:    Безлимит, 100 Мбит — 100+ задач/мес (3-4 в день)
PREMIUM: Безлимит + статический IP — 500 задач/мес или 99 ₽/мес
```

---

## 6. VPN-инфраструктура

### Протоколы (для обхода блокировок в РФ)
1. **VLESS + Reality** — основной (не детектируется как VPN)
2. **Shadowsocks + v2ray-plugin** — fallback
3. **Hysteria 2** — UDP-based, для нестабильных соединений

### MVP серверы
- Hetzner Финляндия — для пользователей РФ (~5 EUR/мес, до 50k пользователей)
- AWS Singapore — для Азии
- DigitalOcean Amsterdam — для ЕС

---

## 7. Growth Loop (Виральность)

```
Пользователь устанавливает OmniProxy
  └─→ Делится ссылкой за +500 OmniCredits
       └─→ Друг устанавливает = новый узел сети
            └─→ Больше узлов = больше заказов выполняется
                 └─→ Рекламодатели видят масштаб → больше заказов
                      └─→ Петля замыкается ↑
```

---

## 8. Дорожная карта

### Sprint 1 (2 нед): Серверный API
- [ ] `POST /api/vpn/provision` — выдача VLESS конфигов
- [ ] `GET /api/vpn/balance` — tier статус по nodeId
- [ ] WebSocket `/api/depin/ws` — push задач
- [ ] `/api/depin/proxy` — серверный прокси для верификации
- [ ] Xray-core сервер (Reality) на Hetzner Finland
- [ ] Prisma: `VpnNode`, `VpnTier` таблицы

### Sprint 2 (3 нед): Tauri Desktop
- [ ] Fork clash-verge-rev → `OmniSMM/omniproxy-desktop`
  - Переименование бренда, замена UI
  - OmniNode Rust sidecar
  - Informed Consent экран
  - Auto-provision VPN через API
- [ ] GitHub Releases с подписанными бинарниками

### Sprint 3 (4 нед): Flutter Android
- [ ] Fork hiddify-app → `OmniSMM/omniproxy-android`
  - Dart OmniNode Isolate (Foreground Service)
  - Informed Consent + разрешения
- [ ] Publish в RuStore

### Sprint 4: Growth
- [ ] Реферальная программа
- [ ] Публичный Dashboard сети (омни-нодов онлайн)
- [ ] Open-source MIT лицензия → вирусность

---

## 9. Связь с существующей архитектурой

### Уже реализовано (сентябрь 2026)
```
✅ /api/depin/auth          — HMAC-SHA256 Telegram initData
✅ reportDePinTaskAction    — rate-limit Redis 360 задач/час
✅ DePinTaskDispatcher      — singleton, acquireTasks, reportTask
✅ convertCreditsToBalanceAction — WalletOps.credit (COMPENSATION)
✅ GeminiClient.generateContent — string return type (fixed)
```

### Нужно добавить для OmniProxy
```
⬜ /api/vpn/provision       — VLESS конфиги привязанные к nodeId
⬜ /api/depin/ws            — WebSocket вместо HTTP polling
⬜ /api/depin/proxy         — верификация просмотров без no-cors
⬜ Prisma: VpnNode, VpnTier
⬜ Xray-Reality VPN сервер
```
