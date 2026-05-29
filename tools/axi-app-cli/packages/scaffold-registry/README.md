# @axi/scaffold-registry

## Role

Assembly layer for capability packages and preset policy.

## Allowed Workspace Dependencies

- `@axi/scaffold-kit`
- all `foundation-*` packages
- all `feature-*` packages

## Owns

- registry composition
- preset catalog
- dependency expansion and default module selection

## Must Not Do

- prompt users
- run install flows
- write files directly
