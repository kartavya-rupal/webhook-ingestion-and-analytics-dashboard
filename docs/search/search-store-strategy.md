# FinRelay — Search Store Strategy

## Purpose

The search layer is a separate read system for debugging and payload inspection.

It should not replace PostgreSQL or become the source of truth.

---

## Search Store

Use OpenSearch for:
- event search
- attempt search
- replay search
- log search
- payload snippet search
- failure reason search

---

## Store Responsibilities

### PostgreSQL
Owns:
- durable operational state
- event lifecycle records
- retry state
- replay jobs
- endpoint configuration
- tenant data

### S3
Owns:
- raw payload archive
- replay snapshots
- long-term evidence storage

### OpenSearch
Owns:
- searchable operational documents
- failure investigation fields
- text search
- incident query support

---

## Suggested Indices

Start with these indices:

- events index
- attempts index
- replay jobs index
- logs index
- payload snippets index

---

## Indexing Rules

### Idempotency
Indexing must be idempotent.

The same operational record should always map to the same document ID.

### Freshness
New events and failures should appear quickly enough for investigation.

### Backfill
Historical data should be backfillable.

### Separation of concerns
Search should not be the place where core state is updated.

---

## Searchable Fields

Search should support:
- exact IDs
- event types
- statuses
- provider slugs
- endpoint names
- tenant names
- failure reasons
- failure categories
- time ranges
- payload snippets

---

## Non-goals

Do not use search for:
- raw transactional updates
- queue transport
- primary storage
- analytics summaries
- operational metrics

---

## Outcome

This strategy makes search a fast investigation layer while keeping PostgreSQL as the source of truth.