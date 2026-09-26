import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const pageRoots = [
  path.join(root, 'apps/workbench/src/pages'),
];
// Legacy pages are quarantined, not allowed. The route table replaces them
// with AxiExceptionPage (404) until they are migrated to the Axi surface.
// 2026-09-26: the former quarantined set (Dashboard, EpsAudit, Handoff,
// HandoffCreate, MenuList, Operations, RoleList, Search, Team, Workspace,
// me/Devices, me/Notifications, me/Theme, Projects, ProjectDetail,
// CommitLedgerPage) was migrated to @axi/* components and is routed again
// from App.tsx; their remaining antd usage carries explicit
// axi-ui-escape-hatch comments and is reviewed by the antd import scan below.
const quarantinedPageFiles = new Set([
  'apps/workbench/src/pages/admin/ControlPlaneState.tsx',
  'apps/workbench/src/pages/admin/GovernanceInspector.tsx',
  'apps/workbench/src/pages/admin/GovernanceSummary.tsx',
  'apps/workbench/src/pages/admin/Placeholder.tsx',
  'apps/workbench/src/pages/admin/WorkflowEffectsPanel.tsx',
  'apps/workbench/src/pages/admin/me/AccountInfo.tsx',
]);

// Login is a separate authentication surface and is intentionally outside the
// protected CRUD page contract.
const contractExemptions = new Set(['apps/workbench/src/pages/Login.tsx']);
const findings = [];

const appSource = await readFile(path.join(root, 'apps/workbench/src/App.tsx'), 'utf8');
for (const file of quarantinedPageFiles) {
  // App.tsx imports these files WITHOUT the .tsx extension, so strip it
  // before matching. Also check the with-extension form to be defensive.
  const importPath = file.replace('apps/workbench/src/', './').replace(/\.tsx$/, '');
  const importPathWithExt = file.replace('apps/workbench/src/', './');
  if (appSource.includes(importPath) || appSource.includes(importPathWithExt)) {
    findings.push(`${file}: quarantined page is still imported by App.tsx and cannot be reachable`);
  }
}

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(absolute));
    else if (/\.tsx$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

for (const directory of pageRoots) {
  for (const absolute of await collect(directory)) {
    const relative = path.relative(root, absolute);
    const source = await readFile(absolute, 'utf8');
    const antdImports = [...source.matchAll(/from\s*['"](antd|@ant-design\/icons)['"]/g)].map((match) => match[1]);
    // A migrated page may keep a residual antd import only when it documents
    // the gap with an explicit `axi-ui-escape-hatch:` comment (see
    // docs/prd/02 §8: 缺口回流). Unmarked antd imports still fail the gate.
    if (antdImports.length && !quarantinedPageFiles.has(relative) && !contractExemptions.has(relative) && !source.includes('axi-ui-escape-hatch')) {
      findings.push(`${relative}: direct ${antdImports.join(' and ')} import bypasses the Axi UI surface`);
    }
    if (/bordered\s*=\s*\{\s*false\s*\}/.test(source) && !source.includes('axi-ui-escape-hatch')) {
      findings.push(`${relative}: bordered={false} is an unaudited Axi UI escape hatch`);
    }
  }
}

if (findings.length) {
  console.error('Axi UI adoption check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Axi UI adoption check passed (${quarantinedPageFiles.size} non-compliant pages are route-quarantined to AXI 404; new Workbench pages cannot add another UI surface).`);
