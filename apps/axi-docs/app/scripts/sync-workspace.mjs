#!/usr/bin/env node
/**
 * sync-workspace.mjs
 *
 * Collects workspace project profiles from
 * `/Volumes/code/workspace/workspace.graph.json` (preferred machine-readable
 * source) with a markdown fallback to `WORKSPACE_INDEX.md`, and renders two
 * compact Markdown index files (Chinese + English) under
 * `app/docs/content/{zh,en}/_workspace/projects-index.md`.
 *
 * Compared to `build-projects-index.mjs` (which generates seven-piece
 * dossiers per project), this script produces a single flat table per
 * locale -- a quick navigation surface for Axi Docs users browsing the
 * AxiomaticWorld workspace.
 *
 * Usage:
 *   pnpm sync:workspace                  # generate both locales
 *   node ./scripts/sync-workspace.mjs    # equivalent (no flags)
 *   node ./scripts/sync-workspace.mjs --check    # exit 1 if files are stale
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
// app/docs/content/{zh,en}/_workspace/projects-index.md
const CONTENT_ROOT = path.join(REPO_ROOT, 'docs', 'content');
const WORKSPACE_ROOT = '/Volumes/code/workspace';
const WORKSPACE_GRAPH = path.join(WORKSPACE_ROOT, 'workspace.graph.json');
const WORKSPACE_INDEX = path.join(WORKSPACE_ROOT, 'WORKSPACE_INDEX.md');

// Top-level partitions we scan (per WORKSPACE_INDEX.md partition contract).
const PARTITIONS = [
  'foundation',
  'workbench',
  'products',
  'candidates',
  'distributions',
  'tools',
  'references',
  'archive',
  'agent-cluster',
];

const SUMMARY_MAX = 200;          // first paragraph soft limit (chars)
const DESCRIPTION_HARD_LIMIT = 160; // one-liner in the table cell

const PARTITION_LABELS = {
  en: {
    foundation: 'foundation',
    workbench: 'workbench',
    products: 'products',
    candidates: 'candidates',
    distributions: 'distributions',
    tools: 'tools',
    references: 'references',
    archive: 'archive',
    'agent-cluster': 'agent-cluster',
  },
  zh: {
    foundation: 'foundation（共享基础）',
    workbench: 'workbench（工作台）',
    products: 'products（独立产品）',
    candidates: 'candidates（候选项目）',
    distributions: 'distributions（分发产物）',
    tools: 'tools（本地工具）',
    references: 'references（外部参考）',
    archive: 'archive（已归档）',
    'agent-cluster': 'agent-cluster（代理集群）',
  },
};

const HEADERS = {
  en: {
    title: 'AxiomaticWorld Workspace Index',
    subtitle: 'Auto-generated project index. Source: `/Volumes/code/workspace/workspace.graph.json`.',
    intro:
      'This page lists every active AxiomaticWorld project discovered in the workspace. ' +
      'It is regenerated automatically by `pnpm sync:workspace`; do not hand-edit.',
    columns: ['Project ID', 'Partition', 'One-line Description', 'Entry File', 'Status'],
    localeNote:
      'Source-of-truth workspace index: `WORKSPACE_INDEX.md` (workspace root). ' +
      'Machine-readable registry: `workspace.graph.json`.',
    refresh: 'Re-run `pnpm sync:workspace` after editing `WORKSPACE_INDEX.md` or moving project roots.',
  },
  zh: {
    title: 'AxiomaticWorld 工作区项目索引',
    subtitle: '自动生成的项目清单。数据源：`/Volumes/code/workspace/workspace.graph.json`。',
    intro:
      '本页列出在工作区中发现的全部 active AxiomaticWorld 项目。' +
      '由 `pnpm sync:workspace` 自动重新生成，请勿手工修改。',
    columns: ['项目 ID', '分区', '一句话描述', '入口文件', '状态'],
    localeNote:
      '工作区索引源：`WORKSPACE_INDEX.md`（工作区根）。' +
      '机器可读注册表：`workspace.graph.json`。',
    refresh: '修改 `WORKSPACE_INDEX.md` 或调整项目根目录后，请重新运行 `pnpm sync:workspace`。',
  },
};

function nowIso() {
  return new Date().toISOString();
}

function derivePartition(absPath) {
  if (!absPath || !absPath.startsWith(WORKSPACE_ROOT + '/')) return '—';
  const rest = absPath.slice(WORKSPACE_ROOT.length + 1);
  const head = rest.split('/')[0];
  return PARTITIONS.includes(head) ? head : '—';
}

function deriveId(name, absPath) {
  // Slug for the table column. Prefer the trailing path segment of the
  // project root (e.g. `axi-kernel`) so the id matches what most people
  // recognise; fall back to a slugified display name when the path is
  // missing.
  const basis = absPath ? absPath.split('/').filter(Boolean).pop() : name;
  return String(basis || name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Pick the entry file we advertise in the table. Prefer AGENTS.md (the
 * canonical agent entrypoint per workspace governance), then README.md,
 * then leave an em-dash.
 */
function pickEntryFile(projectRoot) {
  return null; // placeholder; computed below once we have a project root
}

async function firstParagraph(filePath, max = SUMMARY_MAX) {
  try {
    const raw = await readFile(filePath, 'utf8');
    // Strip frontmatter if present (--- ... ---).
    const stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
    // Split into paragraph blocks separated by blank lines.
    const blocks = stripped.split(/\n\s*\n/);
    // Skip blocks that are pure headings / hrules / blockquote starters so
    // we surface the first block of *prose* (typical AGENTS.md opens with
    // `# Title` then blank line, then the real description).
    const prose = blocks
      .map((b) => b.replace(/\s+/g, ' ').trim())
      .find((b) => b && !/^#+\s/.test(b) && !/^---+$/.test(b));
    if (!prose) return '';
    if (prose.length <= max) return prose;
    // Truncate on a word boundary and add an ellipsis.
    const slice = prose.slice(0, max);
    const lastSpace = slice.lastIndexOf(' ');
    return (lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…';
  } catch {
    return '';
  }
}

async function summariseProject(projectRoot) {
  // Try AGENTS.md first, then README.md.
  const agentsPath = path.join(projectRoot, 'AGENTS.md');
  const readmePath = path.join(projectRoot, 'README.md');
  let summary = await firstParagraph(agentsPath);
  let entry = 'AGENTS.md';
  if (!summary) {
    summary = await firstParagraph(readmePath);
    entry = 'README.md';
  }
  if (!summary) {
    entry = '—';
  }
  // Trim the table-cell copy more aggressively than the raw summary.
  const oneLiner = summary.length > DESCRIPTION_HARD_LIMIT
    ? summary.slice(0, DESCRIPTION_HARD_LIMIT - 1).trimEnd() + '…'
    : summary;
  return { entry, summary, oneLiner };
}

function deriveStatus(project) {
  if (!project) return '—';
  if (project.external) return 'external';
  if (project.completion && typeof project.completion.stage === 'string') {
    return project.completion.stage;
  }
  if (typeof project.lifecycle === 'string') return project.lifecycle;
  if (typeof project.kind === 'string') return project.kind;
  return '—';
}

/**
 * Load projects from `workspace.graph.json`. Returns an array of
 * normalised project records. Skips:
 *   - the workspace root anchor itself,
 *   - external resources whose path is not under one of `PARTITIONS`,
 *   - projects whose name lacks a usable label.
 */
async function loadProjectsFromGraph() {
  const raw = await readFile(WORKSPACE_GRAPH, 'utf8');
  const graph = JSON.parse(raw);
  const entries = Object.entries(graph.projects || {});
  const projects = [];
  for (const [key, project] of entries) {
    if (!project || typeof project !== 'object') continue;
    const projectPath = typeof project.path === 'string' ? project.path : '';
    if (!projectPath.startsWith(WORKSPACE_ROOT + '/')) continue;
    const partition = derivePartition(projectPath);
    if (partition === '—') continue;
    // Skip workspace-root anchors and shallow infra (e.g. shared /Users/...).
    if (project.kind === 'workspace-anchor') continue;
    const name = (project.name || key || '').trim();
    if (!name) continue;
    projects.push({
      id: deriveId(name, projectPath),
      key,
      name,
      path: projectPath,
      partition,
      status: deriveStatus(project),
      kind: project.kind || null,
      lifecycle: project.lifecycle || null,
      external: Boolean(project.external),
    });
  }
  // Deterministic ordering: partition then name.
  projects.sort((a, b) => {
    if (a.partition !== b.partition) return a.partition.localeCompare(b.partition);
    return a.name.localeCompare(b.name);
  });
  return projects;
}

/**
 * Fallback parser: pull the workspace index table out of WORKSPACE_INDEX.md.
 * This only gives us name + relative path; description / status columns
 * remain em-dashes until the handoff or graph is regenerated. The fallback
 * is intentionally minimal -- the preferred path is `workspace.graph.json`.
 */
async function loadProjectsFromIndex() {
  const raw = await readFile(WORKSPACE_INDEX, 'utf8');
  const projects = [];
  // Lines shaped like `| [\`name\`](./relative/path/README.md) | \`/abs/path\` | ...`
  const pattern =
    /^\|\s*(?:\[\s*`?([^`]*)`?\s*\]\([^)]*\)|`([^`]+)`|([^|]+))\s*\|\s*`?(\/Volumes\/code\/workspace\/[^`|\s]+)`?\s*\|/gm;
  let match;
  while ((match = pattern.exec(raw)) !== null) {
    const name = (match[1] || match[2] || match[3] || '').trim();
    const absPath = match[4].trim();
    if (!name || !absPath) continue;
    const partition = derivePartition(absPath);
    if (partition === '—') continue;
    projects.push({
      id: deriveId(name, absPath),
      key: name,
      name,
      path: absPath,
      partition,
      status: '—',
      kind: null,
      lifecycle: null,
      external: false,
    });
  }
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

async function loadProjects() {
  try {
    const projects = await loadProjectsFromGraph();
    if (projects.length > 0) {
      return { projects, source: 'workspace.graph.json' };
    }
  } catch (err) {
    console.warn(
      `[sync-workspace] failed to parse workspace.graph.json (${err.message}); falling back to WORKSPACE_INDEX.md`,
    );
  }
  const projects = await loadProjectsFromIndex();
  return { projects, source: 'WORKSPACE_INDEX.md' };
}

function escapeCell(text) {
  // Markdown table cells cannot contain a literal pipe; escape them and
  // collapse internal newlines so the row stays single-line.
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n+/g, ' ')
    .trim();
}

function buildMarkdown({ locale, projects, generatedAt, source }) {
  const H = HEADERS[locale];
  const lines = [];
  const banner = locale === 'zh' ? '由 `pnpm sync:workspace` 自动生成' : 'Auto-generated by `pnpm sync:workspace`';
  lines.push(`<!-- ${banner} at ${generatedAt} -- DO NOT EDIT -->`);
  lines.push('');
  lines.push(`# ${H.title}`);
  lines.push('');
  lines.push(`> ${H.subtitle}`);
  lines.push('');
  lines.push(`> ${H.intro}`);
  lines.push('');
  lines.push(`> 生成时间 / Generated at: **${generatedAt}** · 数据源 / Source: \`${source}\` · 项目数 / Projects: **${projects.length}**`);
  lines.push('');
  lines.push(`## ${locale === 'zh' ? '项目清单 / Project Roster' : 'Project Roster'}`);
  lines.push('');
  lines.push(`| ${H.columns.join(' | ')} |`);
  lines.push(`| ${H.columns.map(() => '---').join(' | ')} |`);
  // Group by partition for readability.
  const grouped = new Map();
  for (const project of projects) {
    const list = grouped.get(project.partition) || [];
    list.push(project);
    grouped.set(project.partition, list);
  }
  for (const partition of PARTITIONS) {
    const rows = grouped.get(partition);
    if (!rows || rows.length === 0) continue;
    lines.push('');
    lines.push(`### \`${partition}/\` (${rows.length})`);
    lines.push('');
    for (const project of rows) {
      lines.push(
        `| \`${escapeCell(project.id)}\` | \`${escapeCell(PARTITION_LABELS[locale][partition] || partition)}\` | ${escapeCell(project.oneLiner || '—')} | \`${escapeCell(project.entry || '—')}\` | \`${escapeCell(project.status)}\` |`,
      );
    }
  }
  lines.push('');
  lines.push(`## ${locale === 'zh' ? '备注 / Notes' : 'Notes'}`);
  lines.push('');
  lines.push(`- ${H.localeNote}`);
  lines.push(`- ${H.refresh}`);
  lines.push(
    `- ${locale === 'zh' ? '本文件由脚本生成，请勿手工编辑。' : 'This file is generated by a script; do not edit by hand.'}`,
  );
  lines.push('');
  return lines.join('\n');
}

function normalizeForCheck(body) {
  // Strip the generation timestamp from the banner line and from the
  // "generated at" status line. The rest of the file is deterministic
  // output from `workspace.graph.json` / project root summaries, and any
  // change there should still trip `--check`. This normalization lets two
  // consecutive runs (where the timestamp naturally drifts) compare equal.
  return body
    .replace(/<!-- .*?at \d{4}-\d{2}-\d{2}T[^\s]+ .*?-->/, '<!-- normalized -->')
    .replace(/\*\*\d{4}-\d{2}-\d{2}T[^\s]+\*\*/g, '**normalized**');
}

async function writeForLocale({ locale, projects, generatedAt, source, check }) {
  const dir = path.join(CONTENT_ROOT, locale, '_workspace');
  const target = path.join(dir, 'projects-index.md');
  const body = buildMarkdown({ locale, projects, generatedAt, source });
  if (check) {
    let current = '';
    try {
      current = await readFile(target, 'utf8');
    } catch {
      console.error(`[sync-workspace] --check failed: ${target} does not exist.`);
      return false;
    }
    if (normalizeForCheck(current) !== normalizeForCheck(body)) {
      console.error(`[sync-workspace] --check failed: ${target} is out of date.`);
      return false;
    }
    return true;
  }
  await mkdir(dir, { recursive: true });
  await writeFile(target, body, 'utf8');
  return target;
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const check = flags.has('--check');

  let { projects, source } = await loadProjects();
  if (projects.length === 0) {
    throw new Error('No projects discovered from any workspace source. Aborting.');
  }

  // Enrich each project with its summary, one-liner, and entry file by
  // reading the project root's AGENTS.md (preferred) / README.md.
  for (const project of projects) {
    const { entry, summary, oneLiner } = await summariseProject(project.path);
    project.entry = entry;
    project.summary = summary;
    project.oneLiner = oneLiner;
  }

  const generatedAt = nowIso();

  const results = {};
  for (const locale of ['en', 'zh']) {
    const outcome = await writeForLocale({
      locale,
      projects,
      generatedAt,
      source,
      check,
    });
    results[locale] = outcome;
  }

  if (check) {
    const failures = Object.entries(results).filter(([, ok]) => !ok);
    if (failures.length > 0) {
      console.error(
        `[sync-workspace] --check failed for locales: ${failures.map(([l]) => l).join(', ')}. ` +
          'Run `pnpm sync:workspace` to refresh.',
      );
      process.exit(1);
    }
    console.log(`[sync-workspace] --check ok: ${projects.length} projects, both locales up to date (source=${source}).`);
    return;
  }

  for (const [locale, target] of Object.entries(results)) {
    console.log(`[sync-workspace] wrote ${locale} → ${target} (${projects.length} rows, source=${source})`);
  }
}

main().catch((err) => {
  console.error('[sync-workspace] failed:', err.message);
  if (process.env.DEBUG_SYNC_WORKSPACE) console.error(err.stack);
  process.exit(1);
});
