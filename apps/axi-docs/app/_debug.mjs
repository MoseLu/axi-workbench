import { readFile } from 'node:fs/promises';
const text = await readFile(new URL('../docs/state/ERROR.md', import.meta.url), 'utf8');
const ENTRY_ID_RE = /^(?<id>\d{4}-\d{2}-\d{2}-\d{2}) — (?<title>.+)$/;
const level = 'P0';
const headingEn = 'P0 — Must-fix';
const re = new RegExp(`^#{2,3}\\s+${headingEn}\\b`, 'm');
const m = re.exec(text);
console.log('heading match at', m.index, 'text:', m[0]);
const start = m.index + m[0].length;
const tail = text.slice(start);
console.log('tail (first200):', tail.slice(0,200));
const next = tail.match(/^##\s+/m);
console.log('next heading:', next ? next[0] : 'none', 'at offset', next ? next.index : -1);
const section = next ? tail.slice(0, next.index) : tail;
console.log('section length:', section.length);
console.log('section first300:', section.slice(0,300));
const re2 = /^###\s+(?<line>.+?)\s*$/gm;
let mm;
let count =0;
while ((mm = re2.exec(section)) !== null) {
 const parsed = ENTRY_ID_RE.exec(mm.groups.line);
 console.log('candidate:', JSON.stringify(mm.groups.line), 'parsed:', parsed ? parsed.groups.id : 'NO');
 count++;
 if (count >5) break;
}
