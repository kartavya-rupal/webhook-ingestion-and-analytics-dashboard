# FinRelay — Operator Workflow

## Purpose

This document describes the normal investigation path an operator should follow when using FinRelay during an incident.

The goal is to make the search, inspection, replay, and failure-analysis flow easy to follow.

---

## Operator workflow

### 1. Search the event
Start by searching for the event using one of these:
- event ID
- external event ID
- endpoint
- provider slug
- failure reason
- payload text
- time range

Use the search page first so the incident can be narrowed quickly.

---

### 2. Open the event detail
Once the right event is found, open the event detail page.

This page should show:
- event metadata
- current status
- timestamps
- attempt timeline
- replay context
- failure clues

---

### 3. Inspect the payload
Check the payload inspection section next.

Look at:
- safe payload preview
- payload hash
- payload path
- request headers
- request IP
- dedupe key

Use the archived payload only when the preview is not enough.

---

### 4. Read the failure reason
Check the last failure reason and failure category.

This tells you whether the issue looks like:
- a signature problem
- a timeout
- an invalid payload
- a downstream failure
- a retryable condition
- a non-retryable condition
- a DLQ case

---

### 5. Inspect the attempts
Open the delivery attempt timeline.

Look for:
- how many attempts happened
- which attempt failed
- the response code
- error message
- worker name
- retry schedule
- attempt duration

This usually shows where the processing path broke.

---

### 6. Search similar failures
Use the failure pattern shortcuts to search for related cases.

Common patterns include:
- signature mismatch
- timeout
- invalid payload
- duplicate event
- downstream unavailable
- response code 500

This helps find recurring incident shapes.

---

### 7. Check related logs
Open the logs view or search logs for the same event, endpoint, or failure clue.

Look for:
- API-level errors
- worker-level errors
- replay errors
- matching timestamps
- repeated error messages
- trace IDs if available

Logs help confirm whether the issue was isolated or systemic.

---

### 8. Confirm whether replay happened
Check whether the event already has replay activity.

Look for:
- replay requested
- replay processing
- replay succeeded
- replay failed

This helps avoid duplicate recovery actions.

---

### 9. Decide whether to replay or investigate upstream
After the event, payload, attempts, similar failures, and logs are reviewed, decide the next action:

- replay the event if the downstream issue looks recovered
- investigate upstream if the payload itself is malformed or incomplete
- investigate the signing or integration setup if authenticity checks failed
- leave it in DLQ if the event is clearly unrecoverable without manual intervention

---

## Decision rules

### Replay is usually reasonable when:
- the failure looks temporary
- the upstream payload is valid
- the endpoint is back online
- the retry path is safe

### Upstream investigation is usually better when:
- signatures do not match
- payloads are malformed
- required fields are missing
- the sender integration is broken
- the same error keeps repeating

### DLQ review is usually needed when:
- the failure is non-retryable
- retries have already been exhausted
- the event is clearly poison data
- manual inspection is required

---

## What the operator should always confirm

Before closing an incident, confirm:
- the exact failure cause
- whether the issue is still active
- whether replay was attempted
- whether replay succeeded
- whether similar events are still failing
- whether more events from the same endpoint need attention

---

## Outcome

A good operator workflow makes FinRelay usable during real incidents.

The goal is not just to find data.
The goal is to move from search to decision without confusion.