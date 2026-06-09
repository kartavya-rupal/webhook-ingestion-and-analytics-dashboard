# FinRelay — Phase 9 Stack Wiring

## Purpose

This document defines how observability tools are used in FinRelay.

---

## OpenTelemetry

Use OpenTelemetry for:
- distributed traces
- span timings
- correlation IDs
- service-to-service flow visibility

---

## Prometheus

Use Prometheus for:
- counters
- histograms
- gauges
- queue lag
- retry counts
- DLQ counts
- request volume
- error rates
- latency percentiles

---

## Grafana

Use Grafana for:
- service health dashboards
- API latency panels
- worker latency panels
- retry spikes
- DLQ spikes
- replay activity
- analytics job health
- search indexing activity

---

## Loki

Use Loki for:
- searchable structured logs
- correlated logs by trace ID
- service-specific error investigation
- incident timeline reconstruction

---

## Required wiring decisions

Define:
- where each system is configured locally
- where each system receives data
- how the dashboard links traces, metrics, and logs together

---

## Ownership rule

Do not let one observability tool become the source of truth for another.

Each tool should do its own job cleanly.