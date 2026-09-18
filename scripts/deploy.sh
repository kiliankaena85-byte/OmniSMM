#!/bin/bash

# Exit on any error
set -e

echo "🚀 Запуск процесса деплоя Smmplan Lite..."

echo "📥 1. Обновление кода из репозитория..."
git pull origin main

echo "📦 2. Установка зависимостей и сборка Next.js standalone + worker..."
npm ci
npm run build

echo "🏗️ 3. Сборка контейнеров (с кэшем)..."
docker compose -f docker-compose.prod.yml build

echo "🟢 4. Перезапуск инфраструктуры (Up)..."
docker compose -f docker-compose.prod.yml up -d

echo "🗄️ 5. Применение миграций базы данных..."
# Выполняем миграцию внутри сервиса app через compose exec
docker compose -f docker-compose.prod.yml exec -T app ./node_modules/.bin/prisma migrate deploy || docker compose -f docker-compose.prod.yml exec -T app npx prisma migrate deploy

echo "🧹 6. Очистка старых Docker images..."
docker image prune -f

echo "✅ Деплой успешно завершен!"
