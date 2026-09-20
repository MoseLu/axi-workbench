// Lint `docs/rules/` so the constraint pool stays machine-checkable.
// Designed to plug into `pnpm governance:check` (next to
// `error-doc:lint`).
//
// Validates:
//   1. `docs/rules/{README.md,INDEX.md,_template.md}` all exist.
//   2. Every `RNNN-*.md` file has a valid frontmatter with required keys.
//   3. Required body sections (`Trigger`, `Constraint`, `Guard`,
//      `Evidence`, `Related`) all present.
//   4. INDEX.md table covers every `R*.md` and vice versa (no orphans).
//   5. `verified-by` references a script that exists under
//      `app/scripts/check-*.mjs` or an explicit allow-list (to avoid
//      false positives during skeleton creation).

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const rulesDir = path.join(repoRoot, 'docs', 'rules');
const appScriptsDir = path.join(repoRoot, 'app', 'scripts');
const appPackageJson = path.join(repoRoot, 'app', 'package.json');

const REQUIRED_FRONTMATTER = ['id', 'title', 'severity', 'status', 'verified-by'];
const REQUIRED_SECTIONS = ['Trigger', 'Constraint', 'Guard', 'Evidence', 'Related'];
const SEVERITY_ENUM = new Set(['must-follow', 'should-follow', 'informational']);
const ID_RE = /^R(\d{3})-(.+)\.md$/;

function listRuleFiles() {
  if (!existsSync(rulesDir)) {
    throw new Error(`docs/rules/ 目录不存在: ${rulesDir}`);
  }
  return readdirSync(rulesDir)
    .filter((f) => ID_RE.test(f))
    .sort();
}

function readText(p) {
  return readFileSync(p, 'utf8');
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { ok: false, reason: 'frontmatter 缺失' };
  const body = m[1];
  const fields = {};
  for (const line of body.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k) fields[k] = v;
  }
  return { ok: true, fields };
}

function checkFile(filePath) {
  const errors = [];
  const fileName = path.basename(filePath);
  const text = readText(filePath);
  const fm = parseFrontmatter(text);
  if (!fm.ok) {
    errors.push(`${fileName}: ${fm.reason}`);
    return errors;
  }
  for (const k of REQUIRED_FRONTMATTER) {
    if (!fm.fields[k]) errors.push(`${fileName}: 缺 frontmatter 字段 '${k}'`);
  }
  if (fm.fields.severity && !SEVERITY_ENUM.has(fm.fields.severity)) {
    errors.push(`${fileName}: severity 取值非法 (${fm.fields.severity})`);
  }
  for (const sec of REQUIRED_SECTIONS) {
    const re = new RegExp(`^##\\s+${sec}\\s*$`, 'm');
    if (!re.test(text)) errors.push(`${fileName}: 缺 ## ${sec} 段`);
  }
  // verified-by must reference an existing check script (when not superseded).
  if (fm.fields.status && !fm.fields.status.startsWith('superseded-by')) {
    const m = fm.fields['verified-by']?.match(/rule:check-([\w-]+)/);
    if (m) {
      const short = m[1];
      const scriptPath = path.join(appScriptsDir, `check-${short}.mjs`);
      const pkgScripts = readPackageScripts();
      const scriptDeclared = Boolean(pkgScripts[`rule:check-${short}`]);
      if (!existsSync(scriptPath) && !scriptDeclared) {
        errors.push(
          `${fileName}: verified-by 引用 script ${scriptPath} 不存在,且 package.json 也未声明 rule:check-${short}`,
        );
      }
    }
  }
  return errors;
}

function readPackageScripts() {
  if (!existsSync(appPackageJson)) return {};
  try {
    const pkg = JSON.parse(readFileSync(appPackageJson, 'utf8'));
    return pkg.scripts || {};
  } catch {
    return {};
  }
}

function checkIndex(indexPath, ruleFiles, fmByFile) {
  const errors = [];
  if (!existsSync(indexPath)) {
    errors.push('INDEX.md 不存在');
    return errors;
  }
  const idxText = readText(indexPath);
  // Markdown link form `[R\d{3}](R\d{3}-...md)` represents a real
  // entry; bare `| R\d{3} |` rows are pending placeholders and are
  // ignored until the linked rule file lands.
  const linkedIds = new Set();
  for (const m of idxText.matchAll(/\[(R\d{3})\]\((R\d{3}-[^)]+\.md)\)/g)) {
    linkedIds.add(m[1]);
  }
  for (const f of ruleFiles) {
    const fm = fmByFile.get(f);
    if (fm?.fields.id && !linkedIds.has(fm.fields.id)) {
      errors.push(`INDEX.md 未收录 ${fm.fields.id} (file ${f})`);
    }
  }
  for (const id of linkedIds) {
    const hit = ruleFiles.find((f) => fmByFile.get(f)?.fields.id === id);
    if (!hit) errors.push(`INDEX.md 引用不存在的 ${id}`);
  }
  return errors;
}

function main() {
  // 1. Skeleton files exist.
  const skeleton = ['README.md', 'INDEX.md', '_template.md'].map((f) =>
    path.join(rulesDir, f),
  );
  for (const p of skeleton) {
    if (!existsSync(p)) {
      console.error(`[rules-doc:lint] missing skeleton file: ${p}`);
      process.exit(1);
    }
  }

  // 2-3. Per-file check.
  const files = listRuleFiles();
  const fmByFile = new Map();
  const allErrors = [];
  for (const f of files) {
    const fp = path.join(rulesDir, f);
    const text = readText(fp);
    const fm = parseFrontmatter(text);
    if (fm.ok) fmByFile.set(f, { fields: fm.fields });
    allErrors.push(...checkFile(fp));
  }

  // 4. Index sync.
  allErrors.push(...checkIndex(path.join(rulesDir, 'INDEX.md'), files, fmByFile));

  if (allErrors.length > 0) {
    console.error('[rules-doc:lint] 发现问题:');
    for (const e of allErrors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`[rules-doc:lint] ok (${files.length} 条 R-NNN)`);
}

main();
