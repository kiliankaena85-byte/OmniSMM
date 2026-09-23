# CONTENT PLAN & SEO AUDIT REPORT

Дата сборки: 29 июля 2026 г.

## 1. Сводка Pillar Pages (Главные разделы базы знаний)

| Файл | Slug | Заголовок (H1) | Изучение (мин) | Ссылки на Glossary | FAQ вопросов |
| --- | --- | --- | --- | --- | --- |
| `src/data/seo/pillars/guide-telegram.ts` | `guide-telegram` | Продвижение в Telegram: полный гайд 2026 | 15 | 3 | 5 |
| `src/data/seo/pillars/guide-instagram.ts` | `guide-instagram` | Продвижение в Instagram: гайд 2026 | 16 | 3 | 5 |
| `src/data/seo/pillars/smm-api-guide.ts` | `smm-api-guide` | SMM API для агентств и реселлеров | 16 | 3 | 5 |
| `src/data/seo/pillars/how-to-choose-smm-panel.ts` | `how-to-choose-smm-panel` | Как выбрать SMM-панель: чеклист 2026 | 16 | 4 | 5 |
| `src/data/seo/pillars/guide-vk.ts` | `guide-vk` | Продвижение ВКонтакте: полный гайд 2026 | 16 | 3 | 5 |

---

## 2. Сводка Cluster Articles (30 сателлитных статей Hub-and-Spoke)

### Telegram Clusters (8 статей)
- `kak-nabrat-podpischikov-telegram` — Как набрать подписчиков в Telegram-канале в 2026 году
- `prosmotry-telegram` — Просмотры в Telegram: зачем нужны и как увеличить
- `reakcii-telegram` — Реакции в Telegram: как работают и зачем нужны
- `telegram-stars` — Telegram Stars: что это и как использовать
- `dripfeed-telegram` — Drip-feed для Telegram: постепенное продвижение
- `limity-telegram` — Лимиты Telegram: что нельзя превышать
- `prodvizhenie-zakrytogo-kanala` — Продвижение закрытого Telegram-канала
- `stoimost-prodvizheniya-telegram` — Сколько стоит продвижение Telegram-канала

### Instagram Clusters (6 статей, Meta Disclaimer)
- `kak-nabrat-podpischikov-instagram` — Как набрать подписчиков в Instagram в 2026 году
- `laiki-instagram` — Лайки в Instagram: зачем нужны и как влияют
- `prodvizhenie-reels` — Продвижение Reels: как увеличить просмотры
- `prosmotry-stories-instagram` — Просмотры Stories в Instagram
- `limity-instagram` — Лимиты Instagram: безопасность аккаунта
- `algoritmy-instagram` — Алгоритмы Instagram в 2026 году

### SMM API Clusters (5 статей)
- `kak-poluchit-api-kluch` — Как получить API-ключ SMM-панели
- `api-metod-add` — SMM API: создание заказа (метод add)
- `api-status-zakaza` — SMM API: проверка статуса заказа
- `api-refill` — SMM API: докрутка (refill) заказов
- `reselling-smm` — Как заработать на реселлинге SMM-услуг

### SMM Panel Selection Clusters (5 статей)
- `chto-takoe-smm-panel` — Что такое SMM-панель и как она работает
- `ceny-smm-panel` — Цены в SMM-панелях: как формируется наценка
- `eta-skorost` — Скорость выполнения заказов: что такое ETA
- `garantii-vozvraty` — Гарантии и возвраты в SMM-панелях
- `bezopasnost-smm-panel` — Безопасность SMM-панели: как не потерять деньги

### VKontakte Clusters (6 статей)
- `kak-nabrat-podpischikov-vk` — Как набрать подписчиков в группу ВКонтакте
- `laiki-vk` — Лайки ВКонтакте: зачем нужны
- `prosmotry-vk-klipty` — Просмотры VK Клипов: как увеличить
- `reposty-vk` — Репосты ВКонтакте: как работают
- `kommentarii-vk` — Комментарии ВКонтакте: продвижение
- `limity-vk` — Лимиты ВКонтакте: безопасность

---

## 3. Глоссарий SMM (20 терминов)

Файл: `src/data/seo/glossary.ts` (SMM, Drip-feed, ER, CTR, Organic Reach, Bot Filter, Refill, Markup, Provider, Quarantine, ETA, Smart Drip, Охват, Вовлечённость, Конверсия, Таргетинг, Контент-план, ROI, LTV, API).

---

## 4. Архитектура связности Hub-and-Spoke
- Каждая cluster-статья ссылается на родительский pillar в начале и конце.
- Родительские pillars имеют перекрестные блоки "Читайте также по теме" со ссылками на все подчинённые кластеры.
- Для кластеров генерируется 4-уровневый хлебные крошки BreadcrumbList: `Главная → База знаний → {Pillar Title} → {Cluster Title}`.
