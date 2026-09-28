# axi-accounts Agent Guide

Placeholder authored 2026-08-23 by the workspace-remediation
batch. Replace with project-specific guidance. The shared
canonical root for the Axi workspace lives at
`/Volumes/code/workspace/AGENTS.md`.

## Relationship Metadata

This section declares relationship metadata consumed by the workspace control-plane snapshot for relationship provenance tracking.

### As a Provider (targetRef)

When other projects declare a dependency on this project in `workspace.graph.json`, they inherit the following metadata contract:

- **requiredness**: "required" (this project provides critical credential-ref contracts)
- **dependencyPhase**: runtime
- **versionConstraint**: "workspace protocol" (workspace dependencies use `link:/catalog:` protocol, no explicit version pinning)
- **validityWindow**: "indefinite" (no expiration on workspace protocol dependencies)

#### Capability Phases

| Capability | Dependency Phase | Notes |
|---|---|---|
| account-assets-contract | runtime | Credential refs resolved at runtime |
| credential-ref-contract | runtime | Provider credentials loaded at request time |
| verification-inbox-target | runtime | Notification delivery during workflow execution |
