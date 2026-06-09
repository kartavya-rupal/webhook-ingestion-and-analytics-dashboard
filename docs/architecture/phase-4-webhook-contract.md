# FinRelay — Phase 4 Webhook Contract

## Purpose

This document defines the exact webhook contract for the Phase 4 ingestion MVP.

The contract is intentionally small and provider-oriented so the ingest flow stays simple, reliable, and easy to test.

---

## Route

All incoming webhooks will use a provider-specific route:

`POST /webhooks/:provider`

Examples:
- `POST /webhooks/mockpay`
- `POST /webhooks/stripe`
- `POST /webhooks/razorpay`

The `:provider` value must map to a configured endpoint record in the database.

---

## Provider resolution rule

The `:provider` path parameter is the lookup key for the endpoint configuration.

For the MVP:
- provider lookup is provider-specific
- one provider slug maps to one active endpoint configuration
- tenant isolation happens through the endpoint record and related tenant ID

---

## Required headers

Every webhook request must include:

- `x-webhook-signature`
- `x-webhook-timestamp`
- `x-webhook-id`

Optional but recommended:
- `Content-Type: application/json`

---

## Header meanings

### `x-webhook-signature`
Contains the HMAC signature for the request body.

Recommended format:
- `sha256=<hex_signature>`

### `x-webhook-timestamp`
Contains the request timestamp in Unix seconds.

Used to prevent replay attacks and stale requests.

### `x-webhook-id`
Contains the provider-generated event ID.

This is the main idempotency reference for the webhook request.

---

## Signature rules

For the MVP, the signature should be computed as:

`HMAC_SHA256(signing_secret, "${timestamp}.${rawBody}")`

Important:
- use the raw request body bytes
- do not reserialize JSON before verification
- reject the request if the signature does not match

---

## Timestamp freshness rule

The webhook timestamp must be within a fixed allowed skew.

For Phase 4:
- allowed skew: 300 seconds
- requests older than that should be rejected

This prevents replayed or delayed payloads from being accepted as fresh traffic.

---

## Payload format

For Phase 4, the payload is JSON only.

A typical payload may look like:

```json
{
  "id": "evt_12345",
  "type": "payment.succeeded",
  "created_at": "2026-05-21T10:30:00Z",
  "data": {
    "payment_id": "pay_001",
    "amount": 2500,
    "currency": "INR"
  }
}

The payload may include provider-specific nested data, but the following fields are especially important:

id
type
created_at
data
Event type examples

Allowed example event types:

payment.succeeded
payment.failed
refund.created
payout.failed
chargeback.created
settlement.received

The type field should map to one of the system event categories.

Idempotency rule

The request must be deduplicated using a stable dedupe key.

Recommended dedupe input:

tenant ID
provider slug
event ID or fallback payload hash

For the MVP, duplicates should not be queued twice.

Response rules
Success

If the request is verified, archived, persisted, and queued successfully:

return 202 Accepted
Invalid signature
return 401 Unauthorized
Malformed request
return 400 Bad Request
Unknown provider
return 404 Not Found
Duplicate event
return 409 Conflict or a safe idempotent success response, depending on the final route behavior
Internal storage or queue failure
return 503 Service Unavailable
Storage rules

The raw payload must be archived in S3 before the final queued status is returned.

The event record must be written to PostgreSQL.

The queue message should contain a pointer to the archived payload, not the entire raw body.

What is out of scope for Phase 4
retries beyond the initial ingestion path
replay UI
analytics dashboards
OpenSearch integration
ClickHouse integration
full observability dashboards

Phase 4 is only about reliable webhook intake.