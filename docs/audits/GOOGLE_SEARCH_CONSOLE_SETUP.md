# GOOGLE SEARCH CONSOLE SETUP CHECKLIST

**Дата составления:** 28 июля 2026  
**Статус:** 📋 READY FOR MANUAL EXECUTION  

---

### Чеклист ручной настройки в Google Search Console

1. **Регистрация Domain Property**:
   - [ ] Зарегистрировать ресурсовый домен `smmplan.pro`
   - [ ] Зарегистрировать ресурсовый домен `smmflux.ru`
   - [ ] Зарегистрировать ресурсовый домен `lovable.pro`

2. **Подтверждение DNS**:
   - [ ] Разместить DNS TXT-записи для проверки прав доступа.

3. **Отправка файлов Sitemap**:
   - [ ] Добавить в разметку карту `https://smmplan.pro/sitemap.xml`
   - [ ] Добавить карту `https://smmflux.ru/sitemap.xml`
   - [ ] Добавить карту `https://lovable.pro/sitemap.xml`

4. **Проверка Index Coverage**:
   - [ ] Убедиться в отсутствии ошибок 5xx/4xx.
   - [ ] Убедиться, что закрытые через `noindex` страницы категории с Quality Gate Fail не вызывают тревожных алертов.

5. **Проверка Core Web Vitals и Mobile Usability**:
   - [ ] Проверить зеленую зону показателя LCP (< 2.5s) и INP (< 200ms).
   - [ ] Подтвердить валидность отображения на мобильных устройствах (viewport-fit=cover).

6. **Проверка Микроразметки (Rich Results Test)**:
   - [ ] Проверить валидность схем `BreadcrumbList`, `Service`, `Offer`, `FAQPage`, `Organization`, `WebSite`.
