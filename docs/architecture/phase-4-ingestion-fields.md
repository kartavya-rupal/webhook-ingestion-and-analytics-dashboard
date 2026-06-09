# FinRelay — Phase 4 Ingestion Fields

## Purpose

This document defines the minimum database fields needed to support webhook ingestion in Phase 4.

The goal is to make the ingestion path debuggable, idempotent, and easy to trace later.

---

## Endpoint changes

The Endpoint model should carry a provider slug so the route can resolve the configuration.

### Required field
- `providerSlug`

### Why
The route `POST /webhooks/:provider` needs a stable lookup key for the configured endpoint.

---

## WebhookEvent changes

The WebhookEvent model should store ingestion metadata in addition to the lifecycle fields that already exist.

### Required or strongly recommended fields

- `providerSlug`
- `signatureVerifiedAt`
- `queuedAt`
- `rawPayloadSize`
- `requestHeaders`
- `requestIp`
- `dedupeKey`
- `queueMessageId`
- `ingestionError`

---

## Field explanations

### `providerSlug`
Snapshot of the provider used at ingestion time.

### `signatureVerifiedAt`
Timestamp showing when signature verification succeeded.

### `queuedAt`
Timestamp showing when the event was handed off to SQS.

### `rawPayloadSize`
Size of the raw body in bytes.

Useful for debugging and future cost analysis.

### `requestHeaders`
JSON snapshot of relevant request headers.

Useful for debugging signature and timestamp issues.

### `requestIp`
Optional source IP of the webhook request.

Useful for operational inspection.

### `dedupeKey`
Stable idempotency key used to prevent double ingestion.

### `queueMessageId`
Identifier returned by SQS after successful enqueue.

### `ingestionError`
Stores the failure reason if ingestion fails before queueing.

---

## Dedupe key rule

The dedupe key should be built from stable identifiers.

Recommended format:

- if external event ID exists:
  `tenantId:providerSlug:externalEventId`

- otherwise:
  `tenantId:providerSlug:payloadHash`

This keeps duplicate protection stable and predictable.

---

## Data ownership rules

- raw payloads stay in S3
- durable event state stays in PostgreSQL
- queue transport stays in SQS
- temporary dedupe state stays in Redis
- ingestion metadata stays in the event row

---

## What not to store in PostgreSQL

Do not store the full raw payload body in PostgreSQL for Phase 4.

Store:
- the S3 payload path
- metadata needed for debugging
- the raw payload hash
- the size
- queue and verification timestamps

---

## Purpose of these fields

These fields exist so later we can answer:

- was the signature valid?
- did the payload reach storage?
- did the payload reach Postgres?
- did the event reach the queue?
- what failed and when?
- which provider sent it?