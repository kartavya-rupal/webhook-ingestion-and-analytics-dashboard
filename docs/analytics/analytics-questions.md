# FinRelay — Analytics Questions

## Core questions

The analytics layer must answer the following operational questions:

### Volume
- How many events are arriving over time?
- Which tenants are generating the most traffic?
- Which endpoints are receiving the most events?
- Which event types appear most often?

### Reliability
- What percentage of events succeed?
- What percentage fail?
- What percentage need retries?
- What percentage are moved to DLQ?
- Which endpoints fail the most?
- Which event types fail the most?

### Retry Behavior
- Are retry counts increasing?
- Which attempts are most likely to fail?
- Are retries helping or just increasing noise?
- Which events end up exhausting retry attempts?

### DLQ Behavior
- Is the DLQ growing?
- Which endpoints are contributing to DLQ growth?
- Which event types are most likely to become poison events?
- Are poison events isolated quickly?

### Latency
- Is delivery getting slower?
- What is the p95 latency?
- What is the p99 latency?
- Which endpoints have the worst latency?
- Which event types are slowest?

### Replay Behavior
- How often are operators replaying events?
- Are replays usually successful?
- Are replays solving the issue or just repeating the same failure?
- Which tenants or endpoints need replay the most?

---

## Operator value

These questions should help an operator answer:
- where the problem is
- how big the problem is
- whether the system is getting better or worse
- whether recovery actions are working