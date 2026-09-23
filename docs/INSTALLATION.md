# 🛠️ Руководство по локальной установке и запуску (Installation Guide)

Добро пожаловать в проект **SMMplan / SMMflux**! Это руководство поможет вам поднять локальное окружение разработки за 5 минут на любой операционной системе (Windows, macOS, Linux).

---

## 📋 1. Системные требования

Перед началом убедитесь, что у вас установлены:
* **Node.js**: `v20.x` или `v22.x` (LTS) — [Скачать Node.js](https://nodejs.org/)
* **Менеджер пакетов**: `npm` (встроен в Node.js) или `pnpm`
* **PostgreSQL**: `v15.x` или `v16.x`
* **Redis**: `v7.x` (для фоновых очередей BullMQ и кэша)
* **Git**: `2.40+`

> [!TIP]
> **Docker вариант:** Если у вас установлен Docker, вы можете поднять PostgreSQL и Redis одной командой:
> ```bash
> docker run -d --name smmplan-pg -p 5433:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=smmplan_dev postgres:16-alpine
> docker run -d --name smmplan-redis -p 6379:6379 redis:7-alpine
> ```

---

## ⚡ 2. Быстрый старт (За 4 шага)

### Шаг 1: Клонирование репозитория
```bash
git clone https://github.com/kiliankaena85-byte/SMMplan.git
cd SMMplan
```

### Шаг 2: Установка зависимостей
```bash
npm install
```
*(При установке автоматически выполнится генерация клиента Prisma `npx prisma generate`).*

### Шаг 3: Настройка переменных окружения
Скопируйте эталонный файл конфигурации:
```bash
# Linux / macOS:
cp .env.example .env

# Windows (PowerShell):
copy .env.example .env
```
*Для локальной разработки дефолтные значения в `.env` уже готовы к работе.*

### Шаг 4: Накат миграций базы данных и сидирование
```bash
# Применение структуры таблиц и неизменяемых триггеров PostgreSQL:
npx prisma migrate deploy

# Заполнение базового каталога услуг и настроек:
npx tsx prisma/seed.ts
```

---

## 👑 3. Создание учетной записи Администратора

Создайте вашего первого супер-администратора с помощью интерактивного мастера:
```bash
npx tsx scripts/setup-first-admin.ts
```
Мастер запросит Email и пароль, либо вы можете передать их аргументами:
```bash
npx tsx scripts/setup-first-admin.ts --email admin@smmplan.pro --password StrongPassword2026! --role OWNER
```

Подробнее о ролях и управлении читайте в [Руководстве Администратора](ADMIN_SETUP.md).

---

## 🚀 4. Запуск приложения

### Запуск веб-сервера (Next.js 16 App Router):
```bash
npm run dev
```
Сервер будет доступен по адресу: **`http://localhost:3000`**

### Запуск фонового воркера (BullMQ — обработка заказов и провайдеров):
В отдельном окне терминала запустите:
```bash
npm run worker
```

---

## 🌐 5. Тестирование двух брендов (Мульти-тенантность)

Проект обслуживает два разных бренда из одной кодовой базы:
1. **SMMplan (API SaaS стиль):** Откройте `http://localhost:3000`
2. **SMMflux (Prism Cyberpunk стиль):** Добавьте в URL параметр `?tenant=flux` или откройте тестовый роут `http://localhost:3000/ab-lovable` (алиас SMMflux).

---

## 🧪 6. Проверка работоспособности и тесты

Чтобы убедиться, что все модули работают без ошибок:
```bash
# 1. Проверка типов TypeScript (должно быть 0 ошибок)
npx tsc --noEmit

# 2. Запуск линтера ESLint 10
npm run lint

# 3. Запуск автоматических юнит- и интеграционных тестов
npm run test
```

---

## ❓ Возможные вопросы (Troubleshooting)

* **Ошибка `ECONNREFUSED 127.0.0.1:5433`**: База данных PostgreSQL не запущена. Проверьте порт в `DATABASE_URL` в вашем `.env`.
* **Ошибка `block_ledger_mutation`**: Это защитный триггер финансовой безопасности. Не редактируйте таблицу `FinancialLedger` вручную через `UPDATE` или `DELETE`.
* **Почта не отправляется локально**: Если SMTP не настроен, ссылки авторизации (Magic Link) и коды подтверждения выводятся прямо в консоль терминала Next.js.
