-- Миграция всех сущностей с tenantId 'lovable' на 'flux' в существующих таблицах
UPDATE "User" SET "tenantId" = 'flux' WHERE "tenantId" = 'lovable';
UPDATE "Order" SET "tenantId" = 'flux' WHERE "tenantId" = 'lovable';
UPDATE "Ticket" SET "tenantId" = 'flux' WHERE "tenantId" = 'lovable';
UPDATE "Payment" SET "tenantId" = 'flux' WHERE "tenantId" = 'lovable';
UPDATE "Service" SET "tenantId" = 'flux' WHERE "tenantId" = 'lovable';

-- Безопасная очистка тенанта 'lovable'
DELETE FROM "Tenant" WHERE "slug" = 'lovable';
