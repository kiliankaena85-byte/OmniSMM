# Disaster Recovery Runbook (SMMplan 1.0)

**Версия:** 2.0  
**RTO (Recovery Time Objective):** 2 часа  
**RPO (Recovery Point Objective):** 5 минут  
**Владелец:** Incident Commander / DevOps  

---

## 1. Триггеры объявления DR-инцидента

1. **Критический сбой СУБД (PostgreSQL):** Основная база данных недоступна > 15 минут, повреждение диска или потеря данных.
2. **Сбой хостинг-провайдера:** Полная недоступность дата-центра / хостинг-инфраструктуры.
3. **Data Corruption / Ransomware:** Обнаружение несанкционированного изменения или шифрования таблиц.

---

## 2. Роли и зоны ответственности

| Роль | Обязанности |
|---|---|
| **Incident Commander (IC)** | Координирует процесс, принимает финальные решения, фиксирует таймлайн |
| **Database Lead** | Восстановление БД из WAL / PITR бэкапов |
| **DevOps / Infra Lead** | Поднятие инфраструктуры, Docker-контейнеров, Cloudflare Tunnel |
| **Comms Lead** | Коммуникация с клиентами в Telegram и статус-странице |

---

## 3. Пошаговый регламент восстановления

### Шаг 1: Оценка масштаба и изоляция (0-15 мин)
1. Перевести сервис в режим обслуживания:
   ```bash
   # Активация maintenance mode
   curl -X POST http://localhost:3000/api/maintenance-status -d '{"enabled":true}'
   ```
2. Зафиксировать состояние повреждённой базы перед восстановлением:
   ```bash
   pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE -F c -b -v -f /backups/incident-$(date +%Y%m%d%H%M%S).dump
   ```

### Шаг 2: Восстановление PostgreSQL (RTO ≤ 2ч)
1. Выбрать самый свежий валидный снапшот из S3 / изолированного хранилища (`backups/daily/smmplan-*.sql.gz`).
2. Развернуть чистый экземпляр PostgreSQL:
   ```bash
   gunzip -c smmplan-latest.sql.gz | psql -h $NEW_PGHOST -U $PGUSER -d smmplan_restored
   ```
3. Применить WAL-логи (PITR) до точки инцидента.
4. Выполнить проверку целостности:
   ```bash
   npx tsx scripts/dr-restore-test.ts --verify-db
   ```

### Шаг 3: Восстановление Redis и Очередей BullMQ (RTO ≤ 15 мин)
1. Запустить новый Redis instance:
   ```bash
   redis-server /etc/redis/redis.conf --appendonly yes
   ```
2. Перезапустить воркеры с очисткой зависших блокировок:
   ```bash
   npm run worker
   ```

### Шаг 4: Восстановление Next.js App и Cloudflare Tunnel (RTO ≤ 30 мин)
1. Обновить `.env` с новыми реквизитами `$DATABASE_URL` и `$REDIS_URL`.
2. Запустить контейнеры Next.js (`npm run start`).
3. Запустить Cloudflare Tunnel через скрипт `scripts/start-tunnel.ps1`.
4. Проверить healthcheck:
   ```bash
   curl -I https://smmplan.pro/api/health
   ```

---

## 4. Верификация после восстановления (Checklist)

- [ ] `curl -I https://smmplan.pro/api/health` возвращает HTTP 200 OK.
- [ ] Баланс пользователей сходится с последней записью `LedgerEntry`.
- [ ] Воркеры успешно берут задачи из очереди `order-processing`.
- [ ] Вебхуки ЮKassa / Robokassa принимаются без ошибок.
- [ ] Выполнен тестовый заказ на тестовую услугу (Smoke test).

---

## 5. Post-Mortem Протокол

В течение 48 часов после завершения инцидента:
1. Составить Post-Mortem отчёт (хронология, корневая причина 5-Why, что помогло, что замедлило).
2. Зафиксировать уроки в GraphRAG (`POST http://localhost:8100/api/decision`).
3. Провести регламентные корректировки конфигурации бэкапов.
