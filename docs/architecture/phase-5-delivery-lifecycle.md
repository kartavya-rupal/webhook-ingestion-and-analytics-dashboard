# FinRelay — Phase 5 Delivery Lifecycle

## Purpose

This document defines how worker processing should be represented in the database.

The goal is to make event processing, retry behavior, and DLQ movement easy to inspect later.

---

## Event states

The event should be able to move through these states:

- queued
- processing
- succeeded
- failed_retryable
- retry_scheduled
- failed_non_retryable
- moved_to_dlq

---

## Delivery attempt states

Each delivery attempt should be able to show:

- pending
- succeeded
- failed
- retry_scheduled

---

## Additional lifecycle metadata

The database should also record:

- when processing started
- when processing finished
- why the event failed
- whether the failure was retryable
- when the next retry is due
- when the event moved to DLQ
- which attempt number is currently active

---

## Why this matters

Without these fields, the worker would be doing work that is hard to explain later.

With these fields:
- retries can be traced
- DLQ movement can be audited
- worker timing can be measured
- dashboard views can show a proper event timeline

---

## Storage principle

- PostgreSQL stores lifecycle truth.
- Redis may help with short-lived processing locks.
- SQS handles transport.
- The worker updates the database as the source of truth.