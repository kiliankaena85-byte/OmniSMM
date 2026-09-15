# 🏢 Руководство по проверке и тестированию мульти-тенантности (Multi-Tenant Protocol)

В проекте реализована строгая мультитенантная архитектура, обслуживающая 2 независимых бренда из единой кодовой базы и базы данных.

---

## 1. Бренды экосистемы

| Бренд | Идентификатор (`tenantId`) | Боевой хост | Дизайн-система и стилистика |
| :--- | :---: | :---: | :--- |
| **SMMplan** | `smmplan` | `smmplan.pro` | **Classic API Enterprise:** Спокойные тона, высокая плотность информации, строгие таблицы и карточки (`<PlanButton>`, `<PlanCard>`). |
| **SMMflux** | `flux` | `smmflux.ru` | **Radiant Aurora:** Неоновый градиентный стиль, карточки со свечением, динамические микроанимации (`<FluxButton>`, `<BorderBeam>`). |

> ⚠️ **Критическое правило:** Бренда Lovable не существует. Алиас `normalizeTenantId('lovable') -> 'flux'` сохранён исключительно для обратной совместимости.

---

## 2. Способы проверки и переключения брендов

### 🔹 Способ 1: Мгновенное переключение в браузере (Dev Switcher)
Для тестировщиков и разработчиков предусмотрены быстрые ссылки переключения активного бренда через Cookie:

* **Включить SMMplan (API):**
  👉 [https://test.smmplan.pro/api/dev/switch-tenant?tenant=smmplan](https://test.smmplan.pro/api/dev/switch-tenant?tenant=smmplan)
* **Включить SMMflux (Aurora):**
  👉 [https://test.smmplan.pro/api/dev/switch-tenant?tenant=flux](https://test.smmplan.pro/api/dev/switch-tenant?tenant=flux)

---

### 🔹 Способ 2: Прямые демонстрационные витрины компонентов (Showcase)
Вы можете открыть эталонные страницы с изолированными дизайн-системами каждого бренда:

* 🏛️ **Демо-витрина SMMplan:** [https://test.smmplan.pro/client-demo/plan](https://test.smmplan.pro/client-demo/plan)
* 🌌 **Демо-витрина SMMflux:** [https://test.smmplan.pro/client-demo/flux](https://test.smmplan.pro/client-demo/flux)

---

### 🔹 Способ 3: Проверка через HTTP-заголовки (cURL / PowerShell)
Бэкенд определяет тенант по входящему заголовку `Host` или `x-tenant-id`.

#### 1. Проверка SMMplan:
```powershell
curl.exe -I -H "Host: smmplan.pro" https://test.smmplan.pro
```
*Что проверить:* В ответе должны быть метатеги `SMMplan` и канонический URL `https://smmplan.pro`.

#### 2. Проверка SMMflux:
```powershell
curl.exe -I -H "Host: smmflux.ru" https://test.smmplan.pro
```
*Что проверить:* В ответе должны быть метатеги `SMMflux` и канонический URL `https://smmflux.ru`.

---

## 3. Чек-лист проверки изоляции данных (Data Isolation Checklist)

При переключении между брендами обязательно проверяются 4 изолированных слоя:

- [ ] **1. Цветовые токены и стили:**
  - SMMplan использует холодные серо-синие оттенки и строгие рамки.
  - SMMflux использует фиолетово-сиреневый акцент (`purple-600`) и карточки со свечением.
- [ ] **2. Каталог и цены:**
  - Кэш каталога изолирован по ключу `catalog-${tenantId}`.
  - Услуги и маржинальность одного бренда не смешиваются с другим.
- [ ] **3. Канонические ссылки (SEO Canonical):**
  - На страницах SMMplan canonical строго: `<link rel="canonical" href="https://smmplan.pro/...">`.
  - На страницах SMMflux canonical строго: `<link rel="canonical" href="https://smmflux.ru/...">`.
- [ ] **4. Балансы и пользователи:**
  - Пользователи привязаны к уникальному составному ключу `email_tenantId`.
  - Баланс пользователя в SMMplan полностью изолирован от его баланса в SMMflux.

---

## 4. Автоматическая валидация через CLI-харнес

Для автоматической проверки кодовой базы на отсутствие нарушений дизайн-токенов запустите:

```powershell
npx tsx scripts/harness/ui-forge.ts validate
```
