export function createResourceIntakeSkill(): string {
  return `---
name: resource-intake
description: Classify and ingest local files into the scaffold resource system with policy-driven lane, category, and tag selection. Use when an agent needs to submit a new asset to OSS or the local resource catalog and should avoid guessing public/private placement.
---

# Resource Intake

1. Run \`pnpm resources:classify -- --file <path>\` before uploading.
2. Pass \`--path <classificationPath>\` when the asset should follow a virtual folder such as \`brand/logo.svg\` or \`icons/system/check.svg\`.
3. Respect the intake policy in \`config/resource-classification.config.json\`.
4. Default to the private lane when classification is ambiguous or no intake rule matches.
5. Promote to the public lane only when the asset is safe for broader delivery and the path/category support that decision.
6. Run \`pnpm resources:intake -- --file <path>\` after the preview looks correct.
7. Use \`pnpm resources:batch-intake\` when several files should be submitted together.
8. Use \`--dry-run\` for a no-write preview of the final intake result.
9. Verify the stored record with \`pnpm resources:query -- --sha256 <hash>\`.
`;
}

export function createResourceReviewSkill(): string {
  return `---
name: resource-review
description: Audit stored resource metadata, lane placement, category drift, and lookup tags in the scaffold resource catalog. Use when an agent needs to inspect or correct how assets were classified, indexed, or prepared for OSS-backed storage.
---

# Resource Review

1. Start with \`pnpm resources:query -- --all\` or a narrower query by \`--lane\`, \`--category\`, \`--tag\`, \`--name\`, or \`--sha256\`.
2. Inspect \`config/resource-classification.config.json\` before changing categories or tags by hand.
3. Re-run \`pnpm resources:classify -- --file <path>\` on a representative file when current catalog metadata looks suspicious.
4. Keep the remote object key model separate from category decisions. Category lives in the local catalog, not in the OSS path.
5. Use \`pnpm resources:review\` to focus on rows where \`needs_review\` is still true.
6. If a stored asset is wrong, prefer delete-and-reintake over silent ad hoc metadata edits.
7. Use \`pnpm resources:delete\` before \`pnpm resources:gc\` when removing a stored object.
8. Treat lane ambiguity as a private-by-default case until a human review says otherwise.
`;
}

export function createResourceRehydrateSkill(): string {
  return `---
name: resource-rehydrate
description: Locate and retrieve previously stored assets from the scaffold resource catalog and OSS-backed storage. Use when an agent needs to fetch a file by hash, object key, category, or tag without relying on hardcoded bucket paths.
---

# Resource Rehydrate

1. Query the local catalog before fetching. Prefer \`pnpm resources:query -- --tag <tag>\`, repeated \`--tag\` with \`--tag-mode all\`, \`--category <name>\`, or \`--sha256 <hash>\`.
2. Use \`pnpm resources:get -- <lane> --sha256 <hash> --output <file>\` when the hash is known.
3. Use \`pnpm resources:fetch\` or \`resources:get\` with \`--key\` only when the object key is already known and trusted.
4. Keep output paths explicit. Do not overwrite unrelated files.
5. When integrity matters, compare the retrieved file hash with the catalog \`sha256\`.
6. Stay inside the resource layer. Do not hardcode bucket names or OSS paths in ad hoc scripts unless you are repairing the resource layer itself.
`;
}
