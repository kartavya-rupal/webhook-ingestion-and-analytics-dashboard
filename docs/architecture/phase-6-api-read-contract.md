# FinRelay — Phase 6 API Read Contract

## Purpose

This document defines the dashboard read model for Phase 6.

The dashboard must read operational data from the API, not directly from PostgreSQL.

---

## Tenant routes

### `GET /api/tenants`
Returns all tenants with summary metadata.

### `GET /api/tenants/:tenantId`
Returns a single tenant with its basic operational context.

### `GET /api/tenants/:tenantId/summary`
Returns tenant-level counts and operational health summary.

---

## Endpoint routes

### `GET /api/endpoints`
Returns all endpoints with health and activity metadata.

### `GET /api/endpoints/:endpointId`
Returns one endpoint with recent event context.

---

## Event routes

### `GET /api/events`
Returns event list data with filters and pagination.

### `GET /api/events/:eventId`
Returns a single event with lifecycle and metadata.

### `GET /api/events/:eventId/attempts`
Returns delivery attempt history for one event.

---

## DLQ routes

### `GET /api/dlq`
Returns dead-letter queue candidates or moved-to-DLQ events.

### `GET /api/dlq/:eventId`
Returns one DLQ event with failure metadata and attempt history.

---

## Replay routes

### `POST /api/events/:eventId/replay`
Creates a replay job for a failed event.

### `GET /api/replay-jobs`
Returns all replay jobs and their statuses.

---

## Response principles

The API should return:
- stable field names
- lifecycle timestamps
- status values that match the schema
- enough metadata for dashboard screens to stay simple

---

## Why this contract exists

The dashboard is only useful if the API returns data in a shape that is easy to render and easy to reason about.

This contract keeps the dashboard aligned with:
- the event lifecycle model
- the delivery attempt model
- the replay model
- the tenant and endpoint ownership model

---

## Notes

The dashboard should not query PostgreSQL directly.
The API remains the read layer for operator views.