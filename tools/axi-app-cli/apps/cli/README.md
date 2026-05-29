# axi-app-cli

## Role

Publishable CLI shell and binary entrypoint for the scaffold.

## Allowed Workspace Dependencies

- `@axi/scaffold-runtime`

## Owns

- `src/cli.ts`
- binary wiring for `axi` and `create-axi-app`

## Must Not Do

- import `foundation-*` or `feature-*` packages directly
- assemble registry policy
- own command runtime logic
