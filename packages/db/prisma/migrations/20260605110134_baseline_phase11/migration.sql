-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'operator', 'viewer');

-- CreateEnum
CREATE TYPE "EndpointStatus" AS ENUM ('active', 'paused', 'disabled');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('received', 'verified', 'persisted', 'queued', 'processing', 'succeeded', 'failed_retryable', 'retry_scheduled', 'failed_non_retryable', 'moved_to_dlq', 'replay_requested', 'replay_processing', 'replay_succeeded', 'replay_failed');

-- CreateEnum
CREATE TYPE "DeliveryAttemptStatus" AS ENUM ('pending', 'succeeded', 'failed', 'retry_scheduled');

-- CreateEnum
CREATE TYPE "DeliveryFailureCategory" AS ENUM ('retryable', 'non_retryable', 'poison');

-- CreateEnum
CREATE TYPE "ReplayStatus" AS ENUM ('requested', 'processing', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "AlertRuleType" AS ENUM ('dlq_spike', 'retry_spike', 'latency_spike', 'failure_burst');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('user', 'system');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "authProviderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endpoint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "EndpointStatus" NOT NULL DEFAULT 'active',
    "eventFilters" JSONB,
    "signingSecretReference" TEXT,
    "retryPolicy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "externalEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadPath" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "rawPayloadSize" INTEGER,
    "requestHeaders" JSONB,
    "requestIp" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "signatureVerifiedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "queueMessageId" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "processingFinishedAt" TIMESTAMP(3),
    "lastAttemptNumber" INTEGER NOT NULL DEFAULT 0,
    "lastFailureReason" TEXT,
    "lastFailureCategory" "DeliveryFailureCategory",
    "nextRetryAt" TIMESTAMP(3),
    "dlqMovedAt" TIMESTAMP(3),
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'received',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "ingestionError" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAttempt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "DeliveryAttemptStatus" NOT NULL DEFAULT 'pending',
    "failureCategory" "DeliveryFailureCategory",
    "responseCode" INTEGER,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "workerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT,
    "filterCriteria" JSONB,
    "requestedBy" TEXT,
    "replayStatus" "ReplayStatus" NOT NULL DEFAULT 'requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ReplayJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleType" "AlertRuleType" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "window" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "actionType" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_providerSlug_key" ON "Endpoint"("providerSlug");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_providerSlug_idx" ON "WebhookEvent"("tenantId", "providerSlug");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_status_nextRetryAt_idx" ON "WebhookEvent"("tenantId", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_externalEventId_idx" ON "WebhookEvent"("tenantId", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_tenantId_dedupeKey_key" ON "WebhookEvent"("tenantId", "dedupeKey");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_eventId_status_idx" ON "DeliveryAttempt"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAttempt_eventId_attemptNumber_key" ON "DeliveryAttempt"("eventId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endpoint" ADD CONSTRAINT "Endpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayJob" ADD CONSTRAINT "ReplayJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayJob" ADD CONSTRAINT "ReplayJob_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
