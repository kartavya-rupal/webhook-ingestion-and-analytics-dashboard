# FinRelay — Search Query Contract

## Purpose

This document defines how the search layer should behave from the operator's point of view.

The search API should support fast incident investigation and safe payload inspection.

---

## Supported Search Inputs

The search layer should support queries by:

- event ID
- external event ID
- tenant ID
- tenant name
- endpoint ID
- endpoint name
- provider slug
- event type
- status
- failure reason
- failure category
- replay status
- attempt number
- payload snippet text
- log message text
- time range

---

## Supported Search Behaviors

The search layer should support:

- exact match
- partial text search
- scoped filtering
- time range filtering
- paging
- newest-first sorting
- severity-first sorting where appropriate

---

## Search Scope Rules

### Event search
Should help operators find:
- webhook events
- lifecycle state
- failure details
- replay count
- attempt count
- payload metadata

### Attempt search
Should help operators find:
- retry attempts
- worker failures
- response codes
- error messages
- duration values

### Replay search
Should help operators find:
- replay jobs
- replay status
- recovery actions
- replay owners
- replay outcomes

### Log search
Should help operators find:
- worker errors
- API errors
- replay failures
- trace-related debugging information

### Payload search
Should help operators find:
- safe payload snippets
- suspicious payload values
- payload-related failure clues

---

## Default Behavior

If the operator provides no special sort order:
- sort by newest first

If the operator searches for failures:
- rank failure-related results higher when possible

If the operator narrows by time range:
- respect the time range across all relevant search types

---

## Paging Rules

Search results must support pagination.

The API should return:
- items
- total count
- page size
- offset or cursor
- next page availability

---

## Safety Rules

Search results must not expose:
- secrets
- signing material
- auth tokens
- raw private headers
- unredacted sensitive payloads by default

Search must stay safe for a fintech environment.

---

## Outcome

A good search contract makes the API predictable and the dashboard easy to build.