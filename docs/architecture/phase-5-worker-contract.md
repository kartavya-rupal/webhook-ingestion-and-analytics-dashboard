# FinRelay — Phase 5 Worker Contract

## Purpose

This document defines the stable queue message contract used by the worker service.

The worker must not infer message shape from loose JSON. It should only accept a versioned, validated contract.

---

## Message type

Every queue message must declare its type and version.

### Type
`finrelay.webhook_event`

### Version
`1`

---

## Required fields

A valid worker queue message must include:

- `type`
- `version`
- `eventId`
- `tenantId`
- `endpointId`
- `providerSlug`
- `externalEventId`
- `eventType`
- `payloadPath`
- `payloadHash`
- `queuedAtIso`

---

## Why these fields exist

### `eventId`
Primary event record ID in PostgreSQL.

### `tenantId`
Used for tenant ownership and isolation.

### `endpointId`
Used to connect the event back to the configured endpoint.

### `providerSlug`
Stable provider lookup value.

### `externalEventId`
Original provider event ID for idempotency and traceability.

### `eventType`
Business event category.

### `payloadPath`
Pointer to the archived raw payload in S3.

### `payloadHash`
Fingerprint of the raw body for debugging and duplicate detection.

### `queuedAtIso`
Timestamp showing when the event was handed to SQS.

---

## Contract rules

- The queue message is a pointer, not the source of truth.
- Raw payload must remain in S3.
- Durable event state must remain in PostgreSQL.
- The worker should reject unknown message versions.
- The worker should reject messages that do not match the contract.

---

## What the worker is allowed to do

- parse the message
- validate the shape
- load the event from PostgreSQL
- process the event
- write delivery attempts
- update lifecycle state
- retry retryable failures
- move poison events to DLQ

---

## What the worker is not allowed to do

- invent missing fields
- use the queue as storage
- assume an unversioned JSON body is valid
- process the same event blindly twice

---

## Notes

This contract should stay small and stable. If the message shape changes later, the version must change too.