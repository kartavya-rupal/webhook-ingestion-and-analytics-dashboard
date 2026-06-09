# FinRelay — Payload Inspection Strategy

## Purpose

This document defines how FinRelay should handle raw payload inspection safely.

Payload inspection exists to help operators debug failed or suspicious events without exposing sensitive data unnecessarily.

---

## Core Principle

Raw payloads should remain archived separately from searchable data.

The search layer should only store safe previews or extracted snippets.

---

## Storage Model

### S3
Use S3 for:
- raw payload archival
- replay source payloads
- long-term evidence storage

### Search Index
Use the search index for:
- safe payload snippets
- searchable text fragments
- redacted preview data
- metadata needed to locate the payload

### Dashboard
Use the dashboard for:
- controlled preview
- formatted JSON inspection
- failure-context inspection
- operator-driven opening of the full payload when allowed

---

## What Payload Inspection Should Support

Payload inspection should allow operators to:

- view a safe preview of the payload
- inspect JSON structure
- search payload text snippets
- inspect failure-related fields
- view the payload path or archive reference
- open the raw payload only when explicitly requested
- optionally compare replay payloads later

---

## What Should Be Redacted

The following should not be exposed by default:
- secrets
- auth tokens
- signing secrets
- private headers
- credentials
- full unredacted PII
- sensitive account or financial identifiers unless approved by policy

---

## Safe Preview Rules

A safe preview should:
- show only the first useful part of the payload
- hide sensitive keys
- keep formatting readable
- avoid dumping very large JSON blobs into the UI
- preserve enough structure for debugging

---

## Searchable Payload Text

If payload text is indexed, it should be:
- limited in size
- normalized
- redacted where needed
- safe for operational search
- useful for finding bad fields or patterns

---

## Inspection Modes

### 1. Summary Preview
Used in list pages and event detail cards.

Should show:
- payload path
- payload size
- hash
- a short safe excerpt

### 2. Structured Preview
Used on event detail pages.

Should show:
- formatted JSON fragments
- important fields
- failure-related values
- request metadata

### 3. Full Raw View
Used only when explicitly opened and allowed by permissions.

Should fetch the archived raw payload from S3 or from a protected retrieval path.

---

## Security Rule

Search and preview are not the same as full raw access.

Do not allow the dashboard to expose raw payload content by default.

---

## Operator Rule

Operators should be able to answer:
- what failed
- where it failed
- which part of the payload is suspicious
- whether replay used the same data
- whether the issue is visible from the preview alone

without needing unrestricted raw access for every case.

---

## Outcome

Payload inspection should be useful for debugging and safe for sensitive fintech data.