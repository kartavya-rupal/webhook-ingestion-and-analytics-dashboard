# FinRelay Service Map

This file maps every major service or tool to its responsibility in the system.

---

## Frontend

### Next.js
Primary UI framework for the operator dashboard.

### TypeScript
Adds type safety to UI and frontend logic.

### Tailwind CSS
Used for styling.

### shadcn/ui
Used for reusable UI components.

### Recharts
Used for analytics and operational charts.

---

## Backend

### Node.js
Runtime for API and worker services.

### TypeScript
Used for type-safe backend development.

---

## Data stores

### PostgreSQL
System of record for transactional data.

Stores:
- tenants
- users
- endpoints
- webhook events
- delivery attempts
- replay jobs
- alert rules
- audit logs

### Redis
Fast state and coordination layer.

Stores:
- dedupe keys
- idempotency keys
- locks
- short-lived retry state
- rate limit counters
- quick status lookups

### ClickHouse
Analytics store for metrics-heavy queries.

Stores:
- aggregate delivery records
- latency data
- success/failure trends
- replay trends
- endpoint performance summaries

### OpenSearch
Search and investigation layer.

Stores:
- searchable event payload text
- failure logs
- operator notes
- incident queries
- event lookup indexes

---

## Messaging

### AWS SQS
Primary async queue for event processing.

### DLQ
Holds poison messages and unrecoverable failures.

---

## Object storage

### AWS S3
Stores:
- raw webhook payload archives
- replay snapshots
- exports
- long-term event archives

---

## Observability

### OpenTelemetry
Captures traces and metrics across API and worker services.

### Prometheus
Collects metrics.

### Grafana
Visualizes metrics and operational dashboards.

### Loki
Aggregates and searches logs.

---

## Infrastructure

### Docker
Containerizes services for local and cloud deployment.

### AWS ECS/Fargate
Runs the API, worker, and frontend containers in a production-like environment.

### GitHub Actions
Runs tests, builds images, and deploys services.

### ECR
Stores Docker images.

### Secrets Manager / Parameter Store
Stores secrets and configuration values.

### Nginx / API Gateway
Handles routing and edge-level protection if needed.

---

## Authentication and access

### JWT
Authentication mechanism for dashboard access.

### Clerk
Optional managed auth provider.

### Auth.js
Optional auth library for dashboard login and roles.

---

## Notifications

### Slack
Used for operational alerts.

### Email
Used for operational alerts and incident notifications.

---

## Data flow mapping

Webhook source
→ API ingress
→ signature verification
→ raw persistence in PostgreSQL/S3
→ dedupe in Redis/Postgres
→ queue in SQS
→ worker processing
→ status updates in PostgreSQL
→ analytics in ClickHouse
→ search indexing in OpenSearch
→ traces in OpenTelemetry
→ metrics in Prometheus/Grafana
→ logs in Loki
→ alerts to Slack/Email
→ replay from dashboard
