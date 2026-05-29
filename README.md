# FinRelay

FinRelay is a fintech-focused webhook reliability and analytics platform.

It receives incoming webhook events from external systems, verifies their authenticity, stores the raw payload safely, queues processing asynchronously, retries failures with backoff, isolates poison messages in a dead-letter queue, and exposes delivery health through an operator dashboard.

## What problem it solves

In real fintech workflows, webhook delivery is often unreliable at scale. Events may arrive more than once, be delayed, fail temporarily, or fail permanently because of downstream issues.

FinRelay helps teams:
- ingest webhook events safely
- verify signatures and freshness
- prevent duplicate processing
- retry transient failures
- route poison events into a DLQ
- replay failed events from a dashboard
- view reliability metrics and failure trends
- inspect payloads, attempts, and traces

## Domain

Fintech operations

Example event types:
- payment.succeeded
- payment.failed
- refund.created
- payout.failed
- chargeback.created
- settlement.received

## High-level architecture

Webhook source → API ingress → signature verification → raw storage → dedupe → queue → worker processing → transactional state update → archival → analytics indexing → search indexing → observability → alerts → replay console

## Core stack

### Application stack
- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Recharts
- API: Node.js, TypeScript
- Auth: JWT / Clerk / Auth.js

### Data and messaging stack
- Main DB: PostgreSQL
- Cache: Redis
- Queue: AWS SQS + DLQ
- Storage: AWS S3

### Infrastructure and delivery stack
- Deployment: Docker, AWS ECS/Fargate
- CI/CD: GitHub Actions
- Notifications: Slack / Email

### Observability and future analytics stack
- Observability: OpenTelemetry, Prometheus, Grafana, Loki
- Analytics: ClickHouse
- Search: OpenSearch

## Current infrastructure

Provisioned AWS resources:
- RDS PostgreSQL instance
- ElastiCache Redis instance
- S3 archival bucket
- SQS processing queue
- SQS dead-letter queue
- ECR repositories for:
  - API service
  - Worker service
  - Dashboard service
- ECS cluster foundation
- CloudWatch log group
- IAM roles and security groups

Configured environments:
- Local development
- AWS dev environment

Region:
- ap-south-1 (Mumbai)

## What is already complete

### Phase 1 ✅ Completed
Foundation setup:
- repository initialization
- AWS account and IAM setup
- naming conventions
- infrastructure provisioning
- resource inventory
- PostgreSQL setup
- Redis setup
- S3 setup
- SQS + DLQ setup
- ECR repositories
- ECS foundation
- architecture documentation

### Phase 2 ✅ Completed
Architecture and planning:
- scope definition
- service boundaries
- entity model
- event lifecycle mapping
- retry policy
- replay policy
- roles and permissions
- data ownership
- API surface
- observability map
- deferred items

### Phase 3 ✅ Completed
Local development setup:
- monorepo app skeleton
- shared packages
- Docker Compose local infrastructure
- config and secrets handling
- health and readiness checks
- stable dev workflow
- local documentation

### Phase 4 ✅ Completed
Webhook ingestion MVP:
- public ingest endpoint
- signature verification
- raw event storage
- dedupe
- queue dispatch
- ingestion metadata tracking

### Phase 5 ✅ Completed
Async processing and reliability:
- worker service
- retries
- DLQ
- replay flow
- delivery attempt logging

### Phase 6 ✅ Completed
Dashboard and analytics:
- operator views
- event timelines
- delivery metrics
- failure trends
- replay controls
- event details screens
- retry history visibility
- dashboard charts and summaries

## Planned future integrations

The following services are planned for later phases and are intentionally deferred during early development to reduce infrastructure cost and complexity:

- ClickHouse
- OpenSearch
- Grafana
- Loki
- Prometheus

## Phase plan

### Phase 1 ✅ Completed
Foundation setup:
- repository initialization
- AWS account and IAM setup
- naming conventions
- infrastructure provisioning
- resource inventory
- PostgreSQL setup
- Redis setup
- S3 setup
- SQS + DLQ setup
- ECR repositories
- ECS foundation
- architecture documentation

### Phase 2 ✅ Completed
Documentation and architecture:
- scope definition
- system design
- entity mapping
- event lifecycle mapping
- retry policy
- replay policy
- access model
- data ownership
- API surface
- observability mapping

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
- public ingest endpoint
- signature verification
- raw event storage
- dedupe
- queue dispatch
- event status tracking

### Phase 5 ✅ Completed
Async processing and reliability:
- worker service
- retries
- DLQ
- replay flow
- delivery attempt logging

### Phase 6 ✅ Completed
Dashboard and analytics:
- operator views
- event timelines
- delivery metrics
- failure trends
- replay controls

### Phase 7
Observability and hardening:
- traces
- metrics
- logs
- alerts
- role-based access
- production deployment

## Current status

Phase 1 foundation setup completed.  
Phase 2 architecture and planning completed.  
Phase 3 local development setup completed.  
Phase 4 webhook ingestion MVP completed.  
Phase 5 async processing and reliability completed. 
Phase 6 dashboard and analytics completed.
Next focus: observability and hardening.

## Notes

This project is intentionally scoped as a focused, production-style fintech operations system rather than a general-purpose webhook company clone.
