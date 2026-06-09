# FinRelay — Phase 11 Security Contract

## Purpose

This document defines the minimum security bar required before launch.

FinRelay must not ship unless the following rules are true:

- tenants can only see their own data
- replay is a privileged action
- signing secrets are never exposed in logs, search, analytics, or the UI
- raw payloads are redacted by default
- requests are protected against replay attacks
- dashboard actions are checked server-side
- rate limits exist on public and sensitive routes
- sensitive actions are audited

---

## Non-negotiable rules

### Tenant isolation
Every request that reads or writes tenant-scoped data must be checked against the authenticated actor’s tenant scope.

### Replay permissions
Replay is allowed only for authorized roles. Replay requests must be validated on the backend.

### Secret handling
Webhook signing secrets, auth secrets, and dashboard secrets must stay out of logs, search indexes, analytics, and client-side output.

### Payload redaction
Raw payload data must be redacted in logs and previews unless a route is explicitly designed for controlled operator inspection.

### Replay attack protection
Webhook requests must be rejected if the timestamp is stale, invalid, or missing, or if the signature cannot be verified.

### Server-side authorization
The frontend may hide controls, but the backend must enforce all permissions.

### Rate limiting
Public and sensitive routes must be rate limited to prevent abuse and accidental overload.

### Auditability
Sensitive actions must generate audit entries with actor, tenant, action, and metadata.

---

## Acceptance criteria

Phase 11 is complete only when:

- tenant mismatches cannot leak data
- replay cannot be triggered by a viewer
- secrets never appear in logs or search
- payload previews are redacted
- webhook signature checks reject bad or stale requests
- forbidden dashboard actions fail on the server
- sensitive actions are recorded in audit logs
- rate limits are active where needed