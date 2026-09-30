-- Migration: add_depin_node_target (tables only)
-- BUG-3 Fix: Persist DePIN node credits and targets in PostgreSQL

CREATE TABLE IF NOT EXISTS "DePinNode" (
    "id"                  TEXT         NOT NULL,
    "creditsBalance"      INTEGER      NOT NULL DEFAULT 0,
    "totalCompletedTasks" INTEGER      NOT NULL DEFAULT 0,
    "lastActiveAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "createdAt"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "DePinNode_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DePinNode_creditsBalance_check" CHECK ("creditsBalance" >= 0)
);

CREATE TABLE IF NOT EXISTS "DePinTarget" (
    "id"             TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "channel"        TEXT         NOT NULL,
    "postId"         INTEGER      NOT NULL,
    "targetViews"    INTEGER      NOT NULL,
    "completedViews" INTEGER      NOT NULL DEFAULT 0,
    "tenantId"       TEXT         NOT NULL DEFAULT 'smmplan',
    "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "DePinTarget_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DePinTarget_channel_postId_key" UNIQUE ("channel", "postId"),
    CONSTRAINT "DePinTarget_completedViews_check" CHECK ("completedViews" >= 0),
    CONSTRAINT "DePinTarget_targetViews_check"    CHECK ("targetViews"    > 0)
);

CREATE INDEX IF NOT EXISTS "DePinNode_lastActiveAt_idx"
    ON "DePinNode" ("lastActiveAt" DESC);

CREATE INDEX IF NOT EXISTS "DePinTarget_tenantId_idx"
    ON "DePinTarget" ("tenantId");

CREATE INDEX IF NOT EXISTS "DePinTarget_incomplete_idx"
    ON "DePinTarget" ("completedViews", "targetViews")
    WHERE "completedViews" < "targetViews";
