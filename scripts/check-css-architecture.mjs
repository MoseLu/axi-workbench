import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const roots = [
  'apps/workbench/src',
  'apps/workbench-mobile/src',
  'apps/workbench-desktop/src',
  'packages/ui/src',
  'apps/axi-artboard/src',
  'apps/axi-docs/app/src',
  'apps/devsvc-dashboard/src',
  'apps/verification-inbox/src',
  'apps/resource-orchestration/src',
  'infra/fleet-console/dashboard/src',
];
async function collectStyles(directory) {
  try {
    await access(path.join(root, directory));
  } catch {
    return [];
  }
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectStyles(relative));
    else if (/\.(css|scss|less)$/.test(entry.name)) files.push(relative);
  }
  return files;
}

const styleFiles = (await Promise.all(roots.map(collectStyles))).flat().sort();

const findings = [];
const tokenDeclarations = new Map();
const globalSelectors = /(^|[,{]\s*)(html|body|:root|\*|button|input|textarea|select|a)(\s*[,:{])/m;
const literalColor = /#[0-9a-f]{3,8}\b|\brgba?\(/i;

for (const relative of styleFiles) {
  const absolute = path.join(root, relative);
  const source = await readFile(absolute, 'utf8');
  const lines = source.split('\n');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/(--[a-z0-9_-]+)\s*:/gi)) {
      const token = match[1];
      const locations = tokenDeclarations.get(token) ?? [];
      locations.push(`${relative}:${index + 1}`);
      tokenDeclarations.set(token, locations);
    }
    if (line.includes('!important')) {
      findings.push({ type: 'important', file: relative, line: index + 1 });
    }
    if (globalSelectors.test(line) && !relative.includes('/styles/variables.css')) {
      findings.push({ type: 'global-selector', file: relative, line: index + 1 });
    }
    if (literalColor.test(line) && !relative.includes('/tokens')) {
      findings.push({ type: 'literal-color', file: relative, line: index + 1 });
    }
  });
}

const duplicates = [...tokenDeclarations.entries()]
  .filter(([, locations]) => new Set(locations.map((location) => location.split(':')[0])).size > 1)
  .map(([token, locations]) => ({ token, locations }));

const summary = {
  files: styleFiles.length,
  important: findings.filter((item) => item.type === 'important').length,
  globalSelectors: findings.filter((item) => item.type === 'global-selector').length,
  literalColors: findings.filter((item) => item.type === 'literal-color').length,
  duplicatedTokens: duplicates.length,
};

console.log(JSON.stringify({ summary, duplicatedTokens: duplicates.slice(0, 40), findings: findings.slice(0, 120) }, null, 2));

if (process.argv.includes('--strict') && duplicates.length > 0) {
  console.error(`CSS architecture check failed: ${duplicates.length} tokens are declared in multiple style files.`);
  process.exitCode = 1;
}
