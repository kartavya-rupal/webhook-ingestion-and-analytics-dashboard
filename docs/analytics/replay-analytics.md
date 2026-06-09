# FinRelay — Replay Analytics

## Purpose

This document defines the replay analytics view for FinRelay.

The goal is to understand whether the replay system is helping operators recover failed events successfully.

---

## Core questions

This analytics view should answer:

- How often are replays requested?
- Which tenants trigger the most replays?
- Which endpoints trigger the most replays?
- Which event types are replayed the most?
- Are replays successful?
- Are replays failing?
- How long do replays take?
- How many replays happen after DLQ?
- How many replays happen after retry exhaustion?

---

## Source data

This view should be derived from:
- ReplayJob
- WebhookEvent
- DeliveryAttempt
- Tenant
- Endpoint

---

## Bucket strategy

Use daily UTC buckets for replay summaries.

Replay is important operationally, but daily buckets usually make the trend easier to read.

---

## Suggested aggregate shape

The analytics output should be grouped by:

- bucket_start_utc
- tenant_id
- endpoint_id
- provider_slug
- event_type

Suggested measures:
- total_replay_jobs
- replay_requested
- replay_processing
- replay_succeeded
- replay_failed
- replay_latency_ms
- replay_after_dlq_count
- replay_after_retry_exhaustion_count

---

## Intended dashboard use

This view should power:
- replay trend charts
- replay success rate charts
- replay failure trend charts
- replay latency charts
- replay after-DLQ summaries
- replay after-retry-exhaustion summaries

---

## Validation

Replay analytics must match the replay job records and the related webhook event states.

The replay view is only useful if it reflects real operator recovery behavior.