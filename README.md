<div align="center">

# 🚀 SMMplan & SMMflux Platform (v4.0)

**Enterprise Multi-Tenant Social Media Marketing (SMM) Platform**  
*Построена на Next.js 16 (Turbopack), React 19, Tailwind CSS 4, Prisma 5 & HeroUI v3*

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.20-2d3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)

</div>

---

## 🌟 Ключевые возможности

* 🌐 **Multi-Tenant White-Label:** Обслуживание двух независимых брендов из одной кодовой базы:
  * **SMMplan (`smmplan.pro`):** Строгий B2B SaaS интерфейс в духе *Linear* и *Vercel*.
  * **SMMflux (`smmflux.ru`):** Футуристичный дизайн *Prism Cyberpunk* с выезжающими шторками (*Bottom Sheets*) и пружинной физикой *Framer Motion*.
* 💰 **FinTech Trust Boundary:** Банковский стандарт учета средств в копейках (`BigInt`) с неизменяемым гроссбухом `FinancialLedger` и защитным триггером PostgreSQL.
* ⚡ **Shadow Catalog:** Буферизация 10 000+ услуг внешних поставщиков в Redis с AI-курацией (Cherry-Pick).
* 🧾 **54-ФЗ и Налоговая реформа 2026:** Автоматическая фискализация чеков с поддержкой ставки НДС 22% (ФЗ № 425-ФЗ) и УСН (код 1).
* 🛡️ **Ролевой доступ (RBAC):** Иерархия прав (`OWNER`, `ADMIN`, `FINANCE`, `SUPPORT`, `MARKETER`) и защищенные Server Actions.

---

## ⚡ Быстрый старт (Локальный запуск за 3 минуты)

```bash
# 1. Клонирование репозитория
git clone https://github.com/kiliankaena85-byte/SMMplan.git
cd SMMplan

# 2. Установка зависимостей
npm install

# 3. Подготовка конфигурации (.env)
cp .env.example .env

# 4. Накат структуры БД и сидирование каталога
npx prisma migrate deploy
npx tsx prisma/seed.ts

# 5. Создание учетной записи Администратора
npx tsx scripts/setup-first-admin.ts

# 6. Запуск веб-сервера разработки
npm run dev
```

Откройте в браузере: **`http://localhost:3000`** (Админка: `http://localhost:3000/admin`).

---

## 📚 Подробная документация (Docs)

Все детальные инструкции структурированы по отдельным руководствам:

| Руководство | Описание |
| :--- | :--- |
| 🛠️ [**Руководство по установке (INSTALLATION.md)**](docs/INSTALLATION.md) | Подробная пошаговая установка, системные требования, Docker и решение частых проблем. |
| 👑 [**Настройка Администратора (ADMIN_SETUP.md)**](docs/ADMIN_SETUP.md) | Инструкция по созданию супер-админа, ролям RBAC, генерации Magic Link и сбросу паролей. |
| 🚀 [**Развертывание в продакшен (DEPLOYMENT.md)**](docs/DEPLOYMENT.md) | Деплой на чистый сервер Ubuntu 22.04/24.04, Nginx, Let's Encrypt SSL, Systemd и CI/CD. |
| 🏛️ [**Архитектурный манифест (ARCHITECTURE.md)**](docs/ARCHITECTURE.md) | Глубокий разбор Trust Boundary, финансового гроссбуха, мульти-тенантности и 54-ФЗ. |

---

## ⚙️ Доступные NPM-скрипты

| Команда | Описание |
| :--- | :--- |
| `npm run dev` | Запуск сервера разработки Next.js 16 (Turbopack). |
| `npm run build` | Компиляция оптимизированного продакшен-бандла. |
| `npm start` | Запуск собранного продакшен-сервера. |
| `npm run worker` | Запуск фонового воркера BullMQ (обработка заказов и очередей). |
| `npx tsc --noEmit` | Строгая проверка типов TypeScript (0 ошибок). |
| `npm run lint` | Проверка кода линтером ESLint 10 (Flat Config). |
| `npm run test` | Прогон юнит- и интеграционных тестов Vitest. |
| `npm run bot` | Запуск Telegram-бота платформы. |

---

## 🛡️ Безопасность и содействие проекту

При обнаружении уязвимостей или проблем безопасности, пожалуйста, создайте приватный Issue или свяжитесь с командой разработки.
