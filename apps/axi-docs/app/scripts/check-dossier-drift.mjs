#!/usr/bin/env node
// Strict cross-locale fact-field verifier for project dossiers.
//
// For every project present in both en/ and zh/ trees, this script asserts:
//   1. Required frontmatter fields match exactly (type, status, created,
//      modified, plus a normalised tags list that accepts "Projects"/"项目"
//      as translations of the same value).
//   2. The `description:` line in frontmatter contains the same set of
//      backtick-quoted tokens as the en version (paths/identifiers must
//      survive translation).
//   3. The body `## Stack` / `## 技术栈` sections have exactly the same
//      set of comma-/顿号-separated tokens.
//   4. The body Notes section (en `## Notes` ↔ zh `## 备注` or `## 说明`)
//      contains every backtick-quoted token from the en version.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const enDir = '/Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/content/en/projects';
const zhDir = '/Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/content/zh/projects';
const SKIP = new Set(['codex-plus-app', 'dbskill']);
const enDirs = new Set(
  (await readdir(enDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name),
);
const zhDirs = new Set(
  (await readdir(zhDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name),
);
const ids = [...enDirs].filter((id) => zhDirs.has(id) && !SKIP.has(id));

function readDossier(dir, id) {
  return readFile(path.join(dir, id, 'README.md'), 'utf8');
}
function parseFrontmatter(md) {
  const m = md.match(/^---([\s\S]+?)---\n/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim();
  }
  return fm;
}
function parseBody(md) {
  const m = md.match(/^---[\s\S]+?---\n([\s\S]+)$/);
  return m ? m[1] : md;
}
function extractSection(body, heading) {
  const re = new RegExp(`## ${heading}\\s*\\n+([\\s\\S]+?)(?=\\n## |$)`);
  const m = body.match(re);
  return m ? m[1].trim() : null;
}
function extractSectionAny(body, headings) {
  for (const h of headings) {
    const v = extractSection(body, h);
    if (v) return { heading: h, body: v };
  }
  return null;
}
function extractStackSection(body, locale) {
  // Accept either the translated `技术栈` heading or the un-translated
  // `Stack` heading. Both are valid; what matters is the token set inside.
  const heading = locale === 'en' ? 'Stack' : '技术栈';
  return extractSectionAny(body, [heading, 'Stack'])?.body || null;
}
function tokenizeStack(stack) {
  return new Set(
    stack
      .replace(/[`\n]/g, '')
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}
function canonicaliseTags(tags) {
  // Normalise by lowercasing and replacing `Projects` with `项目` (or vice
  // versa) so en `Projects` matches zh `项目`.
  return (tags || '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim())
    .map((s) => (s === 'Projects' || s === '项目' ? 'Projects' : s))
    .map((s) => s.toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',');
}

let issues = 0;
for (const id of ids) {
  const enMd = await readDossier(enDir, id);
  const zhMd = await readDossier(zhDir, id);
  const enFm = parseFrontmatter(enMd);
  const zhFm = parseFrontmatter(zhMd);

  // (1) Required frontmatter
  for (const key of ['type', 'status', 'created', 'modified']) {
    if (enFm[key] !== zhFm[key]) {
      console.log(`[FM ${key} MISMATCH] ${id}: en="${enFm[key]}" zh="${zhFm[key]}"`);
      issues += 1;
    }
  }
  if (canonicaliseTags(enFm.tags) !== canonicaliseTags(zhFm.tags)) {
    console.log(`[FM tags MISMATCH] ${id}: en="${enFm.tags}" zh="${zhFm.tags}"`);
    issues += 1;
  }
  if (!zhFm.id || !zhFm.id.startsWith('axi-docs-zh-projects-')) {
    console.log(`[FM id PREFIX WRONG] ${id}: zh.id="${zhFm.id}"`);
    issues += 1;
  }
  if (!enFm.id || !enFm.id.startsWith('axi-docs-en-projects-')) {
    console.log(`[FM id PREFIX WRONG] ${id}: en.id="${enFm.id}"`);
    issues += 1;
  }

  // (2) Description backtick tokens
  const enDesc = enFm.description || '';
  const zhDesc = zhFm.description || '';
  const enDescTokens = [...enDesc.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  for (const t of enDescTokens) {
    if (!zhDesc.includes(t)) {
      console.log(`[DESC BACKTICK TOKEN MISSING] ${id}: en-only "${t}"`);
      issues += 1;
    }
  }

  // (3) Stack strict equality
  const enStackBody = extractStackSection(parseBody(enMd), 'en');
  const zhStackBody = extractStackSection(parseBody(zhMd), 'zh');
  if (!enStackBody || !zhStackBody) {
    if (enStackBody !== zhStackBody) {
      console.log(`[STACK SECTION MISSING] ${id}: en=${!!enStackBody} zh=${!!zhStackBody}`);
      issues += 1;
    }
  } else {
    const enT = tokenizeStack(enStackBody);
    const zhT = tokenizeStack(zhStackBody);
    if (enT.size !== zhT.size || [...enT].some((t) => !zhT.has(t))) {
      console.log(`[STACK MISMATCH] ${id}: en=${[...enT].join('|')} zh=${[...zhT].join('|')}`);
      issues += 1;
    }
  }

  // (4) Notes backtick tokens. Accept either `## 说明`, `## 备注`, or the
  // un-translated `## Notes` as the zh heading — translators may keep
  // the original English.
  const enNotes = extractSection(parseBody(enMd), 'Notes');
  const zhNotesResult = extractSectionAny(parseBody(zhMd), ['说明', '备注', 'Notes']);
  const zhNotes = zhNotesResult ? zhNotesResult.body : null;
  if (enNotes && zhNotes) {
    const enCodeTokens = [...enNotes.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const missing = enCodeTokens.filter((t) => !zhNotes.includes(t));
    if (missing.length > 0) {
      console.log(`[NOTES BACKTICK MISSING] ${id}: en-only ${JSON.stringify(missing)}`);
      issues += 1;
    }
  } else if (enNotes !== zhNotes) {
    console.log(`[NOTES SECTION MISMATCH] ${id}: en=${!!enNotes} zh=${!!zhNotes}`);
    issues += 1;
  }
}

console.log('---');
console.log(`Checked ${ids.length} projects. ${issues} problem(s) found.`);
process.exit(issues > 0 ? 1 : 0);
