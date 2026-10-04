#!/usr/bin/env node
/**
 * axi-ui-cli.mjs — zero-dependency Node CLI for looking up @axi/* components.
 *
 * Usage:
 *   node scripts/axi-ui-cli.mjs pick <scene>
 *   node scripts/axi-ui-cli.mjs component <Name>
 *   node scripts/axi-ui-cli.mjs [--index <path>] <command> [arg]
 *
 * The index defaults to `../foundation/axi-ui/docs/axi-ui/components-index.json`
 * relative to process.cwd(). Override with `--index <absolute-or-relative-path>`.
 *
 * Zero npm dependencies — uses only `node:fs`, `node:path`, and `node:url`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const VALID_SCENES = [
  'data',
  'forms',
  'addons',
  'auth',
  'dashboard',
  'settings',
  'theme',
  'navigation',
  'feedback',
  'media',
  'other',
];

const DEFAULT_INDEX_RELATIVE = '../../foundation/axi-ui/docs/axi-ui/components-index.json';

function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  // Walk argv, allow `--index <path>` before or after the command.
  let indexPath = null;
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--index' || a === '-i') {
      const next = argv[i + 1];
      if (!next) fail(`--index requires a path argument`);
      indexPath = next;
      i++;
      continue;
    }
    if (a.startsWith('--index=')) {
      indexPath = a.slice('--index='.length);
      continue;
    }
    rest.push(a);
  }
  return { command: rest[0], arg: rest[1], indexPath };
}

function resolveIndexPath(override) {
  if (override) {
    return path.isAbsolute(override) ? override : path.resolve(process.cwd(), override);
  }
  return path.resolve(process.cwd(), DEFAULT_INDEX_RELATIVE);
}

function loadIndex(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    fail(`cannot read index file at ${filePath}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`index file at ${filePath} is not valid JSON: ${err.message}`);
  }
}

function pad(label, width = 12) {
  if (label.length >= width) return label + ' ';
  return label + ' '.repeat(width - label.length);
}

function cmdPick(scene) {
  if (!scene) fail(`pick requires a scene argument. Valid scenes: ${VALID_SCENES.join(', ')}`);
  if (!VALID_SCENES.includes(scene)) {
    fail(
      `unknown scene "${scene}". Valid scenes: ${VALID_SCENES.join(', ')}`,
    );
  }
  const indexPath = resolveIndexPath(currentIndexOverride);
  const idx = loadIndex(indexPath);
  const matched = (idx.components || []).filter((c) => c && c.scene === scene);

  if (matched.length === 0) {
    process.stdout.write(
      `No components found for scene "${scene}" in ${indexPath}\n`,
    );
    return;
  }

  // Group by package name, preserve stable order (first appearance).
  const groups = new Map();
  for (const c of matched) {
    const pkg = c.package || '<unknown>';
    if (!groups.has(pkg)) groups.set(pkg, []);
    groups.get(pkg).push(c);
  }

  process.stdout.write(
    `Scene "${scene}" — ${matched.length} component(s) across ${groups.size} package(s)\n`,
  );
  process.stdout.write(`Source: ${indexPath}\n\n`);

  for (const [pkg, list] of groups) {
    process.stdout.write(`${pkg}  (count: ${list.length})\n`);
    for (const c of list) {
      const desc = firstDescriptionLine(c);
      process.stdout.write(`  ${pad(c.name, 28)}${desc}\n`);
    }
    process.stdout.write('\n');
  }
}

function firstDescriptionLine(c) {
  // The current index does not carry a `description` field. Fall back to the
  // first non-empty line of `props.raw` (which is a TS type literal and reads
  // like a signature, not English prose). When a richer doc arrives, prefer
  // `c.description` here.
  if (c.description) return c.description;
  const raw = c && c.props && typeof c.props.raw === 'string' ? c.props.raw : '';
  const firstLine = raw.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
  return firstLine || '<no description indexed>';
}

function derivedImportPath(c) {
  // `package` in the index is the npm package name (e.g. `@axi/crud`); that
  // is also the public import path when consumers import the surface root.
  return c.package || '';
}

function cmdComponent(name) {
  if (!name) fail(`component requires a name argument, e.g. AxiTable`);
  const indexPath = resolveIndexPath(currentIndexOverride);
  const idx = loadIndex(indexPath);
  const all = idx.components || [];
  const match = all.find((c) => c && c.name === name);

  if (!match) {
    fail(
      `${name} not found in components-index.json (which lists ${all.length} components)`,
    );
  }

  process.stdout.write(`${pad('Name')} ${match.name}\n`);
  process.stdout.write(`${pad('Package')} ${match.package || '<unknown>'}\n`);
  process.stdout.write(`${pad('Source')} ${match.file || '<unknown>'}\n`);
  process.stdout.write(`${pad('Scene')} ${match.scene || '<unknown>'}\n`);
  process.stdout.write(`${pad('Kind')} ${match.kind || '<unknown>'}\n`);
  process.stdout.write(`${pad('ImportPath')} ${derivedImportPath(match)}\n`);
  process.stdout.write(`${pad('Description')} ${firstDescriptionLine(match)}\n`);

  process.stdout.write(`\nProps (type):\n`);
  if (match.props && match.props.type) {
    process.stdout.write(`  ${match.props.type}\n`);
  } else {
    process.stdout.write(`  <no props type extracted>\n`);
  }

  if (match.props && match.props.raw) {
    process.stdout.write(`\nProps (raw):\n`);
    for (const line of match.props.raw.split('\n')) {
      process.stdout.write(`  ${line}\n`);
    }
  }

  if (Array.isArray(match.destructuredDefaultProps) && match.destructuredDefaultProps.length > 0) {
    process.stdout.write(`\nDefault props:\n`);
    for (const dp of match.destructuredDefaultProps) {
      process.stdout.write(`  ${dp.name}${dp.defaultValue != null ? ` = ${dp.defaultValue}` : ''}\n`);
    }
  }

  process.stdout.write(`\nUsage:\n`);
  if (match.usage) {
    process.stdout.write(`  ${match.usage}\n`);
  } else {
    process.stdout.write(`  <no usage doc indexed yet — see Source for full API>\n`);
  }

  process.stdout.write(`\nAlternatives: ${formatList(match.alternatives)}\n`);
  process.stdout.write(`Related: ${formatList(match.related)}\n`);
}

function formatList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '[]';
  return arr.join(', ');
}

function printUsage() {
  const lines = [
    'Usage:',
    '  node scripts/axi-ui-cli.mjs pick <scene>',
    '  node scripts/axi-ui-cli.mjs component <Name>',
    '',
    'Options:',
    '  --index <path>   Override the components-index.json path',
    '',
    `Valid scenes: ${VALID_SCENES.join(', ')}`,
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

// Single state holder for the resolved --index override; consumed by commands.
let currentIndexOverride = null;

function main() {
  const { command, arg, indexPath } = parseArgs(process.argv);
  currentIndexOverride = indexPath;

  if (!command || command === 'help' || command === '-h' || command === '--help') {
    printUsage();
    return;
  }

  switch (command) {
    case 'pick':
      cmdPick(arg);
      break;
    case 'component':
      cmdComponent(arg);
      break;
    default:
      fail(`unknown command "${command}". Run with no args for usage.`);
  }
}

main();