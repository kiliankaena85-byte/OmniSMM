---
name: yandex-services-integrator
description: Интеграция фронтенд-сервисов Яндекса (Yandex SmartCaptcha для защиты от ботов, Yandex Metrika/WebVisor для UX-аналитики и Yandex Pay для быстрой оплаты 54-ФЗ).
tags: [yandex, smartcaptcha, yandex-metrika, yandex-pay, anti-fraud, 54-fz, webvisor, analytics]
---

# yandex-services-integrator — Yandex Web Services & Security Standard

## 1. Yandex SmartCaptcha (Защита от ботов)
SmartCaptcha защищает формы регистрации, авторизации, восстановления пароля и оформления заказов от спама и перебора.

### 1.1. Клиентский компонент
```tsx
'use client';

import { SmartCaptcha } from '@yandex/smart-captcha';

export function ProtectedForm() {
  const [token, setToken] = useState<string | null>(null);

  return (
    <form action={myServerAction}>
      <input type="hidden" name="captchaToken" value={token || ''} />
      <SmartCaptcha
        sitekey={process.env.NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY!}
        onSuccess={setToken}
        onTokenExpired={() => setToken(null)}
      />
      <button type="submit" disabled={!token}>Отправить</button>
    </form>
  );
}
```

### 1.2. Серверная проверка токена (Server Action Guard)
```ts
'use server';

export async function verifySmartCaptchaToken(token: string, clientIp?: string): Promise<boolean> {
  const secret = process.env.SMARTCAPTCHA_SERVER_KEY;
  if (!secret || !token) return false;

  try {
    const url = `https://smartcaptcha.yandexcloud.net/validate?secret=${secret}&token=${token}${clientIp ? `&ip=${clientIp}` : ''}`;
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    return data.status === 'ok';
  } catch (err) {
    console.error('SmartCaptcha validation failed:', err);
    return false;
  }
}
```

---

## 2. Yandex Metrika & WebVisor (UX-Аналитика)
- Отслеживание конверсий в корзине и чекауте.
- Тепловые карты кликов и запись сессий WebVisor для оптимизации мобильного визарда.
- Безопасная отправка целей:
```ts
export function reachMetrikaGoal(counterId: number, goalName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).ym) {
    (window as any).ym(counterId, 'reachGoal', goalName, params);
  }
}
```

---

## 3. Yandex Pay (Быстрая оплата)
- Интеграция кнопки быстрой оплаты Yandex Pay.
- Соответствие 54-ФЗ и расчет НДС 2026.
