# FinRelay — Analytics Source Map

## Purpose

This document defines which operational records feed the analytics layer.

Analytics must be derived from core application data, not from arbitrary logs.

---

## Source Data

### 1. WebhookEvent
Main source for:
- total event volume
- delivery success rate
- failure rate
- retry behavior
- DLQ count
- latency trends
- event type trends
- endpoint trends
- tenant trends

Important fields:
- id
- tenantId
- endpointId
- providerSlug
- eventType
- status
- receivedAt
- processedAt
- processingStartedAt
- processingFinishedAt
- nextRetryAt
- dlqMovedAt
- replayCount
- lastAttemptNumber
- lastFailureCategory
- lastFailureReason

---

### 2. DeliveryAttempt
Main source for:
- retry counts
- per-attempt success or failure
- failure categories
- attempt durations
- worker processing time
- retry exhaustion patterns

Important fields:
- eventId
- attemptNumber
- status
- failureCategory
- responseCode
- errorMessage
- durationMs
- startedAt
- finishedAt
- nextRetryAt
- workerName

---

### 3. ReplayJob
Main source for:
- replay request count
- replay success rate
- replay failure rate
- replay timing
- operator-driven recovery trends

Important fields:
- id
- tenantId
- eventId
- requestedBy
- replayStatus
- createdAt
- finishedAt

---

### 4. Endpoint
Main source for:
- endpoint-level performance
- endpoint health
- endpoint failure comparison
- event routing context

Important fields:
- id
- tenantId
- providerSlug
- name
- status
- retryPolicy
- createdAt
- updatedAt

---

### 5. Tenant
Main source for:
- tenant-level breakdowns
- tenant-level operational trends
- multi-tenant comparisons

Important fields:
- id
- name
- status
- createdAt
- updatedAt

---

## Data Derivation Rules

Analytics should be computed from these records using clear rules:
- event counts come from WebhookEvent
- attempt counts come from DeliveryAttempt
- replay counts come from ReplayJob
- endpoint summaries come from grouped event data
- tenant summaries come from grouped event and attempt data

---

## Important Principle

The analytics layer must stay consistent with the operational system.

If operational data changes, analytics should be able to recompute from source records.