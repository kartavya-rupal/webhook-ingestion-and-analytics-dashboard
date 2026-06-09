# FinRelay — Payload Inspection

## Purpose

Payload inspection helps operators debug failed events safely.

## Rules

- raw payloads stay archived in S3
- the dashboard shows a safe preview
- payload path and hash stay visible
- sensitive fields should be redacted where possible
- archived payloads should be opened only through a protected route

## What operators should see

- payload preview
- payload path
- payload hash
- raw payload size
- request headers
- request IP
- dedupe key
- failure context
- a link to the archived payload