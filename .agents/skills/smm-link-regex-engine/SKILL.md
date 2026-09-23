---
name: smm-link-regex-engine
version: 1.0.0
description: Zero-cost ReDoS-safe link parsing and validation engine. Combines fast deterministic regex masks with AI LLM fallback (gemini-3-flash) for social network URL analysis, handles complex platform formats (Telegram, VK, Instagram, YouTube, TikTok) without catastrophic backtracking.
---

# SKILL: SMM Link Regex Engine & ReDoS-Safe Parsing Architecture

## 0. РОЛЬ И ФИЛОСОФИЯ
Ты — ведущий инженер по парсингу и валидации входных данных SMMplan/SMMflux.
Твоя цель: **100% точность валидации ссылок клиентов при 0мс задержке и 0₽ расходов на LLM для 99% стандартного трафика**.

### Ключевой принцип (Regex vs LLM Split):
1. **Tier 1 (Zero-Cost / Deterministic):** ReDoS-безопасный RegEx выполняет моментальную проверку ссылок на клиенте и в Server Actions.
2. **Tier 2 (AI Fallback & Pattern Synthesis):** Модель `gemini-3-flash` привлекается **только** для синтеза новых регулярных выражений администратором в `/admin/catalog/patterns` или разбора редких/динамических аномалий в карантине.

---

## 1. СТАНДАРТЫ МАСОК ПО ПЛАТФОРМАМ

### 1.1 Telegram
- **Канал / Группа / Пост:**
  - `^https?:\/\/(t\.me|telegram\.me)\/([a-zA-Z0-9_]{4,32})(\/\d+)?\/?$`
- **Приватные / Joinchat ссылки:**
  - `^https?:\/\/(t\.me|telegram\.me)\/\+[a-zA-Z0-9_-]{10,}\/?$`
  - `^https?:\/\/(t\.me|telegram\.me)\/joinchat\/[a-zA-Z0-9_-]{10,}\/?$`
- **Боты:**
  - `^https?:\/\/(t\.me|telegram\.me)\/([a-zA-Z0-9_]{3,28}bot)(\?start=[a-zA-Z0-9_-]+)?\/?$`

### 1.2 VKontakte (ВКонтакте)
- **Профиль / Стена / Пост:**
  - `^https?:\/\/(vk\.com|vkontakte\.ru)\/(id\d+|[a-zA-Z0-9._]{3,32})(\?w=wall-?\d+_\d+)?\/?$`
  - `^https?:\/\/(vk\.com|vkontakte\.ru)\/wall-?\d+_\d+\/?$`
- **Паблик / Группа:**
  - `^https?:\/\/(vk\.com|vkontakte\.ru)\/(public\d+|club\d+|event\d+|[a-zA-Z0-9._]{3,32})\/?$`
- **Клипы (VK Clips):**
  - `^https?:\/\/(vk\.com|vkontakte\.ru)\/clip-?\d+_\d+\/?$`

### 1.3 YouTube
- **Видео:**
  - `^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$`
- **Shorts:**
  - `^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(\S*)?$`
- **Канал:**
  - `^https?:\/\/(www\.)?youtube\.com\/(@[a-zA-Z0-9_.-]{3,30}|channel\/[a-zA-Z0-9_-]{24}|c\/[a-zA-Z0-9_-]+)\/?$`

### 1.4 Instagram
- **Профиль:**
  - `^https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9._]{1,30})\/?(\?.*)?$`
- **Пост / Reels:**
  - `^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/([a-zA-Z0-9_-]{5,30})\/?(\?.*)?$`

### 1.5 TikTok
- **Профиль:**
  - `^https?:\/\/(www\.)?tiktok\.com\/@([a-zA-Z0-9._]{2,24})\/?$`
- **Видео:**
  - `^https?:\/\/(www\.)?tiktok\.com\/@([a-zA-Z0-9._]{2,24})\/video\/(\d{15,25})\/?$`
  - `^https?:\/\/(vm|vt)\.tiktok\.com\/([a-zA-Z0-9]{6,12})\/?$`

---

## 2. АНТИ-REDOS ИНВАРИАНТЫ (Catastrophic Backtracking Prevention)

1. **Запрет вложенных квантификаторов:**
   - ❌ `(a+)+`, `([a-zA-Z0-9]+)*`, `(https?:\/\/.*)*`
   - ✅ `[a-zA-Z0-9_-]{1,30}` с четко заданными границами длины.
2. **Ограничение длины строки на входе:**
   - Перед передачей строки в `RegExp.test(url)` всегда проверяй `if (url.length > 512) return false;`.
3. **Строгие квантификаторы вместо `.*`:**
   - ❌ `https:\/\/t\.me\/.*` (уязвимо для подмены и ReDoS).
   - ✅ `https:\/\/(t\.me|telegram\.me)\/[a-zA-Z0-9_]{4,32}`.
4. **Безопасная песочница валидации:**
   - При выполнении пользовательских или административных масок использовать таймаут-раннер (Worker или Safe Eval с лимитом 15мс).

---

## 3. ИНТЕГРАЦИЯ С АДМИНКОЙ (`/admin/catalog/patterns`)

- Администратор может создавать маски через No-Code конструктор или просить AI сгенерировать маску.
- При запросе к AI (модель `gemini-3-flash`) системный промпт ОБЯЗАН требовать:
  ```json
  {
    "regex": "^https?:\\/\\/...",
    "explanation": "Человекопонятное описание маски",
    "testCases": ["https://valid-url.com/...", "https://invalid-url.com/..."],
    "redosSafe": true
  }
  ```
- Каждая новая сгенерированная маска автоматически проходит стресс-тест в `Live Sandbox` с 10 000 мутаций строки перед сохранением в БД.
