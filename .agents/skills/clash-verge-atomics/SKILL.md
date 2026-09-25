---
name: clash-verge-atomics
description: Используй этот скилл ВСЕГДА, когда Атомарное управление, глубокая
  диагностика и сетевой инжиниринг клиента Clash Verge Rev и ядра Mihomo
  (Clash.Meta) в среде Windows/Linux. Используй этот скилл ВСЕГДА, когда
  пользователь упоминает Clash Verge, Verge Rev, Mihomo, Clash.Meta,
  проксирование трафика, правила маршрутизации (rules, rule-providers, geosite,
  geoip), TUN-режим (gVisor/system, Wintun), Fake-IP DNS, сбои доступа к
  российским сайтам (.ru, .su, .рф, panel.smmtoolbox.ru, happydesk), сброс
  конфигурации при автообновлении подписки, управление через Windows Named Pipe
  (\\.\pipe\verge-mihomo) или REST API контролл. НЕ применять для верстки React
  компонентов или доменных правил заказов.
---

# Clash Verge Rev & Mihomo Core Atomics — Инженерное Руководство

## 1. Назначение и Зона Ответственности Скилла

`clash-verge-atomics` — это эталонный архитектурный скилл для системных администраторов, DevOps/SRE и разработчиков платформы OmniSMM. Скилл обеспечивает:
- **Атомарное понимание архитектуры Clash Verge Rev**: разделение GUI (Tauri), системной службы (`clash-verge-service`), сетевого ядра (`verge-mihomo`) и каналов IPC (`\\.\pipe\verge-mihomo`).
- **3-уровневую модель Profile Enhancement**: надежная изоляция локальных правил от удаленных подписок Quattro Cloud/любых провайдеров (предотвращение затирания настроек при `update_interval`).
- **Управление Rule Engine**: математически точный порядок First-Match-Wins, дифференциация `DOMAIN`, `DOMAIN-SUFFIX`, `GEOSITE`, `GEOIP`, `RULE-SET`, предотвращение ловушки `mode: global`.
- **Сетевой стек L3/L4/L7**: диагностика TUN-адаптера (Wintun/gVisor), системного прокси (WinINet), Fake-IP пула (`198.18.0.1/16`) и Fallback DNS.
- **Прямое управление через Named Pipe**: горячая реконфигурация ядра на лету без необходимости повышения привилегий до Administrator и без падения системной службы.
- **Суверенный периметр РФ**: гарантированный `DIRECT` маршрут для государственных, банковских и API сервисов РФ при сохранении защищенного VLESS/Shadowsocks туннелирования для внешнего мира.

---

## 2. Архитектура Clash Verge Rev на Атомарном Уровне

Платформа представляет собой 3-звенную модульную систему:

```
┌─────────────────────────────────────────────────────────────────┐
│              Пользовательское Пространство (User Session)       │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │   Clash Verge Rev GUI (Tauri v1/v2 — Rust + WebView2)   │   │
│   │   Процесс: clash-verge.exe (PID ~4380, User: Shadow)    │   │
│   │   Конфиг: %APPDATA%\io.github.clash-verge-rev...        │   │
│   └───────────────────────────┬─────────────────────────────┘   │
│                               │ IPC / Named Pipe                │
└───────────────────────────────┼─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│              Системный Уровень (SYSTEM / Administrator)         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │   Windows Service: clash_verge_service.exe              │   │
│   │   Управляет TUN Wintun интерфейсом и запуском ядра      │   │
│   └───────────────────────────┬─────────────────────────────┘   │
│                               │ Spawns & Supervises             │
│   ┌───────────────────────────▼─────────────────────────────┐   │
│   │   Сетевое Ядро: verge-mihomo.exe (Go, Clash.Meta)       │   │
│   │   - Named Pipe: \\.\pipe\verge-mihomo                   │   │
│   │   - Mixed-Port: 127.0.0.1:7897 (HTTP + SOCKS5)          │   │
│   │   - Redir-Port: 7892 | DNS: 127.0.0.1:53                │   │
│   │   - TUN Adapter: Mihomo (gVisor stack, 198.18.0.1/30)   │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Директория данных (`%APPDATA%\io.github.clash-verge-rev.clash-verge-rev`)
- `verge.yaml`: Глобальные параметры клиента (TUN mode, System Proxy, язык, тема, автозапуск).
- `profiles.yaml`: Реестр профилей, URL подписок, таймеры обновления, связки с расширениями (`option.merge`, `option.rules`).
- `profiles/<uid>.yaml`: Исходный скачанный файл подписки (перезаписывается при обновлении!).
- `profiles/<merge_uid>.yaml`: Модуль слияния профиля (Merge Template).
- `profiles/<rules_uid>.yaml`: Модуль расширения правил профиля (`prepend`, `append`, `delete`).
- `clash-verge.yaml`: Итоговый скомпилированный рантайм-конфиг, передаваемый ядру Mihomo.
- `logs/service/service_latest.log`: Живой журнал маршрутизации и ошибок ядра.

---

## 3. Трехуровневая Модель Profile Enhancement (Защита от Перезаписи)

> ⚠️ **КРИТИЧЕСКИЙ ИНВАРИАНТ**: **НИКОГДА** не редактируй файл удаленной подписки `profiles/<uid>.yaml` напрямую! При следующем цикле обновления (по умолчанию раз в 60 минут) все ваши изменения будут безвозвратно стёрты.

### Механизм компиляции конфигурации:
1. **Base Config (`profiles/<uid>.yaml`)**: Сырой YAML от провайдера подписки.
2. **Merge Template (`mFo3hiyFMILJ.yaml` / `Merge.yaml`)**:
   - Глубокое объединение словарей (Deep Merge).
   - Используется для переопределения корневых настроек: `mode: rule`, `dns:`, `tun:`, `experimental:`.
3. **Rules Template (`rSIXREmWOY5j.yaml`)**:
   - `prepend: [...]`: Вставляет правила **в самое начало списка** (наивысший приоритет).
   - `append: [...]`: Вставляет правила в конец перед `MATCH`.
   - `delete: [...]`: Удаляет нежелательные правила из базовой подписки.

### Пример защищенного правила в `rSIXREmWOY5j.yaml`:
```yaml
# Profile Enhancement Rules Template for Clash Verge

prepend:
  # 1. Точечные критические хосты (First-Match)
  - DOMAIN,panel.smmtoolbox.ru,DIRECT
  - DOMAIN,primelike.happydesk.ru,DIRECT

  # 2. Суффиксы доменов проектов
  - DOMAIN-SUFFIX,smmtoolbox.ru,DIRECT
  - DOMAIN-SUFFIX,happydesk.ru,DIRECT

  # 3. Полный периметр зон РФ и СНГ
  - DOMAIN-SUFFIX,ru,DIRECT
  - DOMAIN-SUFFIX,su,DIRECT
  - DOMAIN-SUFFIX,xn--p1ai,DIRECT       # .рф
  - DOMAIN-SUFFIX,xn--80aswg,DIRECT     # .сайт
  - DOMAIN-SUFFIX,xn--80asehdb,DIRECT   # .онлайн

  # 4. Базы геолокации (Direct без задержек DNS)
  - GEOSITE,category-ru,DIRECT
  - GEOIP,RU,DIRECT,no-resolve

append: []
delete: []
```

---

## 4. Движок Маршрутизации (Rule Engine) и Инварианты

### 1. Инвариант `mode: rule` vs `mode: global`
- В режиме `mode: global`: движок правил **ВЫКЛЮЧЕН**. 100% пакетов направляются в выбранный узел GLOBAL.
- В режиме `mode: rule`: ядро оценивает каждое соединение сверху вниз по списку `rules:`. Первое совпадение побеждает (**First-Match Wins**).
- Фиксация режима в `Merge.yaml`:
  ```yaml
  mode: rule
  ```

### 2. Директива `no-resolve` для `GEOIP`
- Правило `GEOIP,RU,DIRECT` без флага `no-resolve` заставит ядро резолвить IP через DNS **до** оценки правила, вызывая задержку до 2-5 секунд и потенциальную утечку DNS (DNS Leak).
- С флагом `GEOIP,RU,DIRECT,no-resolve` проверка страны происходит только в том случае, если целевой адрес уже является IP-адресом.

---

## 5. Управление через Windows Named Pipe (`\\.\pipe\verge-mihomo`)

Ядро Mihomo в Clash Verge Rev по умолчанию не открывает HTTP-порт контроллера (`external-controller: ''`), но всегда слушает именованный канал Windows: `\\.\pipe\verge-mihomo`.

Канал принимает стандартный протокол **HTTP/1.1 REST API** с авторизацией `Authorization: Bearer set-your-secret`.

### Основные эндпоинты:
| Метод | Эндпоинт | Назначение | Тело запроса |
| :--- | :--- | :--- | :--- |
| `GET` | `/version` | Проверка статуса и версии ядра | — |
| `GET` | `/configs` | Чтение текущей конфигурации | — |
| `PATCH` | `/configs` | Динамическая смена режима | `{"mode": "rule"}` |
| `PUT` | `/configs?force=true` | **Горячая перезагрузка конфигурации** | `{"path": "C:\\path\\clash-verge.yaml"}` |
| `GET` | `/rules` | Просмотр активных правил | — |
| `POST` | `/dns/flush` | Сброс кеша Fake-IP и DNS | — |

---

## 6. Decision Tree Оператора

```
[Пользователь жалуется на сетевой сбой в Clash Verge]
                     │
                     ▼
         1. Запустить scripts/clash-audit.ps1
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
[verge-mihomo не запущен]    [Ядро активно]
       │                           │
       ▼                           ▼
Проверить службу Windows     2. Проверить значение `mode:`
(clash_verge_service)              │
                       ┌───────────┴───────────┐
                       ▼                       ▼
                [mode: global]           [mode: rule]
                       │                       │
                       ▼                       ▼
            Ловушка Global Mode!        3. Проверить совпадение правил
            Переключить в `rule`        в `service_latest.log`
            через Named Pipe / Merge           │
                                       ┌───────┴───────┐
                                       ▼               ▼
                               [using GLOBAL]   [using DIRECT]
                                       │               │
                                       ▼               ▼
                              Правило не попало  Соединение ок,
                              в prepend списка   проверить WAF
                              (добавить в        целевого сайта
                               rules template)
```

---

## 7. Hard Invariants (Железные Инварианты)

1. **Anti-Overwrite Invariant**: Любые пользовательские правила внедряются СТРОГО через модуль расширения `profiles/<rules_uid>.yaml` (`prepend: [...]`). Запрещено модифицировать сырые файлы подписок.
2. **Rule Mode Invariant**: В конфигурации слияния (`Merge.yaml` и `<merge_uid>.yaml`) ОБЯЗАН быть прописан `mode: rule` для блокировки принудительного сброса в `Global` со стороны провайдеров.
3. **Russian Perimeter Invariant**: Все запросы к ресурсам с TLD `.ru`, `.su`, `.рф` и категорийным базам `category-ru` обязаны иметь маркер `DIRECT`, гарантируя отсутствие блокировок со стороны российских WAF/ТСПУ.
4. **Zero-Drop Reload Invariant**: Обновление конфигурации ядра производится на лету через Named Pipe (`PUT /configs?force=true`) без деструктивной перезагрузки фоновой службы Windows.
5. **No-Resolve Guard**: Все географические правила типа `GEOIP` обязаны содержать директиву `no-resolve` во избежание деградации Fake-IP DNS.

---

## 8. Pre-Mortem & Troubleshooting Playbooks

### Плейбук 1: Российский сайт не открывается (ERR_CONNECTION_TIMED_OUT)
- **Симптом**: В логе `service_latest.log` видна запись вида: `[TCP] dial GLOBAL ... --> <target_site>:443 error: i/o timeout`.
- **Причина**: Сайт уходит в зарубежный прокси, который блокируется российским хостингом или Cloudflare WAF.
- **Лечение**:
  1. Добавить `DOMAIN,<target_site>,DIRECT` и `DOMAIN-SUFFIX,<root_domain>,DIRECT` в `prepend:` файла `profiles/<rules_uid>.yaml`.
  2. Синхронизировать с `clash-verge.yaml`.
  3. Отправить сигнал горячей перезагрузки через `scripts/clash-pipe-ctl.ps1 -Action Reload`.

### Плейбук 2: Правила слетели после обновления подписки
- **Симптом**: Пользователь нажал «Обновить подписку» в UI, и доступ к `.ru` сайтам снова пропал.
- **Причина**: Правила были вписаны в `profiles/<uid>.yaml` вместо `profiles/<rules_uid>.yaml`.
- **Лечение**: Перенести правила в секцию `prepend:` соответствующего файла правил расширения, закрепленного в `profiles.yaml` в блоке `option.rules`.

### Плейбук 3: DNS Fake-IP выдает неверные адреса локальной сети
- **Симптом**: Внутренние устройства (`*.lan`, роутер `192.168.1.1`) резолвятся в адреса `198.18.x.x`.
- **Лечение**: Добавить подсеть и доменные маски в `fake-ip-filter` в блоке `dns:` через `Merge.yaml`.

---

## 9. Чеклист Сквозной Верификации

- [ ] Служба `clash_verge_service` и процессы `clash-verge.exe`, `verge-mihomo.exe` запущены.
- [ ] Параметр `mode` равен `rule` (проверено через `GET /configs` в Named Pipe).
- [ ] В `rSIXREmWOY5j.yaml` присутствуют правила `DIRECT` для целевых ресурсов и зоны `.ru`.
- [ ] В `mFo3hiyFMILJ.yaml` и `Merge.yaml` зафиксирован `mode: rule`.
- [ ] В `logs/service/service_latest.log` целевой хост маршрутизируется с маркером `match Domain(...) using DIRECT`.
- [ ] Внешние заблокированные ресурсы продолжают маршрутизироваться с маркером `match Match using Quattro VPN [...]`.

---

## Пошаговый алгоритм выполнения (Step-by-step Protocol)
1. **Шаг 1:** Анализ контекста задачи и определение границ влияния.
2. **Шаг 2:** Проверка соответствия архитектурным инвариантам.
3. **Шаг 3:** Реализация изменений с соблюдением контрактов.
4. **Шаг 4:** Верификация через автоматические тесты и линтеры.
5. **Шаг 5:** Документирование и сохранение точки стабильности.

---

## Предотвращаемые антипаттерны (Gotchas / Bad vs Good)
❌ **Плохо:** Игнорирование архитектурных инвариантов ради быстрой реализации.
- ✅ **Хорошо:** Строгое соблюдение чистоты слоев и контрактов платформы.
❌ **Плохо:** Отсутствие автоматических тестов на граничные условия.
- ✅ **Хорошо:** Покрытие сценариев тестами до выкатки изменений.
