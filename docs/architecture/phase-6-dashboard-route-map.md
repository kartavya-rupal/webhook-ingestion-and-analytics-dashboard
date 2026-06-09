# FinRelay — Phase 6 Dashboard Route Map

## Purpose

This document locks the dashboard route structure for Phase 6.

The dashboard should stay aligned with the data model and operational flow already defined in earlier phases.

---

## Public route

### `/login`
Authentication entry point for operators.

---

## Main routes

### `/`
Dashboard overview and health snapshot.

### `/tenants`
Tenant list and tenant-level summary view.

### `/tenants/[tenantId]`
Tenant detail view with endpoint and event context.

### `/endpoints`
Endpoint list and endpoint health view.

### `/events`
Event list, filters, and search entry point.

### `/events/[eventId]`
Event detail page with lifecycle and delivery attempt timeline.

### `/dlq`
Dead-letter queue browser and failure inspection page.

### `/replay-jobs`
Replay job history and replay status page.

---

## Navigation intent

The dashboard navigation should expose the operational workflow in this order:

1. Overview
2. Tenants
3. Endpoints
4. Events
5. DLQ
6. Replay Jobs

---

## Why this route map exists

The dashboard must reflect the system, not invent a separate mental model.

These routes map directly to:
- tenant ownership
- endpoint ownership
- webhook event lifecycle
- delivery attempts
- DLQ inspection
- replay recovery

---

## Notes

This route map is intentionally small for the MVP.

More specialized pages can be added later once the core operator flow is stable.