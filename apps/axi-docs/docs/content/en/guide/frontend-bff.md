---
id: axi-docs-guide-frontend-bff
title: Frontend BFF Pattern
type: guide
status: published
tags: [Axi Docs, BFF, frontend architecture, API composition, English]
created: 2026-08-22
modified: 2026-08-22
graph-title: Frontend BFF Pattern
graph-tags: [BFF, frontend architecture, API design]
description: A future-facing reference for Backend for Frontend adoption, covering boundaries, fit, contracts, reliability, security, testing, and incremental rollout.
---

## Summary

BFF, or Backend for Frontend, is a server-side adapter dedicated to one frontend experience. It sits between a browser, mobile app, or desktop client and domain APIs. It translates interaction intent into backend calls, composes data from multiple providers, and returns DTOs shaped for that frontend.

A BFF is not a place to move core business logic into a "frontend project", and it is not an API Gateway with a new name. Its value is to isolate frontend experience concerns from domain services while giving authentication boundaries, data shaping, error semantics, and observability a governable home.

This page is a reference baseline for future adoption. It does not mean that the workspace has standardized on BFFs today.

## Typical shape

```text
Browser / Mobile / Desktop
             |
             v
      BFF-Web / BFF-Mobile / BFF-Admin
       - session and authorization boundary
       - validation and protocol translation
       - composition, shaping, and frontend DTOs
       - timeout, cache, error, and telemetry policy
             |
             v
      Domain APIs / services / workspace providers
             |
             v
           Domain data sources
```

One frontend experience may have one BFF, or several BFFs split by clear boundaries. The important property is that every BFF has a defined consumer, responsibility range, and service objective. Avoid creating one universal aggregation layer for every client.

## BFF versus adjacent patterns

| Pattern | Primary responsibility | Dedicated to one frontend experience | Typical response |
| --- | --- | --- | --- |
| Frontend calling domain APIs directly | Consume backend resources directly | No | Raw domain resources |
| API Gateway | Routing, auth entry, rate limiting, baseline telemetry | No | Usually pass-through or lightly transformed |
| BFF | Experience-specific composition, DTOs, errors, and interaction semantics | Yes | A view model for one page or flow |
| SSR / Server Components | Render pages or components on the server | Not necessarily | HTML, component data, or a render result |

A BFF can run behind an API Gateway. The Gateway handles cross-client platform governance; the BFF handles the semantics of one frontend experience. Do not implement the same responsibility twice.

## When it is worth introducing

A BFF usually pays off when one or more of these are true:

- A page or user flow needs to compose several domain APIs, and the composition belongs to that frontend experience.
- Domain resource models are not suitable for direct client use and need field selection, naming conversion, pagination conversion, or state normalization.
- Web, mobile, and desktop clients have different authentication, network, load, or data-density requirements.
- The frontend needs a stable experience contract while domain services continue to evolve.
- Upstream credentials, internal addresses, or service topology must remain server-side.

Do not add a BFF merely for architectural completeness when:

- The frontend calls one stable, client-oriented API and needs no composition or transformation.
- The BFF only forwards requests unchanged and provides no experience boundary or governance value.
- The requirement is a cross-user long-running workflow, asynchronous job, or data synchronization concern; those belong in domain, workflow, or event services.
- The team has no clear owner for operations, alerts, or contract maintenance.

## Boundaries: what it should and should not do

### A BFF should

- Design resource or action endpoints around frontend scenarios rather than database tables.
- Validate input, resolve the session, and forward only the minimum required user context downstream.
- Call independent dependencies in parallel, compose results, and define required versus optional data semantics.
- Map domain responses to stable, shaped, versionable frontend DTOs.
- Standardize frontend-safe error codes, request IDs, pagination, and time formats.
- Apply short caching or controlled retries only to explicitly safe and idempotent reads.
- Emit route-level logs, metrics, and traces that identify the relevant downstream dependencies.

### A BFF should not

- Copy core domain invariants or become a new source of business truth.
- Access an unrelated database directly and bypass domain authorization or transaction boundaries.
- Put every client difference into a large conditional tree and become a universal BFF.
- Hide long-running workflows, cross-service transactions, or scheduled jobs inside synchronous requests.
- Return upstream errors, internal stack traces, access tokens, or service addresses unchanged.
- Turn one page request into an unbounded fan-out that can overload downstream services.

## Contract baseline

### 1. Organize endpoints around user intent

Prefer endpoints that describe a frontend scenario, such as `GET /api/web/v1/dashboard` or `POST /api/web/v1/orders/{id}/cancel`. Do not expose the URL composition rules of several domain services to the client, and do not make the client decide aggregation order.

### 2. A DTO is a contract, not a domain dump

Drive response fields from what the page or flow needs. Document field names, nullability, enums, time formats, pagination, and sorting semantics. Add fields compatibly; use a version or migration window when removing a field or changing its meaning.

### 3. Make required and optional dependencies explicit

If the primary page data fails, return a clear error. Recommendations, analytics, or unread counts may return empty data or a `degraded` state when the contract allows it. Do not let a non-critical downstream outage take down the entire page, and do not silently swallow a critical failure.

### 4. Use one safe error shape

At minimum, include:

```json
{
  "code": "PROFILE_UNAVAILABLE",
  "message": "Profile information is temporarily unavailable",
  "requestId": "req_...",
  "details": {}
}
```

`message` is for the UI or user-facing display, `code` is for programmatic branching, and `requestId` is for troubleshooting. Keep upstream status details, stack traces, and internal service names in server logs rather than passing them through.

### 5. Design write operations for idempotency

Create, submit, payment, and cancellation operations need an idempotency key, defined duplicate behavior, and a query path for timeouts. A BFF may translate a protocol, but it must not manufacture a successful business result.

## Reliability and performance

Give every downstream call its own deadline and set a total deadline for the BFF request. A useful baseline is:

| Capability | Baseline | Notes |
| --- | --- | --- |
| Timeout | Total timeout stays within the frontend's acceptable wait time | Each downstream deadline must be shorter than the total deadline |
| Retry | Retry only idempotent requests with recognizable transient failures | Cap attempts, use backoff and jitter, and never retry business rejections |
| Concurrency | Parallelize independent dependencies with a fan-out limit | Never create unbounded tasks per request |
| Isolation | Use bulkheads, connection pools, or concurrency caps for slow dependencies | Prevent one dependency from starving other routes |
| Cache | Cache only data that can tolerate bounded staleness | Define TTL, invalidation, and user/tenant isolation |
| Degradation | Define an empty state or `degraded` response for non-critical modules | Make degradation observable instead of silently dropping data |

`Promise.all` is not a reliability policy by itself. For pages with optional dependencies, classify results as required or optional and return a stable DTO for partial success.

## Security boundary

A BFF is a trust boundary between the browser and internal services. At minimum:

- The browser sends a session or short-lived credential intended for the BFF; upstream service tokens remain server-side.
- Validate origin, session, tenant, and resource authorization. Never trust a client-supplied user ID as identity.
- Use an allowlist for downstream hosts and paths so the BFF cannot become an SSRF proxy.
- For cookie sessions, configure CSRF protection, SameSite, Secure, HttpOnly, and reasonable expiration.
- Apply response field allowlists, especially to internal IDs, permission data, audit fields, and credential-related fields.
- Log auth failures, permission denials, sensitive writes, and abnormal downstream calls without logging tokens or full private payloads.

## Observability

Track a minimum route-level set: request volume, success rate, 4xx/5xx, p50/p95/p99 latency, timeouts, degradation count, cache hit rate, and downstream error distribution. Logs should include `requestId`, an irreversible user or tenant identifier, route, version, and dependency name. Traces should connect one page request to its downstream calls.

## Testing strategy

- **DTO and error unit tests**: cover field selection, enum mapping, pagination, time formats, and upstream error mapping.
- **Downstream contract tests**: verify that providers still satisfy the request and response contracts instead of relying only on mocks.
- **Route behavior tests**: exercise the real HTTP boundary for auth, validation, required/optional dependencies, and status codes.
- **Integration tests**: use controllable downstream doubles to verify concurrency, timeouts, retries, partial failures, and idempotency.
- **Frontend acceptance tests**: cover at least one real page or flow, including loading, empty, and error states.
- **Runtime checks**: confirm that health checks, metrics, logs, and traces are visible in local or test environments before release.

Do not treat "the BFF returns 200" as the completion criterion. Verify the user-visible behavior and failure paths.

## Incremental rollout

1. Select one frontend experience and one high-value scenario. Record current direct API calls, permissions, and dependencies.
2. Write the DTO, error, timeout, degradation, and observability contracts required by the page.
3. Implement the thinnest possible route and migrate one page or flow first.
4. Add downstream deadlines, authorization propagation, logs, and metrics. Add degradation tests for optional dependencies.
5. Compare direct and BFF paths in a test environment for success rate, latency, errors, and data consistency.
6. Migrate one slice at a time, then remove old direct paths so two contracts do not live forever.
7. Once the boundary is stable, decide whether Web, Mobile, and Admin need separate BFFs or whether shared capability belongs back in a domain service.

## Workspace adoption checklist

- [ ] The BFF's frontend experience and primary consumer are named.
- [ ] Its pages and flows are listed, along with domain rules it explicitly does not own.
- [ ] Every downstream dependency has an owner, contract, timeout, and failure semantic.
- [ ] DTOs, error codes, authorization propagation, idempotency, and versioning have been reviewed.
- [ ] Route health checks, metrics, logs, traces, and alert entry points are defined.
- [ ] Normal, empty, unauthorized, timeout, partial-failure, and duplicate-submit cases are covered.
- [ ] Migration, rollback, and old direct-path removal conditions are recorded.
- [ ] Cross-project provider/consumer relationships are recorded in project docs or the workspace graph when applicable.

## Adoption record template

```text
Experience boundary: Web / Mobile / Admin / Desktop / other
Primary consumer:
First migration scenario:
Downstream dependencies and owners:
DTO and error contract:
Authorization and credential boundary:
SLO, timeout, and degradation:
Logs, metrics, traces, and alerts:
Test evidence:
Migration and rollback conditions:
```

## Conclusion

The question is not whether to add another backend service. The question is whether a frontend experience needs a clear, stable, observable server-side contract. Start with a real composition or security-boundary problem, keep the BFF thin, keep domain ownership explicit, make failure semantics visible, and expand only when runtime evidence supports it.
