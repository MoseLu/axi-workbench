// Lint docs/state/ERROR.md (and its ERROR.zh-CN.md mirror) so structural
// defects recorded there stay machine-checkable. Designed to plug into
// `pnpm governance:check`.
//
// Run from `app/`: `node ./scripts/lint-error-doc.mjs`
//
// Validates:
//1. Both `docs/state/ERROR.md` and `docs/state/ERROR.zh-CN.md` exist.
//2. Each entry heading matches `<YYYY-MM-DD>-<NN> — <title>`.
//3. Each entry contains the required front-matter lines (Severity /
// Status / Affected project in EN;优先级 /状态 /涉及项目 in ZH) and
// the required body sections (Symptom, Root Cause, Fix, Lessons,
// Related in EN;现象,根因,修复,教训, 相关 in ZH).
//4. The index table covers every entry actually present in the body.
//5. The anchor `#<id>` in each index row exists in the body.
//6. Status is one of `open` / `fixed` / `accepted-as-limitation`.
//7. Severity level tag (P0/P1/P2) matches the section the entry sits
// under.
//
// The script is intentionally tolerant of whitespace / casing on field
// labels because bilingual mirrors will not be byte-identical, but it is
// strict on structural invariants.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const stateDocsRoot = path.join(repoRoot, 'docs', 'state');
const errorDocEn = path.join(stateDocsRoot, 'ERROR.md');
const errorDocZh = path.join(stateDocsRoot, 'ERROR.zh-CN.md');

const ENTRY_ID_RE = /^(?<id>\d{4}-\d{2}-\d{2}-\d{2}) — (?<title>.+)$/;
const ALLOWED_STATUS = new Set(['open', 'fixed', 'accepted-as-limitation']);
const ALLOWED_LEVELS = new Set(['P0', 'P1', 'P2']);

const HEADINGS = {
 P0: { en: 'P0 — Must-fix', zh: 'P0 — 必修' },
 P1: { en: 'P1 — Strongly recommended', zh: 'P1 — 强烈建议' },
 P2: { en: 'P2 — Empirical observation', zh: 'P2 — 经验性观察' },
};

// `text.indexOf(heading)` rather than a regex with `\b` because em-dash
// (`—`) is not a word character, so word-boundary anchors misbehave.
function findSection(text, heading) {
 const candidates = [`## ${heading}`, `### ${heading}`];
 let bestIdx = -1;
 for (const c of candidates) {
 const i = text.indexOf(c);
 if (i >=0 && (bestIdx <0 || i < bestIdx)) bestIdx = i;
 }
 if (bestIdx <0) return null;
 const newlineAfter = text.indexOf('\n', bestIdx);
 const start = newlineAfter <0 ? text.length : newlineAfter +1;
 const tail = text.slice(start);
 // A level section (`## P0 — Must-fix`) terminates only at the next
 // `## <level>` heading. Entry headings (`### YYYY-MM-DD-NN — …`) and
 // sub-section headings (`#### Symptom`) are content of the current
 // level section, not terminators.
 const next = tail.match(/^##\s+/m);
 return next ? tail.slice(0, next.index) : tail;
}

function parseEntries(text) {
 const entries = [];
 for (const level of ALLOWED_LEVELS) {
 for (const lang of ['en', 'zh']) {
 const section = findSection(text, HEADINGS[level][lang]);
 if (!section) continue;
 const re = /^###\s+(?<line>.+?)\s*$/gm;
 let m;
 while ((m = re.exec(section)) !== null) {
 const parsed = ENTRY_ID_RE.exec(m.groups.line);
 if (!parsed) continue;
 entries.push({
 id: parsed.groups.id,
 title: parsed.groups.title,
 level,
 });
 }
 break; // only need one of (en, zh) — content is structurally identical
 }
 }
 return entries;
}

function parseIndexRows(text) {
 // The index table sits under `## Index` (English) or `##索引`
 // (Chinese mirror). Rows look like:
 // | <level> | [<id>](#<id>) | <title> | ... |
 const headingIdx = (() => {
 const en = text.indexOf('## Index');
 const zh = text.indexOf('## 索引');
 if (en <0) return zh;
 if (zh <0) return en;
 return Math.min(en, zh);
 })();
 if (headingIdx <0) return [];
 const after = text.slice(headingIdx);
 // Skip the heading line itself so the `^##\s+` terminator doesn't match
 // the heading we just located.
 const afterNewline = after.indexOf('\n');
 const tail = afterNewline <0 ? '' : after.slice(afterNewline +1);
 // Find end of the index table: either the next `---` line at column0
 // or the next `## ` heading (whichever comes first).
 const hrMatch = tail.match(/^---\s*$/m);
 const nextH2 = tail.match(/^##\s+/m);
 let end;
 if (hrMatch && nextH2) {
 end = Math.min(hrMatch.index, nextH2.index);
 } else if (hrMatch) {
 end = hrMatch.index;
 } else if (nextH2) {
 end = nextH2.index;
 } else {
 end = tail.length;
 }
 const tableBlock = tail.slice(0, end);
 const rows = [];
 for (const line of tableBlock.split('\n')) {
 if (!line.trim().startsWith('|')) continue;
 if (line.includes('------')) continue;
 const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
 if (cells.length <2) continue;
 const linkMatch = cells[1].match(/#([0-9-]+)\)/);
 if (!linkMatch) continue;
 rows.push({ id: linkMatch[1], level: cells[0] });
 }
 return rows;
}

function findAnchorIndex(text, id) {
 return text.search(new RegExp(`<a\\s+id=["']${id}["']`));
}

async function lintOne({ docPath, requiredLabels, label }) {
 const errors = [];
 let text;
 try {
 text = await readFile(docPath, 'utf8');
 } catch (err) {
 errors.push(`[${label}] cannot read: ${err.message}`);
 return errors;
 }

 const entries = parseEntries(text);
 const indexRows = parseIndexRows(text);

 // Anchor presence per index row.
 for (const row of indexRows) {
 if (findAnchorIndex(text, row.id) <0) {
 errors.push(`[${label}] index row ${row.id} has no matching <a id="…"> anchor in body`);
 }
 }

 // Index ↔ body parity.
 const entryIds = new Set(entries.map((e) => e.id));
 const rowIds = new Set(indexRows.map((r) => r.id));
 for (const id of entryIds) {
 if (!rowIds.has(id)) errors.push(`[${label}] entry ${id} present in body but missing from index`);
 }
 for (const id of rowIds) {
 if (!entryIds.has(id)) errors.push(`[${label}] index row ${id} has no matching entry`);
 }

 // Level + required fields + sub-sections per entry.
 const rowLevelById = new Map(indexRows.map((r) => [r.id, r.level]));
 const sectionHeadings = label === 'ERROR.md'
 ? ['Symptom', 'Root Cause', 'Fix', 'Lessons', 'Related']
 : ['现象', '根因', '修复', '教训', '相关'];

 for (const entry of entries) {
 const rowLevel = rowLevelById.get(entry.id);
 if (rowLevel && rowLevel !== entry.level) {
 errors.push(`[${label}] ${entry.id}: index says ${rowLevel} but entry is under ${entry.level}`);
 }

 // Re-locate this entry's body to scan its front-matter / sub-sections.
 const entryHeadingRe = new RegExp(`^###\\s+${entry.id}\\s+—\\s+.+$`, 'm');
 const m = entryHeadingRe.exec(text);
 if (!m) {
 errors.push(`[${label}] ${entry.id}: cannot relocate entry heading`);
 continue;
 }
 const tail = text.slice(m.index + m[0].length);
 // Entry body extends to the next `## <level>` heading.
 const next = tail.match(/^##\s+/m);
 const body = next ? tail.slice(0, next.index) : tail;

 for (const field of requiredLabels) {
 const re = new RegExp(`\\*\\*${field}\\*\\*[:：]`, 'i');
 if (!re.test(body)) {
 errors.push(`[${label}] ${entry.id}: missing required field "${field}"`);
 }
 }

 const statusMatch = body.match(/\*\*Status\*\*[:：]\s*`?([a-zA-Z-]+)`?/i)
 ?? body.match(/\*\*状态\*\*[:：]\s*`?([a-zA-Z-]+)`?/);
 if (statusMatch && !ALLOWED_STATUS.has(statusMatch[1])) {
 errors.push(`[${label}] ${entry.id}: status "${statusMatch[1]}" not in ${[...ALLOWED_STATUS].join(' | ')}`);
 }

 for (const heading of sectionHeadings) {
 // Use `\s*$` instead of `\b` because CJK characters are not word
 // characters, so `\b` does not behave as a boundary after a
 // Chinese heading.
 const re = new RegExp(`^#{4,6}\\s+${heading}\\s*$`, 'm');
 if (!re.test(body)) {
 errors.push(`[${label}] ${entry.id}: missing section "#### ${heading}"`);
 }
 }
 }

 return errors;
}

const allErrors = [];
allErrors.push(...(await lintOne({
 docPath: errorDocEn,
 requiredLabels: ['Severity', 'Status', 'Affected project'],
 label: 'ERROR.md',
})));
allErrors.push(...(await lintOne({
 docPath: errorDocZh,
 requiredLabels: ['优先级', '状态', '涉及项目'],
 label: 'ERROR.zh-CN.md',
})));

// Both files must coexist if either exists.
try {
 await readFile(errorDocEn, 'utf8');
 await readFile(errorDocZh, 'utf8');
} catch {
 allErrors.push('Both docs/state/ERROR.md and docs/state/ERROR.zh-CN.md must exist.');
}

if (allErrors.length >0) {
 console.error('[error-doc] lint failed:');
 for (const e of allErrors) console.error(` - ${e}`);
 process.exit(1);
}

console.log('[error-doc] lint passed.');
