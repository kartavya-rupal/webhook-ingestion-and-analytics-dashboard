# FinRelay — Phase 9 Observability Contract

## Purpose

Phase 9 makes FinRelay measurable end to end.

The system must be traceable across API ingress, storage, queueing, worker processing, retries, DLQ movement, replay, analytics jobs, and search indexing.

---

## What must be measurable

- every webhook request gets a trace ID
- every important service step becomes a span
- every important error is logged with the same trace context
- every worker action can be linked back to the original event
- queue lag is measurable
- retry counts are measurable
- DLQ counts are measurable
- replay duration is measurable
- analytics job duration is measurable
- search indexing duration is measurable

---

## What success looks like

An operator should be able to:
- follow a webhook from ingress to storage to queue to worker to result
- inspect the retry path of a failed event
- inspect the replay path of a recovered event
- see when queue lag increases
- see when DLQ growth spikes
- see when analytics or search jobs fall behind
- correlate logs with traces and metrics using the same identifiers

---

## Required trace context

The following identifiers should be available wherever possible:
- traceId
- spanId
- eventId
- tenantId
- endpointId
- providerSlug
- attemptNumber
- replayJobId
- queueMessageId
- requestId
- serviceName
- errorCategory

---

## Required output types

- traces
- metrics
- structured logs
- dashboards
- alerts

---

## Phase rule

If a step cannot be traced, measured, or correlated, it is not complete for Phase 9.