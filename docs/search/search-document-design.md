# FinRelay — Search Document Design

## Purpose

This document defines the shape of searchable records for Phase 8.

The search layer should support incident investigation, payload inspection, failure lookup, and replay tracing.

---

## Design Principles

- one document should represent one searchable unit
- keep documents focused and query-friendly
- include operational metadata first
- keep source-of-truth state in PostgreSQL
- keep raw payloads in S3
- keep search documents derived and disposable
- make document IDs stable and idempotent
- avoid indexing sensitive data unnecessarily

---

## 1. Event Search Document

A single event should be searchable as one document.

### Purpose
Support searches like:
- event ID
- external event ID
- endpoint
- provider slug
- event type
- status
- failure reason
- dedupe key
- time window
- replay count
- attempt count

### Suggested fields
- eventId
- tenantId
- tenantName
- endpointId
- endpointName
- providerSlug
- externalEventId
- eventType
- status
- receivedAt
- processedAt
- lastUpdatedAt
- replayCount
- attemptCount
- lastFailureReason
- lastFailureCategory
- dedupeKey
- requestIp
- payloadHash
- payloadPath
- payloadPreviewText
- headersPreviewText

### Notes
- payloadPreviewText should be a safe searchable excerpt
- headersPreviewText should be redacted if necessary
- raw payload itself should stay in S3

---

## 2. Delivery Attempt Search Document

A single delivery attempt should be searchable as one document.

### Purpose
Support searches like:
- retry history
- failed attempts
- worker debugging
- response code lookup
- error message search

### Suggested fields
- attemptId
- eventId
- tenantId
- endpointId
- providerSlug
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

### Notes
- this document should be easy to sort by attemptNumber or time
- errorMessage should be indexed for failure investigation

---

## 3. Replay Job Search Document

A single replay job should be searchable as one document.

### Purpose
Support searches like:
- replay history
- replay operator lookup
- replay success or failure
- recovery investigation

### Suggested fields
- replayJobId
- tenantId
- eventId
- requestedBy
- replayStatus
- createdAt
- finishedAt
- replayOutcome
- relatedEventType
- relatedProviderSlug
- relatedEndpointId

### Notes
- keep the replay doc focused on operator recovery behavior
- include enough related event metadata for context

---

## 4. Structured Log Search Document

A single structured log line should be searchable as one document.

### Purpose
Support searches like:
- worker failure tracing
- API failure tracing
- replay tracing
- error message search
- trace lookup
- incident timeline reconstruction

### Suggested fields
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
- errorCode
- errorMessage
- traceId
- spanId
- requestId

### Notes
- logs should stay structured
- avoid indexing meaningless free-form noise
- keep the record small and useful

---

## Field Rules

### Fields that should be easy to search
- IDs
- provider slug
- endpoint name
- tenant name
- event type
- status
- failure reason
- failure category
- replay status
- worker name
- error message
- time fields

### Fields that should be redacted or limited
- secrets
- signing material
- raw auth headers
- private tokens
- full raw payloads when unsafe
- any value that could expose credentials

---

## Document Identity Rules

Each document should have a stable ID.

Examples:
- event document ID = eventId
- attempt document ID = attemptId
- replay job document ID = replayJobId
- log document ID = traceId + timestamp + sequence

Stable IDs make indexing idempotent and safe to rerun.

---

## Search Behavior

Search should support:
- exact match
- partial text search
- time range search
- scoped filters
- sorting by newest first
- sorting by failure severity when needed

---

## Non-goals

Do not use search documents as:
- source of truth
- raw archival storage
- analytics warehouse rows
- queue state
- worker state
- a duplicate full database

---

## Outcome

A good search document model makes incident search fast, safe, and predictable.