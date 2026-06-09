# FinRelay — Endpoint Performance Analytics

## Purpose

This document defines the endpoint-level analytics view for FinRelay.

The goal is to understand which endpoints are healthy, which endpoints are noisy, and which endpoints need attention.

---

## Core questions

This analytics view should answer:

- How many events did each endpoint receive?
- Which endpoints fail the most?
- Which endpoints retry the most?
- Which endpoints have the worst latency?
- Which endpoints are contributing to DLQ growth?
- Are failures concentrated in one provider or spread across many endpoints?

---

## Source data

This view should be derived from:
- WebhookEvent
- DeliveryAttempt
- Endpoint
- Tenant

---

## Bucket strategy

Use hourly UTC buckets for this view.

Hourly buckets are useful because endpoint health changes quickly in an operational system.

---

## Suggested aggregate shape

The analytics output should be grouped by:

- bucket_start_utc
- tenant_id
- endpoint_id
- provider_slug

Suggested measures:
- total_events
- succeeded_events
- retryable_failures
- non_retryable_failures
- dlq_events
- retry_count
- avg_latency_ms
- p95_latency_ms
- p99_latency_ms

---

## Intended dashboard use

This view should power:
- endpoint health cards
- endpoint ranking tables
- endpoint failure trend lines
- endpoint latency trend lines
- endpoint detail breakdowns

---

## Validation

The aggregated totals must match PostgreSQL source records.

The analytics output is only valid if it can be traced back to:
- event rows
- attempt rows
- replay rows
- endpoint metadata
- tenant metadata