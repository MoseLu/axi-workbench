# Axi Docs Verification

This file records the verification contract for repository-level documentation and app changes.

## Standard Checks

Run the narrowest check that proves the changed surface:

| Change surface | Verification |
| --- | --- |
| Root governance docs | `pnpm --dir app docs:check` |
| Project dossier mirrors | `pnpm --dir app projects:check` |
| Source locks | `pnpm --dir app source:check` |
| Frontend route/config changes | `pnpm --dir app test:run -- src/config/siteConfig.test.ts` |
| App implementation changes | `pnpm --dir app verify` |

## Plans Library Checks

For `docs/content/{en,zh}/plans/**` changes:

1. Keep matching relative paths across locales when both languages exist.
2. Include frontmatter with `id`, `title`, `type`, `status`, `tags`, `created`, `modified`, `graph-title`, `graph-tags`, and `description`.
3. Keep durable decisions in Axi Docs and execution status in Axi Todo.
4. Link Todo execution items back to the canonical plan page.

## Current Known Gaps

- `pnpm --dir app source:check` can fail when the locked Axi Skills upstream checkout has intentionally drifted. Treat that as an owner action unless the current task changes source locks.
