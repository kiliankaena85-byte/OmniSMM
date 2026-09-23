# YANDEX WEBMASTER SETUP CHECKLIST

**Дата составления:** 28 июля 2026  
**Статус:** 📋 READY FOR MANUAL EXECUTION  

---

### Чеклист ручной настройки в Яндекс.Вебмастере

1. **Регистрация доменов**:
   - [ ] `smmplan.pro` (основной бренд)
   - [ ] `smmflux.ru` (экспресс-бренд)
   - [ ] `lovable.pro` (премиум-бренд)

2. **Подтверждение прав владения**:
   - [ ] Добавить метатег `<meta name="yandex-verification" content="..." />` или разместить DNS TXT-запись.

3. **Отправка файлов Sitemap**:
   - [ ] Отправить `https://smmplan.pro/sitemap.xml`
   - [ ] Отправить `https://smmflux.ru/sitemap.xml`
   - [ ] Отправить `https://smmplan.pro/sitemap.xml`

4. **Проверка файла robots.txt**:
   - [ ] Убедиться в корректности распознавания правил `Disallow` (`/admin`, `/dashboard`, `/operator`, `/api` и т.д.).

5. **Региональность и Счетчики**:
   - [ ] Задать регион «Россия / Москва» для smmplan.pro и smmflux.ru.
   - [ ] Привязать счетчик Яндекс.Метрики к соответствующим сайтам.

6. **Переобход важных страниц (Переобход страниц)**:
   - [ ] `/` (главная)
   - [ ] `/services` (каталог)
   - [ ] `/services/telegram`
   - [ ] `/services/telegram/telegram-subscribers`
   - [ ] `/knowledge`
