# FinRelay — Analytics API Contract

## Purpose

The API exposes analytics to the dashboard.

The dashboard must not query ClickHouse directly.

---

## Endpoints

### GET /api/analytics/overview
Returns:
- summary
- hourly trend series
- endpoint leaderboard
- event type leaderboard
- replay series

### GET /api/analytics/summary
Returns:
- total events
- success rate
- failure rate
- retry rate
- DLQ rate
- replay success rate
- average latency
- p95 latency
- p99 latency

### GET /api/analytics/trends
Returns:
- hourly event trend series

### GET /api/analytics/endpoints
Returns:
- endpoint performance leaderboard

### GET /api/analytics/event-types
Returns:
- event type performance leaderboard

### GET /api/analytics/replays
Returns:
- daily replay trend series

---

## Query parameters

Supported filters:
- range
- from
- to
- tenantId
- endpointId
- providerSlug

---

## Response principle

The API should return chart-friendly JSON with stable field names.

The dashboard should only need display logic, not analytics logic.