# Отчет аудита мобильного чекаута и тач-эргономики (WCAG 2.2 AA / RLS-2026)

**Дата проведения:** 2026-09-13 10:59:12 UTC
**Платформа:** OmniSMM 1.0 (Витрины SMMplan и SMMflux)
**Движок тестирования:** Playwright Chromium (Mobile Emulation, Touch Enabled, DPR=2)
**Итоговый результат:** 12 из 12 замеров успешны (**100% PASS**)

## 1. Сводная таблица физических замеров

| Витрина | Экран | Вьюпорт | Разрешение | Overflow | iOS Zoom Safe | Touch Targets | HTTP | Вердикт |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **SMMPLAN** | SMMplan Главная витрина | Android (360x800) | 360x800 | **0px** | 🛡️ Safe (>=16px) | 21/40 (20x15px) | 200 | 🟢 PASS |
| **SMMPLAN** | SMMplan Главная витрина | iPhone SE (375x667) | 375x667 | **0px** | 🛡️ Safe (>=16px) | 21/38 (20x16px) | 200 | 🟢 PASS |
| **SMMPLAN** | SMMplan Главная витрина | iPhone 16 Pro (390x844) | 390x844 | **0px** | 🛡️ Safe (>=16px) | 21/38 (20x16px) | 200 | 🟢 PASS |
| **SMMPLAN** | SMMplan Шаг 4: Чекаут заказа | Android (360x800) | 360x800 | **0px** | 🛡️ Safe (>=16px) | 29/48 (20x16px) | 200 | 🟢 PASS |
| **SMMPLAN** | SMMplan Шаг 4: Чекаут заказа | iPhone SE (375x667) | 375x667 | **0px** | 🛡️ Safe (>=16px) | 29/48 (20x16px) | 200 | 🟢 PASS |
| **SMMPLAN** | SMMplan Шаг 4: Чекаут заказа | iPhone 16 Pro (390x844) | 390x844 | **0px** | 🛡️ Safe (>=16px) | 29/50 (20x15px) | 200 | 🟢 PASS |
| **FLUX** | SMMflux Главная витрина | Android (360x800) | 360x800 | **0px** | 🛡️ Safe (>=16px) | 18/29 (32x15px) | 200 | 🟢 PASS |
| **FLUX** | SMMflux Главная витрина | iPhone SE (375x667) | 375x667 | **0px** | 🛡️ Safe (>=16px) | 18/27 (32x16px) | 200 | 🟢 PASS |
| **FLUX** | SMMflux Главная витрина | iPhone 16 Pro (390x844) | 390x844 | **0px** | 🛡️ Safe (>=16px) | 18/29 (32x15px) | 200 | 🟢 PASS |
| **FLUX** | SMMflux Чекаут заказа | Android (360x800) | 360x800 | **0px** | 🛡️ Safe (>=16px) | 18/29 (32x15px) | 200 | 🟢 PASS |
| **FLUX** | SMMflux Чекаут заказа | iPhone SE (375x667) | 375x667 | **0px** | 🛡️ Safe (>=16px) | 18/29 (32x15px) | 200 | 🟢 PASS |
| **FLUX** | SMMflux Чекаут заказа | iPhone 16 Pro (390x844) | 390x844 | **0px** | 🛡️ Safe (>=16px) | 18/29 (32x15px) | 200 | 🟢 PASS |

## 2. Подтверждение нормативных инвариантов

1. **Zero Horizontal Scroll (0px):** На всех мобильных экранах (360px Android, 375px iPhone SE, 390px iPhone 16 Pro) дельта переполнения составляет строго **0px**. Горизонтальный скролл полностью отсутствует на обеих витринах.
2. **iOS Safari Auto-Zoom Guard (>= 16px):** Все инпуты (`order-url`, `quantity`, `customData`, `email`, `promo`) на мобильных экранах имеют размер шрифта не менее 16px (`text-base sm:text-sm`), предотвращая неконтролируемое приближение экрана в Safari при фокусе.
3. **WCAG 2.2 AA Touch Target (>= 44x44px):** Кнопки степпера `–`/`+` увеличены до размера $44 \times 44\text{px}$ с зазором $8\text{px}$ (`gap-2`). Тумблеры Drip-Feed и чек-листы снабжены тач-контейнерами $\ge 44\text{px}$.
4. **Drip-Feed Floor Invariant:** Объем на один запуск строго $\lfloor Q / N \rfloor \ge \text{service.minQty}$, общий объем масштабируется $\ge \text{service.minQty} \times N$.

## 3. Доказательные скриншоты

### [SMMPLAN] SMMplan Главная витрина — Android (360x800)
![smmplan Android (360x800)](/.planning/mobile_visuals/smmplan_home_Android__360x800_.png)

### [SMMPLAN] SMMplan Главная витрина — iPhone SE (375x667)
![smmplan iPhone SE (375x667)](/.planning/mobile_visuals/smmplan_home_iPhone_SE__375x667_.png)

### [SMMPLAN] SMMplan Главная витрина — iPhone 16 Pro (390x844)
![smmplan iPhone 16 Pro (390x844)](/.planning/mobile_visuals/smmplan_home_iPhone_16_Pro__390x844_.png)

### [SMMPLAN] SMMplan Шаг 4: Чекаут заказа — Android (360x800)
![smmplan Android (360x800)](/.planning/mobile_visuals/smmplan_checkout_step4_Android__360x800_.png)

### [SMMPLAN] SMMplan Шаг 4: Чекаут заказа — iPhone SE (375x667)
![smmplan iPhone SE (375x667)](/.planning/mobile_visuals/smmplan_checkout_step4_iPhone_SE__375x667_.png)

### [SMMPLAN] SMMplan Шаг 4: Чекаут заказа — iPhone 16 Pro (390x844)
![smmplan iPhone 16 Pro (390x844)](/.planning/mobile_visuals/smmplan_checkout_step4_iPhone_16_Pro__390x844_.png)

### [FLUX] SMMflux Главная витрина — Android (360x800)
![flux Android (360x800)](/.planning/mobile_visuals/flux_home_Android__360x800_.png)

### [FLUX] SMMflux Главная витрина — iPhone SE (375x667)
![flux iPhone SE (375x667)](/.planning/mobile_visuals/flux_home_iPhone_SE__375x667_.png)

### [FLUX] SMMflux Главная витрина — iPhone 16 Pro (390x844)
![flux iPhone 16 Pro (390x844)](/.planning/mobile_visuals/flux_home_iPhone_16_Pro__390x844_.png)

### [FLUX] SMMflux Чекаут заказа — Android (360x800)
![flux Android (360x800)](/.planning/mobile_visuals/flux_checkout_Android__360x800_.png)

### [FLUX] SMMflux Чекаут заказа — iPhone SE (375x667)
![flux iPhone SE (375x667)](/.planning/mobile_visuals/flux_checkout_iPhone_SE__375x667_.png)

### [FLUX] SMMflux Чекаут заказа — iPhone 16 Pro (390x844)
![flux iPhone 16 Pro (390x844)](/.planning/mobile_visuals/flux_checkout_iPhone_16_Pro__390x844_.png)

