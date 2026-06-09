# FinRelay Monitoring Plan

## API

Track:

- Incoming webhook count
- Signature verification failures
- Queue dispatch failures
- Ingestion latency

## Worker

Track:

- Processing count
- Processing latency
- Retry count
- DLQ count
- Replay count

## Queue

Track:

- Messages available
- Messages in flight
- Oldest message age

## Reliability

Track:

- Success rate
- Failure rate
- Retry rate
- Replay success rate

## Infrastructure

Track:

- CPU usage
- Memory usage
- Process uptime
- Database connectivity
- Redis connectivity