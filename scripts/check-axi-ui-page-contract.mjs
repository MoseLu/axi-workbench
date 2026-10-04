import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(await readFile(path.join(root, 'config/axi-ui-page-policy.json'), 'utf8'));
const appSource = await readFile(path.join(root, 'apps/workbench/src/App.tsx'), 'utf8');
const findings = [];

const routeRe = /<Route\s+path="([^"]+)"\s+element=\{<([A-Za-z][A-Za-z0-9]*)\s*\/?>(?:<\/\2>)?\}/g;
const imports = new Map();
for (const match of appSource.matchAll(/import\s+([A-Za-z][A-Za-z0-9]*)\s+from\s+['"](\.\/pages\/[^'"]+)['"]/g)) {
  imports.set(match[1], path.join(root, 'apps/workbench/src', `${match[2].replace(/^\.\//, '')}.tsx`));
}

for (const match of appSource.matchAll(routeRe)) {
  const [, rawRoute, component] = match;
  const route = rawRoute.startsWith('/') ? rawRoute : `/${rawRoute}`;
  if (policy.exemptRoutes.includes(route) || route === '/' || route === '/*' || route === '/loading') continue;
  if (policy.legacyRoutes.includes(route)) continue;
  const file = imports.get(component);
  if (!file) {
    findings.push(`${route}: route component ${component} is not imported from a page file`);
    continue;
  }
  const source = await readFile(file, 'utf8');
  if (!/export\s+const\s+pageContract\s*=/.test(source)) {
    findings.push(`${route}: new page must export pageContract`);
    continue;
  }
  if (!/pageHeader\s*:\s*['"]forbidden['"]/.test(source)) {
    findings.push(`${route}: pageContract must explicitly set pageHeader: 'forbidden' or use an approved exception`);
  }
  if (/<h1\b/.test(source) || /<Axi(?:Basic|Card)Banner[^>]*\btitle=/.test(source)) {
    findings.push(`${route}: pageHeader is forbidden but the page contains a page-level title`);
  }
}

console.log('=== Axi UI page contract check ===');
if (findings.length) {
  console.error('FAILED');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log('PASSED');
