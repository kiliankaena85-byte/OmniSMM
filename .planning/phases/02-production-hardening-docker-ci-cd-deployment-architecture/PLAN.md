---
objective: Execute Production Hardening and Hybrid Deployment to Ubuntu Server
status: planned
---

# Утвержденный план Фазы 2 (Production Hardening & Hybrid Deploy)

## Этап 1: Подготовка сервера (Ручная настройка)
1. Разработчик должен подключиться к серверу по SSH.
2. Создать директорию `/opt/smmplan_lite`.
3. Создать на сервере файл `/opt/smmplan_lite/.env.production` со всеми ключами API, паролями БД и Yookassa.

## Этап 2: Верификация перед сборкой
1. Запуск `npx tsc --noEmit` для проверки типов.
2. Убедиться, что нет критических ошибок (ESLint / TS).

## Этап 3: Запуск гибридного деплоя
1. Запуск PowerShell-скрипта на машине разработчика:
   `.\scripts\deploy-hybrid.ps1 -ServerHost "user@SERVER_IP" -ServerPath "/opt/smmplan_lite"`
2. Скрипт автоматически:
   - Соберет Docker-образ (linux/amd64).
   - Упакует его в tar-архив.
   - Отправит архив и docker-compose.prod.yml на сервер через SCP.
   - Запустит `docker load` и `docker compose up -d` по SSH.
   - Накатит миграции Prisma (`npx prisma migrate deploy`).

## Этап 4: Настройка HTTPS и проверка
1. На сервере выполнить: `bash scripts/init-letsencrypt.sh` (если домен уже привязан).
2. Проверить статус контейнеров (worker, bot, app, nginx).
