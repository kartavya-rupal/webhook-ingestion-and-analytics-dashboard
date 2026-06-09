# FinRelay — Phase 5 Failure Taxonomy

## Purpose

This document defines how worker failures are classified in Phase 5.

The goal is to make retry behavior, DLQ handling, and delivery history explicit and predictable.

---

## Failure categories

### Retryable
A temporary problem that might succeed later.

Examples:
- downstream timeout
- transient database issue
- temporary network issue
- temporary dependency failure

### Non retryable
A permanent problem that should not be retried automatically.

Examples:
- unsupported event type
- invalid event format
- missing required resource
- hard validation failure
- business rule rejection

### Poison
A failure that should be isolated because it is no longer safe or useful to keep retrying.

Examples:
- max retry attempts exceeded
- corrupt event that keeps failing
- event causing repeated worker crashes

---

## Default rule

If a failure cannot be confidently proven to be permanent, treat it as retryable first.

This keeps the system resilient without accidentally discarding recoverable events.

---

## Worker behavior by category

### Retryable
- record attempt
- mark event as retryable failure
- schedule retry with backoff

### Non retryable
- record attempt
- mark event as terminal failure
- stop retrying

### Poison
- record attempt
- move event to DLQ
- mark event as moved to DLQ

---

## Why this matters

Without a failure taxonomy, a worker becomes hard to reason about.

With a taxonomy:
- retry logic becomes predictable
- DLQ handling becomes deliberate
- delivery attempts become easier to debug
- operator actions become safer