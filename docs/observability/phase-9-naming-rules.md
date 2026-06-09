# FinRelay — Phase 9 Naming Rules

## Purpose

This document defines the observability vocabulary used across FinRelay.

---

## Span naming rules

Use names that match real workflow steps:
- webhook.ingress
- webhook.signature_verify
- webhook.dedupe
- webhook.s3_write
- queue.publish
- worker.consume
- worker.process
- worker.retry_schedule
- worker.dlq_move
- replay.request
- replay.process
- analytics.job
- search.index

---

## Metric naming rules

Use stable, readable names that map to the workflow:
- requests
- request_duration
- queue_lag
- retry_count
- dlq_count
- replay_duration
- analytics_job_duration
- search_index_duration
- worker_processing_duration

---

## Log field rules

Standardize the following fields:
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

## Alert naming rules

Alert names should describe the actual issue:
- API error spike
- queue lag spike
- retry spike
- DLQ spike
- replay failure spike
- analytics job failure
- search indexing failure

---

## Dashboard panel naming rules

Use names that match the operational lifecycle:
- Ingress health
- Queue health
- Worker health
- Replay health
- Analytics health
- Search health
- DLQ overview
- Retry overview
- Error overview
- Latency overview

---

## Rule

If a name would confuse an operator during an incident, do not use it.