# FinRelay — Analytics Schema

## Purpose

The analytics schema should store aggregated operational metrics for charts, trends, and comparisons.

It should not duplicate raw webhook payloads or replace PostgreSQL as the source of truth.

---

## Design Principles

- keep rows aggregated
- keep one row per bucket and dimension
- use UTC everywhere
- keep schema narrow and practical
- optimize for dashboard reads
- make data easy to backfill
- keep operational data in PostgreSQL
- keep analytics data in ClickHouse

---

## Core Aggregate Tables

### 1. hourly_event_trends
Purpose:
- overall system health over time

Suggested dimensions:
- bucket_start_utc
- tenant_id
- endpoint_id
- provider_slug
- event_type

Suggested measures:
- total_events
- succeeded_events
- retryable_failures
- non_retryable_failures
- dlq_events
- replay_requests
- avg_latency_ms
- p95_latency_ms
- p99_latency_ms

---

### 2. hourly_endpoint_performance
Purpose:
- endpoint level reliability and latency

Suggested dimensions:
- bucket_start_utc
- tenant_id
- endpoint_id

Suggested measures:
- total_events
- succeeded_events
- failed_events
- retry_events
- dlq_events
- replay_requests
- avg_latency_ms
- p95_latency_ms
- p99_latency_ms

---

### 3. hourly_event_type_performance
Purpose:
- event type level operational patterns

Suggested dimensions:
- bucket_start_utc
- tenant_id
- provider_slug
- event_type

Suggested measures:
- total_events
- succeeded_events
- failed_events
- retry_events
- dlq_events
- replay_requests
- avg_latency_ms
- p95_latency_ms
- p99_latency_ms

---

### 4. daily_replay_summary
Purpose:
- long view of replay behavior

Suggested dimensions:
- bucket_start_utc
- tenant_id
- endpoint_id

Suggested measures:
- total_replay_jobs
- replay_succeeded
- replay_failed
- replay_in_progress

---

### 5. daily_dlq_summary
Purpose:
- long view of poison message behavior

Suggested dimensions:
- bucket_start_utc
- tenant_id
- endpoint_id
- provider_slug
- event_type

Suggested measures:
- total_dlq_events
- top_failure_reason
- retry_exhausted_count

---

## Uniqueness rule

Each row should be unique by:
- bucket start
- tenant
- endpoint
- provider slug
- event type

Only include the dimensions needed for the chart or view.

---

## Why this works

This schema is simple enough to query quickly and detailed enough to support the dashboard views already built in earlier phases.

It keeps analytics separate from the transactional system while still reflecting real operational truth.