#!/usr/bin/env node
/**
 * build-projects-index.mjs
 *
 * Parses the workspace project list and emits a machine-readable project
 * index (`docs/projects.index.json`) plus eight-piece Markdown dossiers
 * (README / AGENTS / INDEX / TODO / MILESTONE / PRD / TDD / CHANGELOG-light)
 * for every project under `docs/content/{en,zh}/projects/<id>/`.
 *
 * Source precedence (zero-context handoff governance):
 *   1. `/Volumes/code/workspace/.workspace/project-handoff.json` (preferred;
 *      produced by `infra/axi-workspace-governance/scripts/project-handoff.mjs`).
 *      Active project readiness, commands, current work, and known failures
 *      are sourced from here.
 *   2. `/Volumes/code/workspace/WORKSPACE_INDEX.md` (fallback). Used only when
 *      the handoff snapshot is missing or unparseable. `WORKSPACE_INDEX.md`
 *      remains the human-authored registry and is not modified by this script.
 *
 * Usage:
 *   node app/scripts/build-projects-index.mjs            # build English (source) and Chinese scaffolds
 *   node app/scripts/build-projects-index.mjs --locale en # English only
 *   node app/scripts/build-projects-index.mjs --check    # verify all dossiers exist; exit 1 on miss
 *   node app/scripts/build-projects-index.mjs --strict   # exit 1 when handoff snapshot is unavailable
 *
 * The script is deterministic: it never overwrites an existing dossier unless
 * the corresponding `--force` flag is supplied. It uses the frontmatter
 * contract documented in `docs/content/en/guide/frontmatter.md`.
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  extractProjectsFromHandoff,
  readHandoffSnapshot,
  HANDOFF_PATH,
  HANDOFF_MAX_AGE_DAYS,
  WORKSPACE_FALLBACK_PATH,
} from '../src/lib/buildProjectsIndex.mjs';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const CONTENT_ROOT = path.join(REPO_ROOT, 'docs', 'content');
const INDEX_JSON = path.join(REPO_ROOT, 'docs', 'projects.index.json');
const INDEX_PAGES = ['en', 'zh'].map((locale) => ({
  locale,
  path: path.join(CONTENT_ROOT, locale, 'projects', 'INDEX.md'),
}));

// Sections we recognise, in the order they appear in WORKSPACE_INDEX.md.
const SECTIONS = [
  { key: 'core', heading: /^## Core Active\s*$/m },
  { key: 'shared', heading: /^## Shared And Infrastructure Foundations\s*$/m },
  { key: 'reference', heading: /^## Reference Repos\s*$/m },
];

// Eleven-piece dossier filenames. Seven are required (generated for every
// project from `PIECE_TEMPLATES`); six are optional / source-driven
// (generated only when the project root has the corresponding file).
//
// The 4 "source-driven" optional pieces (CHANGELOG / SECURITY /
// README.zh-CN / AGENTS.zh-CN) are generated as dossier stubs that point
// back at the source file. The 2 "passthrough" optional pieces (CHANGE /
// CLAUDE) are copied verbatim with the standard frontmatter prepended, so
// downstream consumers see the original markdown unchanged.
//
// Note: per workspace template (`projects/axi-workbench/docs/templates/
// project-docs/`), the canonical milestone file name is the singular
// `MILESTONE.md` — not the plural form. Earlier revisions of this script
// used the plural; the rename keeps the build output aligned with the
// template source of truth.
const PIECES = ['README.md', 'AGENTS.md', 'INDEX.md', 'TODO.md', 'MILESTONE.md', 'PRD.md', 'TDD.md'];
const OPTIONAL_PIECES = ['CHANGELOG.md', 'SECURITY.md', 'README.zh-CN.md', 'AGENTS.zh-CN.md'];
const PASSTHROUGH_FILES = ['CHANGE.md', 'CLAUDE.md']; // copied verbatim when present

function today() {
  return new Date().toISOString().slice(0, 10);
}

function indexPageBody({ locale, projects }) {
  // Locale-aware labels. Both lists intentionally use parallel English/Chinese
  // keys so we can switch on `locale` once.
  const labels = {
    en: {
      title: 'Workspace Project Dossiers',
      intro: 'Axi Docs keeps a per-project dossier for every active entry in `WORKSPACE_INDEX.md`. The dossier is generated from the workspace index; re-run `pnpm --dir app projects:build` to refresh it.',
      colId: 'Project',
      colPartition: 'Partition',
      colStatus: 'Status',
      colStack: 'Stack',
      colNotes: 'Notes',
      localeNote: 'English source dossiers live under `docs/content/en/projects/`. Simplified Chinese translations live under `docs/content/zh/projects/`.',
    },
    zh: {
      title: '工作区项目档案',
      intro: 'Axi Docs 为 `WORKSPACE_INDEX.md` 中每个 active 项目维护一份档案。档案由工作区索引自动生成；变更后请运行 `pnpm --dir app projects:build` 重新生成。',
      colId: '项目',
      colPartition: '分区',
      colStatus: '状态',
      colStack: '技术栈',
      colNotes: '备注',
      localeNote: '英文源档案位于 `docs/content/en/projects/`，简体中文翻译位于 `docs/content/zh/projects/`，两侧路径镜像。',
    },
  };
  const L = labels[locale];
  const idPrefix = `axi-docs-${locale}-projects-root-index`;
  const frontmatter = [
    '---',
    `id: ${idPrefix}`,
    `title: ${L.title}`,
    `type: index`,
    `status: draft`,
    `tags: [Axi Docs, Projects, Index, ${locale === 'en' ? 'English' : 'i18n'}]`,
    `created: ${today()}`,
    `modified: ${today()}`,
    `graph-title: ${L.title}`,
    `graph-tags: [Projects, Index]`,
    `description: ${L.intro}`,
    '---',
    '',
  ].join('\n');
  // Group projects by section so the table reads by purpose (core / shared /
  // reference) rather than as a flat alphabetical list. This mirrors the
  // shape of `WORKSPACE_INDEX.md`.
  const groups = { core: [], shared: [], reference: [] };
  for (const p of projects) {
    if (!groups[p.section]) groups[p.section] = [];
    groups[p.section].push(p);
  }
  const groupTitles = {
    en: { core: 'Core Active Projects', shared: 'Shared and Infrastructure', reference: 'Reference Repos' },
    zh: { core: '核心 active 项目', shared: '共享与基础设施', reference: '参考仓库' },
  };
  const lines = [
    frontmatter,
    `# ${L.title}`,
    '',
    `> ${L.intro}`,
    '',
    `> ${L.localeNote}`,
    '',
    '## Dossier Routing',
    '',
    `- Machine-readable index: \`docs/projects.index.json\` (regenerated by \`projects:build\`).`,
    `- Locale source: \`docs/content/${locale}/projects/<id>/\`.`,
    `- Other locale: \`docs/content/${locale === 'en' ? 'zh' : 'en'}/projects/<id>/\`.`,
    '',
  ];
  for (const sectionKey of ['core', 'shared', 'reference']) {
    const rows = groups[sectionKey] || [];
    if (rows.length === 0) continue;
    lines.push(`## ${groupTitles[locale][sectionKey]} (${rows.length})`, '');
    lines.push(`| ${L.colId} | ${L.colPartition} | ${L.colStatus} | ${L.colStack} | ${L.colNotes} |`);
    lines.push('| --- | --- | --- | --- | --- |');
    for (const p of rows) {
      const link = `[${p.name}](./${p.id}/README.md)`;
      const notes = (p.notes || '').replace(/\|/g, '\\|').slice(0, 220);
      const stack = (p.stack || '').replace(/\|/g, '\\|').slice(0, 120);
      const partition = `\`${p.partition}/\``;
      const status = p.status || '—';
      lines.push(`| ${link} | ${partition} | ${status} | ${stack} | ${notes} |`);
    }
    lines.push('');
  }
  lines.push('## Total', '');
  lines.push(`**${projects.length}** ${locale === 'en' ? 'dossiers under this locale tree' : '份档案分布在本语种树下'}。`, '');
  return lines.join('\n');
}

function makeSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseTable(markdown, stopMarker) {
  // Split on rows. A row is a line that starts with `|` and is not a separator
  // row. We then split each row on `|` and trim. This is enough for the
  // WORKSPACE_INDEX tables; if a cell ever contains a literal `|` it would
  // need a proper markdown parser, but the index tables do not.
  //
  // `stopMarker` is the next "## " heading or similar that ends the current
  // section. We stop at the first such marker after we have seen at least
  // one data row.
  const rows = [];
  let pastFirstRow = false;
  for (const line of markdown.split('\n')) {
    if (stopMarker && pastFirstRow && stopMarker.test(line)) break;
    if (!line.startsWith('|')) {
      if (pastFirstRow) break; // table ended
      continue; // leading blank lines before the table
    }
    if (/^\|[\s-]+\|/.test(line)) continue; // separator row
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    pastFirstRow = true;
    rows.push(cells);
  }
  return rows;
}

function extractProjects(markdown) {
  const projects = [];
  for (const section of SECTIONS) {
    const headingMatch = section.heading.exec(markdown);
    if (!headingMatch) continue;
    const after = markdown.slice(headingMatch.index + headingMatch[0].length);
    // The next table starts at the first line beginning with `|`.
    const tableStart = after.indexOf('\n|');
    if (tableStart === -1) continue;
    const tableMarkdown = after.slice(tableStart + 1);
    // Stop at the next "## " heading. We pass `/^##\s/m` so that an inner
    // "## Cleanup Archives" or "## Explicit Non-Entrypoints" cuts the
    // current table.
    const rows = parseTable(tableMarkdown, /^##\s/m);
    for (const row of rows) {
      // Row shape: [Project, Path, Purpose, Stack, Status, AuthDocs, Verification, Notes]
      const [name = '', pathMd = '', purpose = '', stack = '', status = '', , , notes = ''] = row;
      if (!name || !pathMd) continue;
      // Cells in the WORKSPACE_INDEX table wrap inline code in backticks
      // (e.g. `` `/Volumes/code/workspace/projects/axi-x` ``). Strip them
      // first so the workspace-prefix check matches.
      const cleanPath = pathMd.replace(/`/g, '').trim();
      if (!cleanPath.startsWith('/Volumes/code/workspace/')) continue;
      // Skip the workspace-level governance and registry — they are infra
      // and have their own face-level docs.
      if (cleanPath === '/Volumes/code/workspace/infra/axi-workspace-governance') continue;
      if (cleanPath === '/Volumes/code/workspace/infra/axi-registry') continue;
      projects.push({
        id: makeSlug(name),
        name: name.trim(),
        // `cleanPath` is a directory path under `/Volumes/code/workspace/`,
        // except for a few special entries (`workspace.graph.json`,
        // `dev-services.config.json`) that point at top-level files. For
        // those, fall back to the `infra/` partition so the index page
        // groups them under shared infrastructure rather than rendering a
        // misleading directory name.
        partition: cleanPath.replace('/Volumes/code/workspace/', '').split('/')[0].endsWith('.json')
          ? 'infra'
          : cleanPath.replace('/Volumes/code/workspace/', '').split('/')[0],
        path: cleanPath,
        purpose: purpose.replace(/`/g, '').trim(),
        stack: stack.trim(),
        status: status.trim(),
        notes: notes.trim(),
        section: section.key,
      });
    }
  }
  return projects;
}

function frontmatter(record) {
  // Project dossiers use type: project; the rest of the schema mirrors
  // docs/content/en/guide/frontmatter.md. `graph-title` makes each project a
  // node in the knowledge graph so the front-end can render project→doc
  // relationships.
  return [
    '---',
    `id: axi-docs-${record.locale}-projects-${record.project.id}`,
    `title: ${record.project.name}`,
    `type: project`,
    `status: draft`,
    `tags: [Axi Docs, Projects, ${record.project.partition}, ${record.project.section}]`,
    `created: ${today()}`,
    `modified: ${today()}`,
    `graph-title: ${record.project.name}`,
    `graph-tags: [Projects, ${record.project.partition}]`,
    `description: ${record.project.purpose || record.project.name + ' workspace project.'}`,
    `project:`,
    `  id: ${record.project.id}`,
    `  partition: ${record.project.partition}`,
    `  path: ${record.project.path}`,
    `  source-section: ${record.project.section}`,
    '---',
    '',
  ].join('\n');
}

const PIECE_TEMPLATES = {
  'README.md': (ctx) => [
    `# ${ctx.project.name}`,
    '',
    `> Workspace project dossier. Source of truth: \`${ctx.project.path}\`.`,
    `> Section: ${ctx.project.section} / Partition: \`${ctx.project.partition}/\`.`,
    '',
    '## Summary',
    '',
    ctx.project.purpose || '_No purpose statement extracted from WORKSPACE_INDEX.md yet._',
    '',
    '## Stack',
    '',
    ctx.project.stack || '_Stack not recorded in WORKSPACE_INDEX.md._',
    '',
    '## Authoritative Documents',
    '',
    `- Workspace entry: [\`WORKSPACE_INDEX.md\`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "${ctx.project.name}".`,
    `- Project root: \`${ctx.project.path}\``,
    `- Project \`AGENTS.md\`: \`${ctx.project.path}/AGENTS.md\` (when present).`,
    `- Project \`README.md\`: \`${ctx.project.path}/README.md\` (when present).`,
    '',
    '## Notes',
    '',
    ctx.project.notes || '_No notes._',
    '',
    '## Verification (suggested)',
    '',
    '_See project root \`AGENTS.md\` or \`package.json\` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._',
    '',
    '## Cross-References',
    '',
    '- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.',
    '- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.',
    '- `app/src/config/documentSources.ts` — Axi Docs source registry.',
    '',
  ].join('\n'),

  'AGENTS.md': (ctx) => [
    `# ${ctx.project.name} — Agent Contract`,
    '',
    `> This dossier is the Axi Docs agent contract for **${ctx.project.name}** (workspace path: \`${ctx.project.path}\`).`,
    '> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.',
    '',
    '## Read Order',
    '',
    '1. This file (dossier).',
    '2. `docs/content/{en,zh}/projects/' + ctx.project.id + '/README.md` (dossier summary).',
    `3. Project root \`AGENTS.md\` at \`${ctx.project.path}/AGENTS.md\`.`,
    `4. Project root \`README.md\` at \`${ctx.project.path}/README.md\`.`,
    '',
    '## Boundary',
    '',
    `- Axi Docs treats this project as **read-only content source**.`,
    `- Axi Docs never edits files under \`${ctx.project.path}\`.`,
    `- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).`,
    '',
    '## Update Cadence',
    '',
    '- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.',
    '- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).',
    '',
  ].join('\n'),

  'INDEX.md': (ctx) => [
    `# ${ctx.project.name} — Dossier Index`,
    '',
    '## Pieces in this Dossier',
    '',
    ...PIECES.map((p) => `- [\`${p}\`](./${p})`),
    '',
    '## Dossier Routing',
    '',
    `- Locale root: \`docs/content/${ctx.locale}/projects/\``,
    `- Other locale: \`docs/content/${ctx.locale === 'en' ? 'zh' : 'en'}/projects/${ctx.project.id}/\``,
    `- Workspace entry: \`${ctx.project.path}\``,
    '',
  ].join('\n'),

  'TODO.md': (ctx) => [
    `# ${ctx.project.name} — TODO`,
    '',
    '> Dossier TODO. Tracks what Axi Docs still needs to surface for this project.',
    '',
    '## P0',
    '',
    '- [ ] Confirm project root `AGENTS.md` / `README.md` still exist and match `WORKSPACE_INDEX.md`.',
    '- [ ] Surface canonical verification commands (read from project `AGENTS.md` or `package.json`).',
    '',
    '## P1',
    '',
    '- [ ] Capture first-party MCP tool mapping if the project exposes one (e.g. `axi_docs_*` adapters, `workspace-project` consumer).',
    '- [ ] Link to active consumers via `workspace.graph.json` (`workspace-project consumers <id>`).',
    '',
    '## P2',
    '',
    '- [ ] Add a thumbnail or icon if the project is a Dashboard app.',
    '- [ ] Cross-link to Axi Rules entry (`rules/<family>/AGENTS.md`) when behavior rules reference this project.',
    '',
    '## Out of Scope',
    '',
    '- Project-internal TODOs live in the project root, not here.',
    '',
  ].join('\n'),

  'MILESTONE.md': (ctx) => [
    `# ${ctx.project.name} — Milestone`,
    '',
    '> Dossier milestone. Tracks the **public surface** of this project as seen from Axi Docs.',
    '',
    '## Current State',
    '',
    `- Workspace status: **${ctx.project.status || 'unknown'}** (from WORKSPACE_INDEX.md).`,
    `- Dossier: draft (initial scaffold generated by \`app/scripts/build-projects-index.mjs\`).`,
    '',
    '## Exit Criteria (to move from draft → published)',
    '',
    '- [ ] Dossier `README.md` summarises the project without claiming implementation details that the project does not document itself.',
    '- [ ] `pnpm --dir app projects:check` passes.',
    '- [ ] Cross-references to `WORKSPACE_INDEX.md` and project root `AGENTS.md` are accurate.',
    '',
    '## Long-Term',
    '',
    '- [ ] Promote from `status: draft` to `status: published` once content is reviewed.',
    '- [ ] Add a `docs/content/{en,zh}/projects/' + ctx.project.id + '/CHANGELOG.md` (optional) if the project emits user-visible changes worth tracking in Axi Docs.',
    '',
  ].join('\n'),

  'PRD.md': (ctx) => [
    `# ${ctx.project.name} — PRD Slice`,
    '',
    `> Axi Docs PRD slice for **${ctx.project.name}**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.`,
    '',
    `## REQ-PROJ-${ctx.project.id.toUpperCase().replace(/-/g, '-')}-001`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Requirement | Maintain a discoverable Axi Docs dossier for ${ctx.project.name}. |`,
    `| Acceptance | \`docs/content/{en,zh}/projects/${ctx.project.id}/${PIECES.join(', ')}\` exist with valid frontmatter. |`,
    '| Source | `WORKSPACE_INDEX.md` (workspace policy). |',
    '',
    `## REQ-PROJ-${ctx.project.id.toUpperCase().replace(/-/g, '-')}-002`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    '| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |',
    `| Acceptance | \`pnpm --dir app projects:check --project=${ctx.project.id}\` succeeds. |`,
    '| Source | `WORKSPACE_INDEX.md` partition table. |',
    '',
    '## Non-Goals',
    '',
    "- Axi Docs does not own the project; it only indexes it.",
    "- Axi Docs does not duplicate the project's internal design, tests, or roadmap.",
    '',
  ].join('\n'),

  'TDD.md': (ctx) => [
    `# ${ctx.project.name} — TDD Slice`,
    '',
    `> Axi Docs TDD slice for **${ctx.project.name}**. Describes the test design for the dossier itself, not the project.`,
    '',
    '## Unit checks',
    '',
    `- \`pnpm --dir app projects:check\` walks \`docs/content/{en,zh}/projects/${ctx.project.id}/${PIECES.join(', ')}\` and asserts every expected piece exists with valid frontmatter.`,
    `- \`pnpm --dir app projects:check --project=${ctx.project.id}\` runs the same checks scoped to this project.`,
    '',
    '## Manual checks',
    '',
    `- Open the dossier in the Axi Docs web app and confirm it routes under \`/en/projects/${ctx.project.id}\` (and \`/zh/...\`).`,
    '- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).',
    '',
    '## Failure modes',
    '',
    '- Missing piece → `projects:check` exits non-zero with the missing path in the error.',
    '- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.',
    '- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.',
    '',
  ].join('\n'),
};

async function exists(p) {
  try {
    await access(p, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function writeIfMissing(filePath, body) {
  if (await exists(filePath)) return 'skipped';
  await writeFile(filePath, body, 'utf8');
  return 'wrote';
}

// Template for the optional pieces. CHANGELOG and SECURITY are generated with
// a "mirror" header that points back to the source file, since axi-docs is not
// the source of truth for these documents. The two .zh-CN pieces are simple
// aliases of their English counterparts (since the English version is
// generated from WORKSPACE_INDEX.md, not from a project-root source, the
// .zh-CN file is currently a self-referential stub).
function optionalPieceTemplate(piece, ctx) {
  if (piece === 'CHANGELOG.md' || piece === 'SECURITY.md') {
    return [
      `# ${ctx.project.name} — ${piece.replace('.md', '')} Mirror`,
      '',
      `> Mirror of the project root \`${piece}\` at \`${ctx.project.path}/${piece}\`.`,
      `> Axi Docs does not own this content; the project root is the source of truth.`,
      '',
      '## Re-mirror',
      '',
      `- Run \`pnpm --dir app projects:build\` to refresh this dossier piece.`,
      `- For full content, read the source at \`${ctx.project.path}/${piece}\`.`,
      '',
    ].join('\n');
  }
  if (piece === 'README.zh-CN.md' || piece === 'AGENTS.zh-CN.md') {
    const enName = piece.replace('.zh-CN.md', '.md');
    return [
      `# ${ctx.project.name} — ${piece}`,
      '',
      `> This is the Simplified Chinese alias of [\`${enName}\`](./${enName}).`,
      `> Axi Docs currently generates the English source dossier from WORKSPACE_INDEX.md;`,
      `> the .zh-CN variant is a stub until upstream projects ship a Chinese README/AGENTS.`,
      '',
      `See [\`${enName}\`](./${enName}) for the canonical content.`,
      '',
    ].join('\n');
  }
  return `# ${ctx.project.name} — ${piece}\n\n> Optional piece stub.\n`;
}

async function mirrorPassthrough(project, locale, piece) {
  // Copy a passthrough file (CHANGE.md, CLAUDE.md) verbatim from project
  // root, prepending the standard dossier frontmatter.
  const sourcePath = path.join(project.path, piece);
  if (!(await exists(sourcePath))) return null;
  const raw = await readFile(sourcePath, 'utf8');
  return frontmatter({ project, locale }) + '\n' + raw;
}

async function buildForProject(project, locale) {
  const dir = path.join(CONTENT_ROOT, locale, 'projects', project.id);
  await ensureDir(dir);
  const ctx = { project, locale, pieces: PIECES };
  const results = {};
  // Required pieces (always generated, deterministic templates).
  for (const piece of PIECES) {
    const filePath = path.join(dir, piece);
    const body = frontmatter({ project, locale }) + '\n' + PIECE_TEMPLATES[piece](ctx);
    results[piece] = await writeIfMissing(filePath, body);
  }
  // Optional pieces (only when the project root has the source file).
  for (const piece of OPTIONAL_PIECES) {
    const sourcePath = path.join(project.path, piece);
    if (!(await exists(sourcePath))) {
      results[piece] = 'absent-on-source';
      continue;
    }
    const filePath = path.join(dir, piece);
    const body = frontmatter({ project, locale }) + '\n' + optionalPieceTemplate(piece, ctx);
    results[piece] = await writeIfMissing(filePath, body);
  }
  // Passthrough pieces (verbatim copy with frontmatter prepended).
  for (const piece of PASSTHROUGH_FILES) {
    const body = await mirrorPassthrough(project, locale, piece);
    if (body === null) {
      results[piece] = 'absent-on-source';
      continue;
    }
    const filePath = path.join(dir, piece);
    results[piece] = await writeIfMissing(filePath, body);
  }
  return results;
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const localeArg = (argv.find((a) => !a.startsWith('--')) || 'all').toLowerCase();
  const locales = localeArg === 'all' ? ['en', 'zh'] : [localeArg];
  const strict = flags.has('--strict');

  // Handoff-first: prefer the governance snapshot. Even when the snapshot
  // succeeds, we still consult the legacy WORKSPACE_INDEX.md table to pick
  // up supplementary projects (workspace-level virtual projects and
  // `references/*` entries) that the snapshot deliberately does not
  // include. The handoff's id set is authoritative for active Axi projects;
  // markdown-only entries are unioned in with `supplementary: true` so
  // downstream consumers can tell the two groups apart.
  let projects = [];
  let sourceLabel = '';
  let handoffSource = false;
  let handoffGeneratedAt = null;
  let handoffIds = new Set();

  const handoff = await readHandoffSnapshot();
  if (handoff.snapshot) {
    if (handoff.stale) {
      console.warn(
        `[projects:build] handoff snapshot is ${handoff.ageDays.toFixed(1)} days old ` +
          `(> ${HANDOFF_MAX_AGE_DAYS} day threshold); continuing with stale data. ` +
          `Re-run \`workspace-project handoff --json\` to refresh.`,
      );
    }
    try {
      projects = extractProjectsFromHandoff(handoff.snapshot, new Date());
      handoffIds = new Set(projects.map((p) => p.id));
      sourceLabel = 'handoff';
      handoffSource = true;
      handoffGeneratedAt = handoff.snapshot.generatedAt || null;
    } catch (snapshotError) {
      console.warn(
        `[projects:build] handoff snapshot could not be parsed (${snapshotError.message}); ` +
          `falling back to ${WORKSPACE_FALLBACK_PATH}.`,
      );
    }
  } else if (strict) {
    console.error(
      `[projects:build] --strict set but handoff snapshot is unavailable at ${HANDOFF_PATH} ` +
        `(${handoff.error.message}). Refusing to fall back to ${WORKSPACE_FALLBACK_PATH}.`,
    );
    process.exit(1);
  } else {
    console.warn(
      `[projects:build] handoff snapshot unavailable at ${HANDOFF_PATH} ` +
        `(${handoff.error.message}); falling back to ${WORKSPACE_FALLBACK_PATH}.`,
    );
  }

  if (projects.length === 0) {
    if (handoffSource) {
      // Handoff loaded but yielded zero projects — refuse to silently fall
      // through to a stale table; this is a real upstream contract change.
      throw new Error('handoff snapshot parsed successfully but produced zero projects. Aborting.');
    }
    const indexMarkdown = await readFile(WORKSPACE_FALLBACK_PATH, 'utf8');
    projects = extractProjects(indexMarkdown);
    sourceLabel = WORKSPACE_FALLBACK_PATH;
    handoffSource = false;
    handoffGeneratedAt = null;
  } else if (handoffSource && !flags.has('--no-supplementary')) {
    // Union in markdown-only entries (references, workspace virtual
    // projects, etc.) that the handoff does not list. A markdown id that
    // differs from any handoff id only by trailing characters (e.g. an
    // extra "y") still represents the same project — drop the markdown
    // duplicate by comparing the handoff ids normalised to the same slug
    // rule (lowercase, hyphenate). The build script's markdown parser
    // already produces that slug via `makeSlug`, so a simple
    // Set comparison is enough.
    let supplementary = [];
    try {
      const indexMarkdown = await readFile(WORKSPACE_FALLBACK_PATH, 'utf8');
      // Compare by canonical path (the only stable identifier both sides
      // share), not by `id` — handoff ids are owner-curated and may
      // shorten the slug in ways that `makeSlug` would not produce
      // (e.g. `ielts-vocab` vs `ielts-vocabulary`). Path collisions get
      // deduped; id differences survive on the handoff side and are
      // discarded here.
      const handoffPaths = new Set(projects.map((p) => p.path));
      supplementary = extractProjects(indexMarkdown).filter((entry) => !handoffPaths.has(entry.path));
    } catch {
      // WORKSPACE_INDEX.md missing or unreadable — the union simply
      // becomes the handoff list. Operators see a single warning above.
    }
    if (supplementary.length > 0) {
      projects = [
        ...projects,
        ...supplementary.map((entry) => ({ ...entry, supplementary: true })),
      ];
    }
  }

  if (projects.length === 0) {
    throw new Error(`No projects parsed from ${sourceLabel || 'available sources'}. Aborting.`);
  }

  // Emit the machine-readable index. Preserve any hand-curated addenda that
  // the previous run (or a manual edit) added — projects whose `id` is not
  // present in the freshly-parsed list. This lets us keep dbskill /
  // codex-plus-app (and any future hand-curated mirrors) across rebuilds
  // without polluting the handoff snapshot or WORKSPACE_INDEX.md.
  // A check must be read-only: validation should never create timestamp-only
  // worktree noise in the generated index.
  if (!flags.has('--no-index') && !flags.has('--check')) {
    let preserved = [];
    if (await exists(INDEX_JSON)) {
      try {
        const prev = JSON.parse(await readFile(INDEX_JSON, 'utf8'));
        if (Array.isArray(prev.projects)) {
          const freshIds = new Set(projects.map((p) => p.id));
          preserved = prev.projects.filter(
            (p) => !freshIds.has(p.id) && p.status && p.status.includes('hand-curated'),
          );
        }
      } catch {
        // Ignore parse errors; the rebuild will overwrite cleanly.
      }
    }
    const merged = [...projects, ...preserved];
    await writeFile(
      INDEX_JSON,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          source: sourceLabel,
          handoffSource,
          handoffGeneratedAt,
          handoffPath: HANDOFF_PATH,
          handoffMaxAgeDays: HANDOFF_MAX_AGE_DAYS,
          count: merged.length,
          preservedAddenda: preserved.map((p) => p.id),
          projects: merged,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
  }

  if (flags.has('--check')) {
    let missingRequired = 0;
    let missingOptional = 0;
    for (const project of projects) {
      for (const locale of locales) {
        // Required: 7 pieces must always be present.
        for (const piece of PIECES) {
          const filePath = path.join(CONTENT_ROOT, locale, 'projects', project.id, piece);
          if (!(await exists(filePath))) {
            console.error(`[projects:check] missing required ${locale}/${project.id}/${piece}`);
            missingRequired += 1;
          }
        }
        // Optional: present iff project root has the source file.
        for (const piece of OPTIONAL_PIECES) {
          const sourcePath = path.join(project.path, piece);
          if (!(await exists(sourcePath))) continue;
          const filePath = path.join(CONTENT_ROOT, locale, 'projects', project.id, piece);
          if (!(await exists(filePath))) {
            console.error(`[projects:check] missing optional ${locale}/${project.id}/${piece}`);
            missingOptional += 1;
          }
        }
        // Passthrough: present iff project root has the source file.
        for (const piece of PASSTHROUGH_FILES) {
          const sourcePath = path.join(project.path, piece);
          if (!(await exists(sourcePath))) continue;
          const filePath = path.join(CONTENT_ROOT, locale, 'projects', project.id, piece);
          if (!(await exists(filePath))) {
            console.error(`[projects:check] missing passthrough ${locale}/${project.id}/${piece}`);
            missingOptional += 1;
          }
        }
      }
    }
    if (missingRequired > 0) {
      console.error(`[projects:check] ${missingRequired} required file(s) missing.`);
      process.exit(1);
    }
    if (missingOptional > 0) {
      console.warn(`[projects:check] ${missingOptional} optional file(s) missing (re-run projects:build to regenerate).`);
    }
    const totalRequired = projects.length * locales.length * PIECES.length;
    console.log(`[projects:check] ${totalRequired} required dossier files present.`);
    return;
  }

  const summary = { written: 0, skipped: 0 };
  for (const project of projects) {
    for (const locale of locales) {
      const results = await buildForProject(project, locale);
      for (const [piece, action] of Object.entries(results)) {
        if (action === 'wrote') summary.written += 1;
        else summary.skipped += 1;
        // Verbose logging off by default; uncomment when debugging.
        // console.log(`[projects:build] ${action} ${locale}/${project.id}/${piece}`);
      }
    }
  }
  // Always (re)write the locale-level INDEX.md from the parsed project list.
  // This keeps the table in lockstep with the handoff snapshot (or markdown
  // fallback) without requiring a hand-edited summary.
  for (const { locale, path: indexPath } of INDEX_PAGES) {
    await writeFile(indexPath, indexPageBody({ locale, projects }), 'utf8');
    summary.written += 1;
  }
  console.log(
    `[projects:build] source=${sourceLabel} ${projects.length} projects × ${locales.length} locales × ${PIECES.length} pieces. ` +
      `wrote=${summary.written}, skipped=${summary.skipped}, index=${INDEX_JSON}`,
  );
}

main().catch((err) => {
  console.error('[projects:build] failed:', err.message);
  process.exit(1);
});
