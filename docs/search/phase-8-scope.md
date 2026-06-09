# FinRelay — Phase 8 Search Scope

## Purpose

Phase 8 adds the search and inspection layer for operational debugging.

The search layer should help operators find failed events, inspect payloads safely, and trace incidents quickly.

---

## In Scope

Phase 8 should support searching by:

- event ID
- external event ID
- tenant
- endpoint
- provider slug
- event type
- status
- failure reason
- failure category
- time range
- replay status
- attempt number
- payload text snippets
- structured log records

---

## Primary Use Cases

The search layer should help operators answer:

- Which event failed?
- Why did it fail?
- Which endpoint was involved?
- Which payload contains the bad data?
- Which time window had trouble?
- Which provider had repeated issues?
- Which events match a failure pattern?
- Which payloads need inspection without opening raw DB rows?

---

## Out of Scope

Phase 8 should not become:

- a generic full-text search engine for the entire product
- a replacement for PostgreSQL
- a duplicate source of truth
- a reporting warehouse
- an analytics layer
- a dashboard metrics system

---

## Boundary Rule

Search should focus on incident investigation and safe payload inspection.

Analytics belongs to Phase 7.

Observability belongs to Phase 7.

Search belongs to finding and inspecting records fast.

---

## Success Criteria

Phase 8 is successful when operators can:
- locate a problematic event quickly
- find similar failures
- inspect payloads safely
- search failure messages
- search logs and attempts
- narrow by time window
- narrow by endpoint or provider