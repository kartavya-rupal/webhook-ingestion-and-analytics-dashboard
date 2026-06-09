# FinRelay — First Analytics Pipeline

## Purpose

Build the first operational analytics pipeline for FinRelay.

This pipeline should summarize the system’s core reliability behavior in a way that is useful for the dashboard.

---

## Pipeline scope

The first pipeline should cover:

- total events
- succeeded events
- retryable failures
- non-retryable failures
- DLQ events
- replay requests
- replay successes
- replay failures
- average latency
- p95 latency
- p99 latency

---

## Source records

The pipeline should derive its values from:

- WebhookEvent
- DeliveryAttempt
- ReplayJob
- Endpoint
- Tenant

---

## Time bucket strategy

Use hourly UTC buckets for the first pipeline.

Hourly buckets are the best balance between:
- operational usefulness
- chart readability
- query efficiency
- storage cost

---

## First aggregate target

The first aggregate should be the overall hourly reliability summary.

Suggested metrics:
- event volume
- success count
- failure count
- retry count
- DLQ count
- replay count
- latency percentiles

---

## Computation rules

### Total events
Count events by `WebhookEvent.receivedAt`.

### Success count
Count events with successful terminal states.

### Failure count
Count events in failure states.

### Retry count
Count events with retryable failure states or retry-scheduled states.

### DLQ count
Count events moved to DLQ.

### Replay count
Count replay jobs or replay-requested event transitions.

### Latency
Use the appropriate lifecycle timestamps:
- receivedAt to processedAt
- receivedAt to processingFinishedAt
- startedAt to finishedAt for attempts

---

## Pipeline behavior

The pipeline should:
- read from PostgreSQL
- group values into hourly buckets
- write aggregate rows into ClickHouse
- support idempotent recomputation
- support backfill

---

## Validation rules

The analytics output must be checked against PostgreSQL source counts.

The pipeline is correct only if:
- total counts match source data
- success counts match source data
- failure counts match source data
- DLQ counts match source data
- replay counts match source data

---

## Future expansion

After the first pipeline works, it can be expanded into:
- endpoint-level performance
- event-type-level performance
- tenant-level summaries
- replay trend charts
- latency trend charts