# FinRelay — Search Indexing Pipeline

## Purpose

This document defines how operational data enters the search layer.

The search layer should be asynchronous, idempotent, and safe to rebuild.

---

## Pipeline Goals

The indexing pipeline should:

- keep ingestion fast
- keep worker processing fast
- keep search data current
- allow retries on indexing failures
- allow historical backfill
- avoid duplicate documents
- avoid making search the source of truth

---

## Source Events

The pipeline should react to:

- new webhook events
- webhook event updates
- delivery attempt creation
- delivery attempt updates
- replay job creation
- replay job updates
- structured log emission
- payload text extraction where allowed

---

## Pipeline Flow

1. A record is written to PostgreSQL.
2. A searchable representation is produced.
3. The searchable document is sent to the search layer.
4. The document is indexed by stable ID.
5. If the record changes, the same document ID is updated.
6. If indexing fails, the record stays valid in PostgreSQL.
7. The indexing job can be retried later.

---

## Document Identity Rules

Use stable document IDs:

- event document ID = event ID
- attempt document ID = attempt ID
- replay document ID = replay job ID
- log document ID = trace ID plus timestamp or sequence

Stable IDs keep indexing idempotent.

---

## Failure Handling Rules

Search indexing must not block:
- webhook ingestion
- worker processing
- replay creation
- dashboard requests

If search is unavailable:
- keep the operational flow moving
- record the failure
- retry indexing later
- support backfill repair

---

## Payload Handling Rules

Raw payloads should remain in S3.

Search should only receive:
- safe payload snippets
- extracted searchable text
- redacted preview fields
- metadata needed for investigation

Do not index secrets or full unredacted payloads by default.

---

## Backfill Rule

The indexing pipeline must support rebuilding the search layer from PostgreSQL history.

That means the same indexing logic should work for:
- live writes
- retries
- backfill jobs

---

## Outcome

A good indexing pipeline makes search current, safe, and rebuildable without slowing the main product flow.