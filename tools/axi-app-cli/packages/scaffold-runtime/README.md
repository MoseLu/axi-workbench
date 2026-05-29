# @axi/scaffold-runtime

## Role

CLI runtime, command execution, sync, doctor, install, and file orchestration.

## Allowed Workspace Dependencies

- `@axi/scaffold-kit`
- `@axi/scaffold-registry`

## Owns

- args parsing
- runtime context
- sync and doctor execution
- file rendering and write orchestration

## Must Not Do

- import capability packages directly
- define foundation or feature modules
- become the policy source of truth
