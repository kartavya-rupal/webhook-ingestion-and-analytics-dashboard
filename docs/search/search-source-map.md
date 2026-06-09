# FinRelay — Search Source Map

## Purpose

This document defines which operational records feed the search layer.

The search layer must be derived from core system data, not from ad hoc duplicates.

---

## Source Data

### 1. WebhookEvent
Main source for:
- event ID search
- external event ID search
- provider search
- status search
- event type search
- dedupe key search
- time range filtering
- lifecycle inspection

Important fields:
- id
- tenantId
- endpointId
- providerSlug
- externalEventId
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
- dedupeKey
- payloadPath
- payloadHash

---

### 2. DeliveryAttempt
Main source for:
- retry investigation
- failure message search
- response code search
- attempt history search
- worker debugging

Important fields:
- id
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
- replay request search
- replay status search
- operator action history
- recovery investigation

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
- endpoint name search
- endpoint URL search
- provider slug search
- tenant scoping

Important fields:
- id
- tenantId
- providerSlug
- name
- url
- status
- retryPolicy
- createdAt
- updatedAt

---

### 5. Tenant
Main source for:
- tenant-level scoping
- multi-tenant filtering
- account-level debugging

Important fields:
- id
- name
- status
- createdAt
- updatedAt

---

### 6. S3 raw payload archive
Main source for:
- safe payload inspection
- payload preview
- payload text extraction
- raw evidence during incidents

Important fields:
- payload object path
- raw payload bytes
- extracted text snippets where needed

---

### 7. Structured logs
Main source for:
- operational failure tracing
- worker debugging
- API debugging
- replay debugging

Important fields:
- timestamp
- service
- level
- message
- eventId
- tenantId
- endpointId
- providerSlug
- attemptNumber
- replayJobId
- error details
- traceId

---

## Ownership Rule

PostgreSQL remains the source of truth.

OpenSearch or search storage is only a derived, searchable read layer.

---

## Search Discipline

Only index data that helps with:
- finding incidents
- inspecting failures
- locating payloads
- tracing retries
- finding replays
- debugging workflow issues