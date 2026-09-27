# ADR-001: Commit Ledger Canonical Owner

**Status:** Accepted
**Date:** 2026-09-15
**Deciders:** Axi Workspace Governance
**Technical Story:** Phase 1 findings identified the need to establish a single authoritative source for commit data across the workspace.

---

## Context

The Axi workspace encompasses 35 registered projects across 24 Git repositories with approximately 7,400 commits total. Multiple surfaces have commit-related data needs:

- **Control Plane** (`services/control-plane`): Already hosts commit-ledger API routes
- **Operations UI** (`apps/workbench`): Contains AxiTable and GovernanceSummary components
- **CLI tools**: Various commands read commit information

Without a clear canonical owner, surfaces either:
1. Duplicate Git access logic
2. Fetch commit data directly from Git repositories
3. Maintain inconsistent projections

This creates:
- Maintenance burden across multiple code paths
- Inconsistent data shapes
- Potential for staleness when Git state changes
- Difficulty in enforcing access controls

---

## Decision

We establish **Control Plane** as the canonical owner and read/projection entry point for all commit ledger data.

### Source Hierarchy

| Priority | Source | Role |
|----------|--------|------|
| 1 | Git commit (raw) | Historical fact source |
| 2 | workspace-project | Project identity boundary source |
| 3 | submit log / CHANGELOG | Supplementary evidence |
| 4 | test report | Verification artifact |
| **Entry Point** | **Control Plane API** | **Read and projection** |

### Data Boundaries

| Boundary | Value |
|----------|-------|
| Collection scope | 24 repositories (projects 11 + products 5 + shared/infra/tools 8) |
| Storage | Control Plane persistence layer |
| Read access | API only — UI does not read Git directly |

### Rules

1. **Git is the source of truth** for commit history (author, timestamp, message, hash)
2. **workspace-project defines project boundaries** (which repos belong to which logical project)
3. **Control Plane owns projections** — it aggregates, caches, and serves all commit data
4. **UI consumes via API only** — no direct Git access from frontend code
5. **submit log and CHANGELOG serve as validation evidence**, not primary sources

---

## Consequences

### Positive

- **Single source of truth**: One authoritative service owns commit data shape and availability
- **No duplicate gateways**: Surfaces fetch from Control Plane, not independently from Git
- **Consistent projections**: Aggregation logic lives in one place
- **Access control surface**: Single choke point for authorization
- **Cache management**: Control Plane can implement caching strategies

### Negative

- **Dependency on Control Plane**: Reads require Control Plane availability
- **Additional latency**: Proxying through API vs direct Git access
- **Single point of failure risk**: Control Plane outage affects all commit data consumers
- **Sync lag**: Projections may lag behind Git state until Control Plane refreshes

### Mitigation

- Control Plane implements read-through caching with configurable TTL
- Health check endpoints support monitoring
- Graceful degradation: UI can show cached data with staleness indicator

---

## Data Flow

```
Git Repos (24) → Control Plane (collector) → Persistence Layer → API Endpoints
                                                              ↓
                                    Operations UI / CLI / External Consumers
```

---

## References

- Phase 1 findings: workspace registry audit
- Control Plane API routes: `services/control-plane/src/commit-ledger/`
- Operations UI components: `AxiTable`, `GovernanceSummary`
- Workspace registry: 35 projects, 24 repos

---

## Review

This decision should be reviewed when:
- New commit data consumers are introduced
- Control Plane architecture changes significantly
- workspace-project schema evolves
- Storage requirements exceed current projections
