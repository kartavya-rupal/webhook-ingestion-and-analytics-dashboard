# FinRelay — Analytics Data Path

## Purpose

This document defines how operational data moves into the analytics layer.

---

## Source of Truth

PostgreSQL remains the source of truth for operational data.

Analytics must be derived from:
- webhook events
- delivery attempts
- replay jobs
- endpoints
- tenants

---

## Recommended Flow

1. API or worker writes operational state to PostgreSQL.
2. Analytics sync job reads new or changed records.
3. Analytics sync job groups the records into hourly or daily buckets.
4. Aggregated rows are written to ClickHouse.
5. Dashboard reads chart data from the API.

---

## Why not write analytics directly in the hot path?

Direct analytics writes during webhook ingestion or worker processing would:
- increase coupling
- slow down the main request path
- make failures harder to isolate
- complicate retries
- make analytics harder to backfill

---

## Recommended Sync Model

Use a small incremental sync model with a watermark:
- last processed timestamp
- last processed ID if needed
- idempotent upserts into ClickHouse

This allows:
- near real-time refresh
- safe retries
- backfill support
- predictable recovery

---

## Backfill Strategy

The analytics path should support backfilling from PostgreSQL.

That means the system can:
- rebuild historical aggregates
- repair missing buckets
- re-run the sync for a date range

---

## Idempotency Rule

Analytics inserts should be idempotent.

The same bucket should always produce the same aggregate row key.

That key should usually include:
- bucket_start_utc
- tenant_id
- endpoint_id
- provider_slug
- event_type

---

## Why this works

This path keeps analytics separate from the hot operational flow while still staying close enough to the source data to be accurate and timely.