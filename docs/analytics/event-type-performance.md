# FinRelay — Event Type Performance Analytics

## Purpose

This document defines the event-type analytics view for FinRelay.

The goal is to understand how webhook behavior differs by event type.

---

## Core questions

This analytics view should answer:

- Which event types are most common?
- Which event types fail more often?
- Which event types retry the most?
- Which event types move to DLQ the most?
- Which event types are slowest to process?
- Are some event types consistently harder to deliver than others?

---

## Source data

This view should be derived from:
- WebhookEvent
- DeliveryAttempt
- ReplayJob
- Endpoint
- Tenant

---

## Bucket strategy

Use hourly UTC buckets for recent operational insight.

This keeps the dashboard responsive and useful for short-term failure tracking.

---

## Suggested aggregate shape

The analytics output should be grouped by:

- bucket_start_utc
- tenant_id
- provider_slug
- event_type

Suggested measures:
- total_events
- succeeded_events
- retryable_failures
- non_retryable_failures
- dlq_events
- retry_count
- replay_requests
- avg_latency_ms
- p95_latency_ms
- p99_latency_ms

---

## Intended dashboard use

This view should power:
- event type leaderboard cards
- event type failure trend charts
- event type latency charts
- event type comparison tables
- operational investigation into problematic webhook categories

---

## Validation

The event-type aggregates must reconcile with PostgreSQL event data.

If the dashboard says an event type is failing more, that should be visible in the underlying operational records as well.