# FinRelay — Phase 11 Sensitive Surfaces

## Purpose

This file lists every route or action that must be protected by tenant isolation, role checks, redaction, replay protection, or audit logging.

---

## Public ingress surfaces

### Webhook ingress
Routes:
- POST /webhooks/:provider
- POST /webhooks/:provider/test

Controls required:
- signature verification
- timestamp freshness validation
- rate limiting
- payload redaction in logs
- no secret leakage

Risk:
- replay attacks
- duplicate submissions
- abuse of the public ingress endpoint

---

## Operator recovery surfaces

### Replay
Routes:
- POST /events/:id/replay
- GET /replay-jobs

Controls required:
- role check
- tenant ownership check
- audit logging
- no cross-tenant replay
- safe logging

Risk:
- unauthorized reprocessing
- accidental cross-tenant action
- hidden audit gaps

---

## Tenant data surfaces

### Events
Routes:
- GET /events
- GET /events/:id
- GET /events/:id/attempts
- GET /events/:id/payload

Controls required:
- tenant filtering
- cross-tenant rejection
- payload redaction
- controlled raw payload inspection

Risk:
- tenant data leakage
- payload exposure
- event enumeration

### Endpoints
Routes:
- GET /endpoints
- GET /endpoints/:id
- POST /endpoints
- PATCH /endpoints/:id

Controls required:
- tenant isolation
- role checks for mutations
- audit logging for changes

Risk:
- endpoint configuration leakage
- unauthorized edits

---

## Search and inspection surfaces

Routes:
- GET /search/events
- GET /search/attempts
- GET /search/replays
- GET /search/logs
- GET /search/payloads
- GET /search/suggestions

Controls required:
- tenant filtering
- payload redaction
- role-based access
- safe result shaping

Risk:
- search-based data leakage
- exposure of secrets or raw payloads

---

## Analytics surfaces

Routes:
- GET /analytics/overview
- GET /analytics/summary
- GET /analytics/trends
- GET /analytics/endpoints
- GET /analytics/event-types
- GET /analytics/replays

Controls required:
- tenant scoping
- aggregation only within allowed scope
- no raw payload exposure
- no secret exposure

Risk:
- cross-tenant trend leakage
- overshared operational data

---

## Audit surfaces

Routes:
- GET /audit-logs

Controls required:
- role-based access
- tenant scope
- immutable records
- sensitive action coverage

Risk:
- audit gaps
- unauthorized audit access

---

## Observability surfaces

Routes:
- GET /metrics
- GET /health
- GET /ready

Controls required:
- safe public exposure
- no secrets
- no tenant data leakage
- no payload leakage

Risk:
- accidental disclosure through metrics or health output

---

## Rule

If a surface can reveal tenant data, secrets, payload contents, replay ability, or operational control, it must be treated as sensitive and enforced on the backend.