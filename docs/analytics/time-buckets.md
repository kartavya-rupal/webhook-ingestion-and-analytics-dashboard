# FinRelay — Time Bucket Strategy

## Purpose

This document defines how analytics data should be grouped over time.

---

## Time Standard

Use UTC for all analytics buckets.

Do not mix time zones in charts or aggregates.

---

## Bucket Levels

### Hourly buckets
Use hourly buckets for:
- recent operational charts
- retries
- DLQ growth
- endpoint performance
- event type performance
- short-term trend views

Suggested retention:
- 30 to 60 days

---

### Daily buckets
Use daily buckets for:
- long-term reliability trends
- replay summaries
- DLQ summaries
- tenant comparisons
- endpoint comparisons over time

Suggested retention:
- 180 days or more

---

## Bucket Rules

### Event time source
Use the appropriate source timestamp for each metric:

- receivedAt for incoming event volume
- processedAt for success completion
- processingFinishedAt for worker completion
- dlqMovedAt for poison movement
- createdAt for replay jobs

### Latency source
Latency should be derived from:
- receivedAt → processedAt
- or receivedAt → processingFinishedAt
- or startedAt → finishedAt for worker attempts

### Retry source
Retries should come from:
- DeliveryAttempt rows
- retry_scheduled states
- lastAttemptNumber values

### DLQ source
DLQ metrics should come from:
- moved_to_dlq events
- failed_non_retryable events
- delivery attempt failure categories

---

## Bucket Formula

Bucket start should be stable and deterministic.

Examples:
- hourly bucket = start of the hour in UTC
- daily bucket = start of the UTC day

---

## Why this matters

Correct bucket sizing keeps dashboards fast and useful.

If buckets are too small, charts get noisy.
If buckets are too large, you lose operational detail.

Hourly plus daily gives the right balance for FinRelay.