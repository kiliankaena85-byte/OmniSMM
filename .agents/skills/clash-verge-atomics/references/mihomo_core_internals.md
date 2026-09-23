# Внутреннее Устройство Ядра Mihomo (Clash.Meta)

## 1. Архитектура Ядра

Mihomo (ранее Clash.Meta) — это кроссплатформенный сетевой движок маршрутизации, написанный на языке Go. Ядро работает как прозрачный Layer 3/Layer 4 прокси, агрегирующий сетевые входящие потоки (Inbounds), сопоставляющий их с правилами маршрутизации (Rule Engine) и направляющий их в цепочки исходящих интерфейсов (Outbounds).

```
Входящий Трафик (Inbounds)
├─ Mixed-Port (HTTP / SOCKS5 на 127.0.0.1:7897)
├─ Redir-Port (TCP Redirect на 127.0.0.1:7892)
├─ DNS Hijack (UDP/TCP :53)
└─ TUN Adapter (Wintun / Layer 3 IP TUN, 198.18.0.1/30)
         │
         ▼
DNS Engine (Fake-IP / Direct Resolver)
         │
         ▼
Rule Engine (First-Match Evaluation)
 ├─ DOMAIN / DOMAIN-SUFFIX / DOMAIN-KEYWORD
 ├─ GEOSITE (Binary MRS / Protobuf)
 ├─ GEOIP / IP-CIDR (MaxMind / MetaDB)
 └─ MATCH (Финальный шлюз по умолчанию)
         │
         ▼
Исходящий Трафик (Outbounds)
 ├─ DIRECT (Напрямую через системный шлюз ОС)
 ├─ REJECT (Дроп пакетов)
 └─ PROXY GROUPS (Selector, URL-Test, Fallback, Relay)
      └─ Прокси-ноды (VLESS, VMess, Shadowsocks, Trojan, Hysteria2, TUIC)
```

---

## 2. Стеки TUN Режима: gVisor vs System vs Mixed

В файле `verge.yaml` и рантайм-конфиге ключевое значение имеет параметр:
```yaml
tun:
  enable: true
  stack: gvisor # gvisor | system | mixed
  device: Mihomo
  auto-route: true
  auto-detect-interface: true
  strict-route: true
  dns-hijack:
    - any:53
```

- **gVisor (По умолчанию в Verge Rev)**: Пользовательский сетевой стек от Google (Network Stack в User-Space). Полностью изолирует сетевой стек ОС, предотвращает синие экраны (BSOD) и утечки пакетов при разрыве туннеля, но создает незначительный оверхед на CPU при скоростях выше 500 Мбит/с.
- **System**: Использование нативного стека ядра ОС. Дает максимальную пропускную способность (до 2.5 Гбит/с), но чувствителен к сбоям драйверов сетевых карт.
- **Strict-Route**: Запрещает утечки пакетов мимо виртуального адаптера Wintun. При включенном Strict-Route операционная система не может отправить пакеты в обход TUN, если они не разрешены явно в таблице маршрутизации.

---

## 3. Анатомия DNS Engine: Режим Fake-IP

В конфигурации по умолчанию используется:
```yaml
dns:
  enable: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - "*.lan"
    - "*.local"
    - time.*.com
```

### Принцип работы Fake-IP:
1. Приложение (браузер, Telegram, cURL) отправляет DNS-запрос: `A panel.smmtoolbox.ru`.
2. Ядро Mihomo мгновенно возвращает фиктивный IP-адрес из диапазона `198.18.0.0/16` (например, `198.18.0.52`) без реального ожидания ответа от внешних DNS-серверов.
3. В локальной базе данных `cache.db` фиксируется соответствие: `198.18.0.52 <-> panel.smmtoolbox.ru`.
4. Браузер открывает TCP SYN пакет на адрес `198.18.0.52:443`.
5. TUN-адаптер перехватывает пакет и передает его в ядро.
6. Ядро по таблице сопоставления восстанавливает доменное имя `panel.smmtoolbox.ru` и прогоняет его через **Rule Engine**.
7. Если правило:
   - `DIRECT`: Ядро на лету запрашивает реальный IP у системного DNS и отправляет соединение на реальный сервер без прокси.
   - `PROXY`: Ядро отправляет на удаленный VLESS-прокси доменное имя, а не IP-адрес, гарантируя полное отсутствие DNS-утечек (DNS Leak).
