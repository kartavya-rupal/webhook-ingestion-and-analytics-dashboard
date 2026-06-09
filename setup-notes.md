# FinRelay Setup Notes

This file is a living log of everything created during setup.

---

## 1. Project identity

Project name:
FinRelay

Business domain:
Fintech Operations

Primary use case:
Webhook reliability and analytics for fintech event workflows.

---

## 2. Environments

Planned environments:
- local
- dev
- staging
- prod

Naming convention:
- finrelay-dev-*
- finrelay-staging-*
- finrelay-prod-*

---

## 3. Accounts created

### GitHub
Account/repo:
- TBD

Repository URL:
- TBD

### AWS
Account ID:
- TBD

Primary region:
- TBD

### Observability
Grafana:
- TBD

Prometheus:
- TBD

Loki:
- TBD

### ClickHouse
Instance/host:
- TBD

### OpenSearch
Instance/host:
- TBD

---

## 4. Resource inventory

| Resource | Type | Environment | Purpose | Status |
|---|---|---:|---|---|
| finrelay-db | PostgreSQL | dev | transactional database | TBD |
| finrelay-redis | Redis | dev | fast cache/state | TBD |
| finrelay-raw-bucket | S3 | dev | raw event archival | TBD |
| finrelay-main-queue | SQS | dev | event processing queue | TBD |
| finrelay-dlq | SQS DLQ | dev | poison messages | TBD |
| finrelay-ecr-api | ECR | dev | API image store | TBD |
| finrelay-ecr-worker | ECR | dev | worker image store | TBD |
| finrelay-ecr-web | ECR | dev | frontend image store | TBD |
| finrelay-ecs-cluster | ECS/Fargate | dev | runtime cluster | TBD |

---

## 5. Access decisions

### Root access
- MFA enabled: TBD
- root usage restricted: TBD

### IAM
- admin user/role created: TBD
- service roles planned: TBD

### Public access
- S3 public access blocked: TBD
- dashboard public exposure decision: TBD
- webhook endpoint public exposure decision: TBD

### Secrets
- stored in Secrets Manager / Parameter Store: TBD
- no hardcoded secrets in repo: yes

---

## 6. Domain decisions

Chosen event types:
- payment.succeeded
- payment.failed
- refund.created
- payout.failed
- chargeback.created
- settlement.received

Chosen dashboard roles:
- Admin
- Operator
- Viewer

Chosen replay scope:
- single event replay
- event-type replay
- date-range replay

---

## 7. Reliability decisions

Planned retry policy:
- max retries: TBD
- backoff strategy: TBD
- DLQ threshold: TBD

Planned idempotency strategy:
- event ID based dedupe
- Redis TTL dedupe keys
- unique database constraints

---

## 8. Observability decisions

Metrics planned:
- event ingest rate
- success rate
- failure rate
- retry count
- DLQ count
- latency percentiles
- replay success rate

Logs planned:
- API request logs
- worker logs
- delivery attempt logs
- replay logs

Traces planned:
- ingress span
- queue dispatch span
- worker processing span
- replay span

---

## 9. Today’s setup log

Date:
TBD

What was completed today:
- TBD

What remains:
- TBD

---

## 10. Notes for later

- Keep the system focused on fintech webhooks only.
- Avoid generic SaaS webhook handling features in the first version.
- Keep the first MVP small enough to finish cleanly.
- Treat Postgres as the source of truth.
- Use ClickHouse only for analytics.
- Use OpenSearch only for search and investigation.
- Keep dashboard features operator-focused, not consumer-focused.
