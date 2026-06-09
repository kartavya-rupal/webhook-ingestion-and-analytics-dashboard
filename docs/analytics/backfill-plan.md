# FinRelay — Analytics Backfill Plan

## Purpose

Backfill allows the analytics layer to be rebuilt from PostgreSQL history.

This is necessary when:
- analytics buckets are missing
- analytics counts are incorrect
- a new analytics table is introduced
- historical charts need to be populated

---

## Inputs

Backfill should read from:
- WebhookEvent
- DeliveryAttempt
- ReplayJob
- Endpoint
- Tenant

---

## Outputs

Backfill should write:
- hourly event trend aggregates
- hourly endpoint performance aggregates
- hourly event type performance aggregates
- daily replay summaries
- daily DLQ summaries

---

## Rules

- Backfill must be idempotent.
- Backfill must support a date range.
- Backfill must not duplicate rows.
- Backfill must be safe to rerun.

---

## Recommended workflow

1. Choose a date range.
2. Read source rows from PostgreSQL.
3. Recompute bucket-level aggregates.
4. Upsert or replace the matching ClickHouse rows.
5. Re-run validation.
6. Confirm analytics and PostgreSQL match.

---

## Backfill priority

Start with:
1. hourly event trends
2. endpoint performance
3. event type performance
4. daily replay summaries
5. daily DLQ summaries