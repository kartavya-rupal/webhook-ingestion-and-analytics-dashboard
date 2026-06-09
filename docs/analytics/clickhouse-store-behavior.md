# FinRelay — ClickHouse Store Behavior

## Purpose

ClickHouse is the analytics store for FinRelay.

It should store aggregated reliability metrics, not raw webhook payloads.

---

## Core decision

Use ClickHouse as the read-optimized analytics layer and keep PostgreSQL as the source of truth.

---

## Write model

Analytics data should be written in short intervals or near real time.

The recommended shape for this project is:
- incremental aggregation
- idempotent upserts
- small, frequent writes
- easy backfill support

---

## Table strategy

Use aggregate tables rather than raw event mirrors.

The analytics tables should answer:
- how many events arrived
- how many succeeded
- how many failed
- how many retried
- how many hit DLQ
- how many replays succeeded
- how latency is trending

---

## Engine strategy

Use MergeTree-family tables for the analytics side.

That fits:
- high ingest rates
- large data volumes
- dashboard-friendly reads
- time bucket partitioning
- efficient aggregation queries

---

## Materialized view strategy

Use incremental materialized views where possible.

That keeps the analytics pipeline close to the insert path and avoids expensive full scans for every dashboard query.

---

## Freshness target

The analytics store should be fresh enough for operational dashboards.

Target behavior:
- short interval batch updates, or
- near real-time incremental updates

---

## Backfill support

The analytics layer must be rebuildable from PostgreSQL history.

That means analytics data can be repaired or recomputed if buckets are missing.

---

## Non-goals

Do not use ClickHouse as:
- the source of truth
- raw payload storage
- a replacement for worker state
- a general purpose transaction database

---

## Outcome

This decision makes ClickHouse a clean analytics read layer for FinRelay.