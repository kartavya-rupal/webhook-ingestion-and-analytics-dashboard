# FinRelay Architecture

## 1. Overview

FinRelay is a fintech operations webhook reliability, observability, analytics, and search platform.

It receives webhook events from external systems, verifies them, stores them safely, processes them asynchronously, handles retries and failures, supports replay, gives operators visibility into event delivery health and trend data, and provides search and payload inspection for incident response.

The system is designed around reliability, replayability, observability, analytics, searchability, and operational control.

The project focuses on fintech-style events such as:
- payment.succeeded
- payment.failed
- refund.created
- payout.failed
- chargeback.created
- settlement.received

---

## 2. Problem Statement

Webhook-driven systems are common in fintech, but they become difficult to manage when:
- events are delivered more than once
- downstream services fail temporarily
- requests time out
- payloads need to be replayed
- failures need auditing
- operators need visibility into delivery behavior
- teams need analytics around retries, latency, failure patterns, and replay success
- teams need to search payloads, logs, failures, and incident clues quickly

FinRelay solves that reliability, observability, analytics, and investigation layer.

---

## 3. Current Status

### Phase 1
Completed foundation setup:
- GitHub repository
- AWS account and IAM setup
- PostgreSQL RDS
- Redis ElastiCache
- S3 raw payload archive
- SQS main queue + DLQ
- ECR repositories
- ECS cluster foundation
- CloudWatch log group
- security groups
- local tooling setup

### Phase 2
Design phase completed:
- scope definition
- service boundaries
- entity model
- event state machine
- retry policy
- replay policy
- roles and permissions
- data ownership
- API surface
- observability map
- deferred items

### Phase 3
Local development setup completed:
- monorepo app skeleton
- shared packages
- Docker Compose local infrastructure
- config and secrets handling
- health and readiness checks
- stable dev workflow
- local documentation

### Phase 4
Webhook ingestion MVP completed:
- public ingest endpoint
- signature verification
- raw payload archival
- dedupe
- queue dispatch
- ingestion metadata tracking

### Phase 5
Async processing and reliability completed:
- worker processing MVP
- retries
- DLQ handling
- replay flow
- delivery attempt logging

### Phase 6
Dashboard and analytics completed:
- operator views
- event timelines
- delivery metrics
- failure trends
- replay controls
- event detail views
- retry history visibility
- dashboard summaries and charts

### Phase 7
Observability and hardening completed:
- traces
- metrics
- logs
- alerts
- role-based access
- production deployment
- analytics validation
- analytics backfill support

### Phase 8
Search and inspection completed:
- event search
- attempt search
- replay search
- log search
- payload preview search
- safe payload inspection
- failure pattern shortcuts
- time range filters
- relevance sorting
- operator workflow documentation

### Current development focus
- ongoing production refinement
- monitoring and maintenance
- operational tuning
- future feature expansion

---

## 4. Phase 1 Infrastructure Foundation

### Provisioned AWS resources
- PostgreSQL RDS instance
- Redis ElastiCache instance
- S3 bucket for raw payload storage
- SQS main processing queue
- SQS dead-letter queue
- ECR repositories for API, worker, and dashboard
- ECS cluster foundation
- IAM roles for ECS
- CloudWatch log group
- security groups

### Local development setup
- Git
- Node.js
- Docker
- AWS CLI
- PostgreSQL client
- project docs and naming conventions

---

## 5. System Goals

### Functional goals
- receive incoming webhook events
- verify event authenticity
- persist raw payloads
- deduplicate repeated events
- queue events for async processing
- process events with worker services
- retry failures with backoff
- isolate poison messages in a DLQ
- replay failed events manually
- expose event delivery analytics
- provide searchable payload and log inspection
- send alerts for abnormal behavior
- provide traceable operational visibility

### Non-functional goals
- reliability
- auditability
- security
- debuggability
- scalability
- observability
- modularity
- clear separation between ingestion, processing, analytics, search, and operator experience

---

## 6. High-Level Event Flow

1. An external fintech system sends a webhook to `POST /webhooks/:provider`.
2. The API ingress layer accepts the request and reads the raw body.
3. The provider slug is resolved against the endpoint configuration.
4. The webhook signature and timestamp are validated.
5. The raw payload is archived in S3.
6. The event is checked for duplicates using Redis and PostgreSQL.
7. The event metadata is written to PostgreSQL.
8. The event is placed onto the SQS main queue.
9. A worker consumes the message.
10. The worker processes the event and updates delivery state.
11. Success or failure is written back to PostgreSQL.
12. Failed events are retried with backoff.
13. Poison messages are moved to the DLQ.
14. The dashboard reads event history, attempts, replay status, analytics summaries, and search results.
15. Metrics, traces, and logs are exported to the observability stack.
16. Alerts are triggered when abnormal conditions are detected.
17. Operators can inspect, search, and replay events from the dashboard.

---

## 7. Service Breakdown

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts

Used for:
- login
- tenant overview
- endpoint management
- event stream
- delivery timeline
- DLQ browser
- replay console
- charts and dashboards
- audit log viewer
- search pages

### API
- Node.js
- TypeScript

Used for:
- webhook ingestion
- signature verification
- endpoint configuration
- replay actions
- alert rules
- auth-protected admin APIs
- data retrieval for dashboard screens
- analytics read endpoints
- search endpoints
- payload inspection endpoints

### Database
- PostgreSQL

Used for:
- tenants
- users
- endpoints
- provider slugs
- signing secrets metadata
- webhook events
- delivery attempts
- retry state
- replay jobs
- alert rules
- audit logs
- endpoint configs
- ingestion metadata

### Cache
- Redis

Used for:
- dedupe keys
- idempotency keys
- rate limiting
- short-lived retry state
- in-flight status
- locks
- quick dashboard lookups

### Queue
- AWS SQS
- DLQ

Used for:
- async processing
- decoupling ingestion from workers
- smoothing spikes
- retry routing
- poison message isolation

### Object storage
- AWS S3

Used for:
- raw payload archival
- replay snapshots
- long-term event storage
- exports
- audit retention

### Analytics
- ClickHouse

Used for:
- latency aggregates
- success/failure rates
- retry counts
- endpoint performance summaries
- event trends
- replay trends
- dashboard charts

### Search
- OpenSearch

Used for:
- payload text search
- failure investigation
- event filtering
- log-style query exploration
- safe payload preview indexing
- incident search and drilldown

### Observability
- OpenTelemetry
- Prometheus
- Grafana
- Loki

Used for:
- traces
- metrics
- logs
- latency charts
- retry charts
- DLQ metrics
- worker health
- alerting dashboards

### Deployment
- Docker
- AWS ECS/Fargate

Used for:
- API container
- worker container
- frontend container
- optional analytics processor container
- optional replay processor container

### CI/CD
- GitHub Actions

Used for:
- linting
- testing
- building Docker images
- pushing images
- deploying to ECS/Fargate

### Auth
- JWT or Clerk or Auth.js

Used for:
- dashboard login
- role-based access control
- replay permissions
- alert configuration access

### Notifications
- Slack
- Email

Used for:
- DLQ spikes
- retry spikes
- latency alerts
- endpoint failure alerts
- replay failure alerts

---

## 8. Service Boundaries

### Ingestion API
Owns:
- receiving webhook requests
- validation
- signature verification
- timestamp freshness checks
- raw payload persistence
- raw payload archival
- dedupe initiation
- queue enqueueing
- fast 2xx response

Must not own:
- heavy business processing
- replay logic
- dashboard logic
- analytics aggregation
- search indexing

### Worker Service
Owns:
- consuming queue messages
- processing webhook events
- writing delivery attempt records
- updating event status
- retry decisions
- failure classification
- DLQ-related recovery support

Must not own:
- public request handling
- UI rendering
- auth/login logic
- raw provider validation
- search UI behavior

### Dashboard Backend
Owns:
- authentication
- event history retrieval
- endpoint management
- retry history retrieval
- DLQ inspection
- replay actions
- analytics summaries
- audit log retrieval
- search APIs
- payload inspection APIs

Must not own:
- public webhook ingestion
- low-level request signature verification
- queue transport handling

### Frontend Dashboard
Owns:
- login
- event timeline view
- endpoint management view
- replay controls
- DLQ browser
- analytics charts
- audit log views
- search and inspection pages

Must not own:
- durable data storage
- queue processing
- signature validation
- worker logic

### Analytics Path
Implemented:
- ClickHouse aggregates
- trend charts
- success/failure summaries
- latency analysis
- retry analysis
- replay analysis

### Search Path
Implemented:
- payload search
- event search
- failed delivery search
- log-style investigation
- filtering by event type or endpoint
- safe payload preview
- incident drilldown

### Observability Path
Implemented:
- traces
- metrics
- logs
- alerting
- dashboards

---

## 9. Core Entities

### Tenant
Represents a business/customer account using the system.

Fields:
- id
- name
- status
- created_at
- updated_at

### User
Represents a dashboard user.

Fields:
- id
- tenant_id
- name
- email
- role
- auth_provider_id
- created_at
- updated_at

### Endpoint
Represents a webhook destination or monitored source.

Fields:
- id
- tenant_id
- provider_slug
- name
- url
- event_filters
- signing_secret_id
- status
- retry_policy
- created_at
- updated_at

### Webhook event
Represents a single incoming webhook payload.

Fields:
- id
- tenant_id
- endpoint_id
- provider_slug
- external_event_id
- event_type
- payload_path
- payload_hash
- raw_payload_size
- request_headers
- request_ip
- dedupe_key
- signature_verified_at
- queued_at
- queue_message_id
- processing_started_at
- processing_finished_at
- last_attempt_number
- last_failure_reason
- last_failure_category
- next_retry_at
- dlq_moved_at
- ingestion_error
- status
- received_at
- processed_at
- replay_count

### Delivery attempt
Represents one attempt to process or forward an event.

Fields:
- id
- event_id
- attempt_number
- status
- failure_category
- response_code
- error_message
- duration_ms
- started_at
- finished_at
- next_retry_at
- worker_name
- created_at

### Replay job
Represents a manual replay action.

Fields:
- id
- tenant_id
- event_id or filter criteria
- requested_by
- replay_status
- created_at
- finished_at

### Alert rule
Represents an operational threshold.

Fields:
- id
- tenant_id
- rule_type
- threshold
- window
- enabled
- created_at

### Audit log
Represents an operator action or system action that should be traceable.

Fields:
- id
- tenant_id
- actor_type
- actor_id
- action_type
- metadata
- created_at

### Analytics record
Represents aggregated reporting data for charts.

Fields:
- id
- tenant_id
- endpoint_id
- time_bucket
- success_count
- failure_count
- retry_count
- avg_latency
- p95_latency
- p99_latency

### Search document
Represents derived, query-friendly records for incident investigation.

Examples:
- event document
- attempt document
- replay document
- log document
- payload preview document

---

## 10. Event Lifecycle States

Proposed event states:
- received
- verified
- persisted
- queued
- processing
- succeeded
- failed_retryable
- retry_scheduled
- failed_non_retryable
- moved_to_dlq
- replay_requested
- replay_processing
- replay_succeeded
- replay_failed

These states should be explicit in the data model so the dashboard can show a clear timeline.

---

## 11. Reliability Patterns Used

- signature verification
- timestamp validation
- deduplication
- idempotent processing
- retry with backoff
- poison message isolation
- dead-letter queue handling
- manual replay
- audit logging
- event archival
- analytics validation
- search indexing
- payload inspection

---

## 12. Observability Patterns Used

- trace propagation using correlation IDs
- API span instrumentation
- queue processing spans
- worker spans
- DB query timing
- failure reason tracking
- Grafana dashboards
- log aggregation in Loki
- metrics collection in Prometheus
- alert routing
- dashboard drilldown
- incident timelines

---

## 13. Analytics Strategy

Transactional data stays in PostgreSQL.

Analytics-friendly aggregates are pushed to ClickHouse.

Examples:
- events per minute
- success rate by endpoint
- failure rate by event type
- retry histogram
- p95 / p99 latency
- DLQ trends
- replay success rate

Analytics validation and backfill are part of the system so aggregates can be trusted and rebuilt when needed.

---

## 14. Search Strategy

OpenSearch is used for:
- full-text search across payloads
- failed event investigation
- event type filtering
- error message lookup
- operator notes
- incident investigation
- payload preview search
- safe payload inspection
- failure pattern search
- time range drilldown

---

## 15. Security Strategy

- tenant isolation
- role-based dashboard access
- signed webhook verification
- timestamp freshness checks
- rate limiting
- encrypted secrets storage
- payload redaction where needed
- restricted replay permissions
- private infrastructure access where possible
- protected payload inspection
- audit logging for sensitive actions

---

## 16. Replay Policy Summary

Replay is operator-driven recovery.

Replay uses:
- the original event record from PostgreSQL
- the original raw payload from S3
- the related endpoint and tenant metadata

Replay must:
- preserve original history
- create a replay job record
- create a new attempt record
- remain auditable
- be permission controlled

Replay states:
- replay_requested
- replay_processing
- replay_succeeded
- replay_failed

---

## 17. Roles and Permissions Summary

### Admin
- full dashboard control
- endpoint management
- alert rule management
- replay permissions
- user and role management
- audit access

### Operator
- inspect events
- inspect retries
- inspect DLQ
- replay events
- view analytics
- view logs
- view audit logs
- search incidents
- inspect payload previews

### Viewer
- read-only access to dashboards
- event summaries
- analytics charts
- limited audit views
- search results with restricted actions

---

## 18. Data Ownership

### Ingestion API owns
- webhook intake
- validation
- raw payload archival
- early state changes
- queue enqueueing

### Worker service owns
- event processing
- delivery attempt records
- retry outcomes
- DLQ classification

### Dashboard backend owns
- read APIs
- replay requests
- endpoint configuration
- alert rules
- audit logs
- analytics queries
- observability summaries
- search APIs
- payload inspection APIs

### PostgreSQL owns
- durable business state

### Redis owns
- temporary fast state

### S3 owns
- raw payloads
- replay snapshots
- archives

### SQS owns
- message transport

### DLQ owns
- poison messages

### ClickHouse owns
- analytics aggregates

### OpenSearch owns
- searchable payloads, failures, and logs

---

## 19. API Surface

### Ingestion API
- POST /webhooks/:provider
- POST /webhooks/:provider/test

### Event APIs
- GET /events
- GET /events/:id
- GET /events/:id/attempts
- GET /events/:id/payload

### Endpoint APIs
- GET /endpoints
- POST /endpoints
- PATCH /endpoints/:id

### Replay APIs
- POST /events/:id/replay
- GET /replay-jobs

### Analytics APIs
- GET /analytics/overview
- GET /analytics/summary
- GET /analytics/trends
- GET /analytics/endpoints
- GET /analytics/event-types
- GET /analytics/replays

### Search APIs
- GET /search/events
- GET /search/attempts
- GET /search/replays
- GET /search/logs
- GET /search/payloads
- GET /search/suggestions

### Alert APIs
- GET /alerts

### Audit APIs
- GET /audit-logs

### Observability APIs
- GET /metrics
- GET /health
- GET /ready

---

## 20. Search and Inspection Workflow

The operator workflow is:

1. search the event
2. open the event detail
3. inspect the safe payload preview
4. read the failure reason
5. inspect the attempts
6. search similar failures
7. check related logs
8. confirm whether replay happened
9. decide whether to replay or investigate upstream

---

## 21. Search Document Principles

Search documents should be:
- derived
- idempotent
- stable by document ID
- safe for incident use
- small and query-friendly
- rebuildable from source systems

---

## 22. Payload Inspection Principles

Payload inspection should:
- keep raw payloads archived separately
- show safe previews by default
- redact secrets and sensitive headers
- allow controlled raw inspection when needed
- stay usable from the dashboard
- avoid mixing archival data with search data

---

## 23. Phase Plan

### Phase 1 ✅ Completed
Foundation setup:
- repo
- docs
- cloud accounts
- naming strategy
- resource inventory
- access strategy

### Phase 2 ✅ Completed
Architecture and planning:
- service boundaries
- entity model
- event state model
- environment variable design
- flow diagrams

### Phase 3 ✅ Completed
Local development setup:
- app skeleton
- Docker setup
- service connectivity
- config strategy
- health checks
- tests
- documentation

### Phase 4 ✅ Completed
Webhook ingestion MVP:
- incoming webhook API
- signature validation
- raw storage
- dedupe
- queue push

### Phase 5 ✅ Completed
Worker and reliability layer:
- async processing
- retries
- DLQ
- replay
- delivery state updates

### Phase 6 ✅ Completed
Dashboard and analytics:
- event list
- event details
- retry history
- replay console
- analytics charts
- operational summaries

### Phase 7 ✅ Completed
Observability and hardening:
- traces
- metrics
- logs
- alerts
- role-based access
- analytics validation
- backfill support
- production deployment

### Phase 8 ✅ Completed
Search and inspection:
- event search
- attempt search
- replay search
- log search
- payload preview search
- safe payload inspection
- failure pattern shortcuts
- time range filters
- relevance sorting
- operator workflow documentation

---

## 24. Success Criteria

The project is successful if it can:
- receive fintech-style webhooks reliably
- avoid duplicate processing
- recover from transient failures
- isolate unrecoverable failures
- support manual replay
- provide usable analytics
- expose searchable operational history
- deploy cleanly in a production-like environment
- support safe payload inspection
- support incident investigation with search and logs
- rebuild analytics and search state when needed
