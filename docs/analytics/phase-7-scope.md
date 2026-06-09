# FinRelay — Phase 7 Analytics Scope

## Purpose

Phase 7 adds analytics for operational visibility.

The analytics layer should help operators and maintainers understand:
- webhook volume
- delivery success rate
- failure patterns
- retry behavior
- DLQ movement
- latency trends
- replay outcomes
- endpoint-level reliability
- event-type-level reliability

---

## In Scope

The analytics layer should cover:

- total received events
- succeeded events
- retryable failures
- non-retryable failures
- DLQ events
- replay requests
- replay successes
- replay failures
- p95 latency
- p99 latency
- endpoint performance
- event type performance
- tenant performance
- retry counts
- failure trends over time

---

## Out of Scope

The analytics layer should not attempt:

- data science workflows
- machine learning
- large BI modeling
- general-purpose reporting
- complex marketing analytics
- wide enterprise reporting
- long-running ETL projects
- multi-product dashboards

---

## Principle

Analytics should stay tightly connected to the operational truth of the system.

All analytics should be derived from:
- webhook events
- delivery attempts
- replay jobs
- endpoints
- tenants

The analytics layer should not become a second source of truth.

---

## Success Criteria

Phase 7 is successful when the dashboard can clearly show:
- what is happening
- where failures are happening
- whether retries are working
- whether DLQ is growing
- whether replays are succeeding
- which endpoints and event types need attention