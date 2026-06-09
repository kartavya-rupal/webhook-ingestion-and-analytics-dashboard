# FinRelay — Phase 9 Trace Propagation

## Purpose

This document defines how trace context moves through FinRelay.

---

## Propagation rule

If one action starts in the API, worker, replay job, analytics job, or search job, the rest of the system should be able to reference the same trace lineage.

---

## Required propagation path

Carry trace context through:
- incoming HTTP requests
- S3 archival write
- PostgreSQL write
- Redis dedupe
- SQS publish
- worker consume
- delivery attempts
- replay requests
- analytics jobs
- search indexing jobs

---

## Context fields to propagate

- traceId
- spanId
- eventId
- tenantId
- endpointId
- providerSlug
- attemptNumber
- replayJobId
- queueMessageId
- requestId
- serviceName
- errorCategory

---

## Storage rule

Store trace IDs wherever they help with later inspection:
- logs
- queue metadata where appropriate
- replay metadata where appropriate
- analytics job metadata where appropriate
- search indexing job metadata where appropriate

---

## Child span rule

Each downstream step should create a child span rather than breaking the original trace.

---

## Logging rule

Logs should always include trace context fields when they are available.

---

## Replay rule

A replay may inherit the original event lineage or create a child trace, but the relationship must be visible in logs and metadata.