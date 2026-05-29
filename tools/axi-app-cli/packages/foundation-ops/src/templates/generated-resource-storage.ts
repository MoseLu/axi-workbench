import type { ScaffoldConfig } from '@axi/scaffold-kit';
import { serializeJson } from '@axi/scaffold-kit';

const resourceStoragePrelude = `import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import OSS from 'ali-oss';
import initSqlJs from 'sql.js';

import { loadLocalEnvFiles, readRequiredEnv } from './load-local-env.mjs';

const CONFIG_RELATIVE_PATH = 'config/resource-storage.config.json';
const CLASSIFICATION_CONFIG_RELATIVE_PATH = 'config/resource-classification.config.json';
const DEFAULT_CATALOG_PATH = '.axi/resource-index.sqlite';
const require = createRequire(import.meta.url);

let sqlJsPromise;

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile(fileName) {
        return pathToFileURL(require.resolve('sql.js/dist/' + fileName)).href;
      },
    });
  }

  return sqlJsPromise;
}

function ensureObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(\`Invalid \${label}: expected an object.\`);
  }

  return value;
}

function ensureString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(\`Invalid \${label}: expected a non-empty string.\`);
  }

  return value;
}

function ensureStringArray(value, label) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(\`Invalid \${label}: expected an array of strings.\`);
  }

  return value;
}

function ensureIntegerArray(value, label) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => !Number.isInteger(item) || item <= 0)) {
    throw new Error(\`Invalid \${label}: expected an array of positive integers.\`);
  }

  return value;
}

function ensureBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(\`Invalid \${label}: expected a boolean.\`);
  }

  return value;
}

function ensureOptionalString(value, label) {
  if (value === undefined) {
    return undefined;
  }

  return ensureString(value, label);
}

function ensureStringAllowEmpty(value, label) {
  if (typeof value !== 'string') {
    throw new Error(\`Invalid \${label}: expected a string.\`);
  }

  return value;
}

function normalizeBucketSegment(value) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'app';
}

function trimBucketSegment(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength).replace(/-+$/g, '') || 'app';
}

async function buildAutoBucketName(laneName, accessKeyId, attempt = 0) {
  const lane = normalizeBucketSegment(laneName);
  const digest = createHash('sha256')
    .update(\`\${accessKeyId}:\${lane}\`)
    .digest('hex')
    .slice(0, 10);
  const suffix = attempt === 0 ? \`\${digest}\` : \`\${digest}-\${attempt}\`;

  return \`axi-shared-\${lane}-\${suffix}\`;
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function joinObjectKey(prefix, relativePath) {
  const normalizedRelativePath = toPosixPath(relativePath).replace(/^\\/+/, '');
  const normalizedPrefix = prefix ? prefix.replace(/^\\/+|\\/+$/g, '') : '';

  return normalizedPrefix ? \`\${normalizedPrefix}/\${normalizedRelativePath}\` : normalizedRelativePath;
}

function normalizeObjectPathPrefix(value) {
  return toPosixPath(value.trim()).replace(/^\\/+|\\/+$/g, '').replace(/\\/{2,}/g, '/');
}

function ensureNormalizedObjectPath(value, label, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = normalizeObjectPathPrefix(ensureStringAllowEmpty(value, label));

  return normalized || fallback;
}

function buildProjectNamespacePrefix(catalog) {
  return joinObjectKey(catalog.remoteRootPrefix, catalog.projectNamespace);
}

function buildLaneObjectPrefix(spec) {
  const basePrefix = joinObjectKey(
    joinObjectKey(buildProjectNamespacePrefix(spec.config.catalog), spec.config.catalog.remoteObjectDir),
    joinObjectKey(spec.laneName, spec.config.catalog.objectKeyStrategy),
  );
  const laneKeyPrefix = normalizeObjectPathPrefix(spec.lane.keyPrefix);

  return laneKeyPrefix ? joinObjectKey(basePrefix, laneKeyPrefix) : basePrefix;
}

function buildLaneIndexPrefix(spec) {
  return joinObjectKey(
    joinObjectKey(buildProjectNamespacePrefix(spec.config.catalog), spec.config.catalog.remoteIndexDir),
    spec.laneName,
  );
}

function buildLaneIndexObjectKey(spec, fileName = 'catalog.latest.json') {
  return joinObjectKey(buildLaneIndexPrefix(spec), fileName);
}

function guessContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.webmanifest':
      return 'application/manifest+json; charset=utf-8';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return undefined;
  }
}

async function collectFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDir, absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function buildCategoryPath(relativePath, defaultCategory) {
  const directoryName = path.posix.dirname(relativePath);

  if (!directoryName || directoryName === '.') {
    return defaultCategory;
  }

  return directoryName;
}

function buildHashedObjectKey(prefix, sha256, extension, segmentLengths) {
  const normalizedExtension = extension ? extension.toLowerCase() : '';
  const segments = [];
  let cursor = 0;

  for (const segmentLength of segmentLengths) {
    const nextValue = sha256.slice(cursor, cursor + segmentLength);

    if (!nextValue) {
      break;
    }

    segments.push(nextValue);
    cursor += segmentLength;
  }

  segments.push(\`\${sha256}\${normalizedExtension}\`);

  return joinObjectKey(prefix, segments.join('/'));
}

async function hashFileSha256(absolutePath) {
  const buffer = await readFile(absolutePath);

  return createHash('sha256').update(buffer).digest('hex');
}

function parseCatalog(rawCatalog) {
  const catalog = ensureObject(rawCatalog ?? {}, 'resource storage config.catalog');

  return {
    databasePath:
      catalog.databasePath === undefined
        ? DEFAULT_CATALOG_PATH
        : ensureString(catalog.databasePath, 'resource storage config.catalog.databasePath'),
    defaultCategory:
      catalog.defaultCategory === undefined
        ? 'uncategorized'
        : ensureString(catalog.defaultCategory, 'resource storage config.catalog.defaultCategory'),
    hashPathSegments:
      catalog.hashPathSegments === undefined
        ? [2, 2]
        : ensureIntegerArray(
            catalog.hashPathSegments,
            'resource storage config.catalog.hashPathSegments',
          ),
    objectKeyStrategy:
      catalog.objectKeyStrategy === undefined
        ? 'sha256'
        : ensureString(catalog.objectKeyStrategy, 'resource storage config.catalog.objectKeyStrategy'),
    projectNamespace: ensureNormalizedObjectPath(
      catalog.projectNamespace,
      'resource storage config.catalog.projectNamespace',
      'default-project',
    ),
    remoteIndexDir: ensureNormalizedObjectPath(
      catalog.remoteIndexDir,
      'resource storage config.catalog.remoteIndexDir',
      'index',
    ),
    remoteObjectDir: ensureNormalizedObjectPath(
      catalog.remoteObjectDir,
      'resource storage config.catalog.remoteObjectDir',
      'objects',
    ),
    remoteRootPrefix: ensureNormalizedObjectPath(
      catalog.remoteRootPrefix,
      'resource storage config.catalog.remoteRootPrefix',
      'projects',
    ),
  };
}

function ensureTagList(value, label) {
  const tags = ensureStringArray(value, label);

  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort();
}

function normalizeMatchPrefix(value) {
  return toPosixPath(value.trim()).replace(/^\\/+|\\/+$/g, '');
}

function normalizeContainsToken(value) {
  return toPosixPath(value.trim().toLowerCase()).replace(/^\\/+|\\/+$/g, '');
}

function normalizeExtensionToken(value) {
  const normalized = value.trim().toLowerCase().replace(/^\\.+/, '');

  return normalized ? \`.\${normalized}\` : '';
}

function parseClassificationRule(rawRule, index) {
  const rule = ensureObject(rawRule, \`classification rule \${index}\`);

  return {
    category: ensureString(rule.category, \`classification rule \${index}.category\`),
    matchPrefix: ensureString(rule.matchPrefix, \`classification rule \${index}.matchPrefix\`),
    tags: ensureTagList(rule.tags, \`classification rule \${index}.tags\`),
  };
}

function parseLaneDefaults(rawValue, label) {
  const laneDefaults = ensureObject(rawValue ?? {}, label);

  return Object.fromEntries(
    Object.entries(laneDefaults).map(([laneName, laneValue]) => {
      const laneConfig = ensureObject(laneValue, \`\${label}.\${laneName}\`);

      return [
        laneName,
        {
          tags: ensureTagList(laneConfig.tags, \`\${label}.\${laneName}.tags\`),
        },
      ];
    }),
  );
}

function parseIntakeRule(rawRule, index) {
  const rule = ensureObject(rawRule, \`intake rule \${index}\`);
  const matchPrefixes = [
    ...ensureStringArray(rule.matchPrefixes, \`intake rule \${index}.matchPrefixes\`),
    ...(rule.matchPrefix === undefined
      ? []
      : [ensureString(rule.matchPrefix, \`intake rule \${index}.matchPrefix\`)]),
  ]
    .map(normalizeMatchPrefix)
    .filter(Boolean)
    .filter((value, valueIndex, list) => list.indexOf(value) === valueIndex)
    .sort();
  const matchExtensions = ensureStringArray(
    rule.matchExtensions,
    \`intake rule \${index}.matchExtensions\`,
  )
    .map(normalizeExtensionToken)
    .filter(Boolean)
    .filter((value, valueIndex, list) => list.indexOf(value) === valueIndex)
    .sort();
  const matchNameIncludes = ensureStringArray(
    rule.matchNameIncludes,
    \`intake rule \${index}.matchNameIncludes\`,
  )
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .filter((value, valueIndex, list) => list.indexOf(value) === valueIndex)
    .sort();
  const matchPathIncludes = ensureStringArray(
    rule.matchPathIncludes,
    \`intake rule \${index}.matchPathIncludes\`,
  )
    .map(normalizeContainsToken)
    .filter(Boolean)
    .filter((value, valueIndex, list) => list.indexOf(value) === valueIndex)
    .sort();
  const matchMimePrefixes = ensureStringArray(
    rule.matchMimePrefixes,
    \`intake rule \${index}.matchMimePrefixes\`,
  )
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .filter((value, valueIndex, list) => list.indexOf(value) === valueIndex)
    .sort();

  return {
    description: ensureOptionalString(rule.description, \`intake rule \${index}.description\`),
    lane: ensureString(rule.lane, \`intake rule \${index}.lane\`),
    matchExtensions,
    matchMaxSizeBytes:
      rule.matchMaxSizeBytes === undefined
        ? undefined
        : Number.isInteger(rule.matchMaxSizeBytes) && rule.matchMaxSizeBytes >= 0
          ? rule.matchMaxSizeBytes
          : (() => {
              throw new Error(
                \`Invalid intake rule \${index}.matchMaxSizeBytes: expected a non-negative integer.\`,
              );
            })(),
    matchMimePrefixes,
    matchMinSizeBytes:
      rule.matchMinSizeBytes === undefined
        ? undefined
        : Number.isInteger(rule.matchMinSizeBytes) && rule.matchMinSizeBytes >= 0
          ? rule.matchMinSizeBytes
          : (() => {
              throw new Error(
                \`Invalid intake rule \${index}.matchMinSizeBytes: expected a non-negative integer.\`,
              );
            })(),
    matchNameIncludes,
    matchPathIncludes,
    matchPrefixes,
    reviewTags: ensureTagList(rule.reviewTags, \`intake rule \${index}.reviewTags\`),
    tags: ensureTagList(rule.tags, \`intake rule \${index}.tags\`),
  };
}

function parseIntakeConfig(rawValue, label) {
  const intake = ensureObject(rawValue ?? {}, label);

  return {
    defaultLane:
      intake.defaultLane === undefined
        ? 'private'
        : ensureString(intake.defaultLane, \`\${label}.defaultLane\`),
    laneRules: Array.isArray(intake.laneRules)
      ? intake.laneRules.map((rule, index) => parseIntakeRule(rule, index))
      : [],
  };
}

function parseProvider(rawProvider, providerName) {
  const provider = ensureObject(rawProvider, \`provider "\${providerName}"\`);

  return {
    accessKeyIdEnv: ensureString(provider.accessKeyIdEnv, \`provider "\${providerName}".accessKeyIdEnv\`),
    accessKeySecretEnv: ensureString(
      provider.accessKeySecretEnv,
      \`provider "\${providerName}".accessKeySecretEnv\`,
    ),
    authMode: ensureString(provider.authMode, \`provider "\${providerName}".authMode\`),
    authorizationV4:
      provider.authorizationV4 === undefined
        ? true
        : ensureBoolean(provider.authorizationV4, \`provider "\${providerName}".authorizationV4\`),
    endpointEnv:
      provider.endpointEnv === undefined
        ? undefined
        : ensureString(provider.endpointEnv, \`provider "\${providerName}".endpointEnv\`),
    endpoint: ensureOptionalString(provider.endpoint, \`provider "\${providerName}".endpoint\`),
    region: ensureOptionalString(provider.region, \`provider "\${providerName}".region\`),
    regionEnv: ensureString(provider.regionEnv, \`provider "\${providerName}".regionEnv\`),
    sessionTokenEnv:
      provider.sessionTokenEnv === undefined
        ? undefined
        : ensureString(provider.sessionTokenEnv, \`provider "\${providerName}".sessionTokenEnv\`),
    type: ensureString(provider.type, \`provider "\${providerName}".type\`),
  };
}

function parseLane(rawLane, laneName) {
  const lane = ensureObject(rawLane, \`lane "\${laneName}"\`);

  return {
    acl: lane.acl === undefined ? undefined : ensureString(lane.acl, \`lane "\${laneName}".acl\`),
    bucket: ensureOptionalString(lane.bucket, \`lane "\${laneName}".bucket\`),
    bucketEnv:
      lane.bucketEnv === undefined
        ? undefined
        : ensureString(lane.bucketEnv, \`lane "\${laneName}".bucketEnv\`),
    cacheControl:
      lane.cacheControl === undefined
        ? undefined
        : ensureString(lane.cacheControl, \`lane "\${laneName}".cacheControl\`),
    excludeFileNames: ensureStringArray(
      lane.excludeFileNames,
      \`lane "\${laneName}".excludeFileNames\`,
    ),
    keyPrefix:
      lane.keyPrefix === undefined
        ? ''
        : ensureStringAllowEmpty(lane.keyPrefix, \`lane "\${laneName}".keyPrefix\`),
    provider: ensureString(lane.provider, \`lane "\${laneName}".provider\`),
    sourceDir: ensureString(lane.sourceDir, \`lane "\${laneName}".sourceDir\`),
  };
}
`;

const resourceStoragePlanning = `export async function readResourceStorageConfig(cwd = process.cwd()) {
  const filePath = path.join(cwd, CONFIG_RELATIVE_PATH);
  const rawConfig = JSON.parse(await readFile(filePath, 'utf8'));
  const config = ensureObject(rawConfig, 'resource storage config');
  const providers = ensureObject(config.providers, 'resource storage config.providers');
  const lanes = ensureObject(config.lanes, 'resource storage config.lanes');

  return {
    catalog: parseCatalog(config.catalog),
    lanes: Object.fromEntries(
      Object.entries(lanes).map(([laneName, laneConfig]) => [laneName, parseLane(laneConfig, laneName)]),
    ),
    providers: Object.fromEntries(
      Object.entries(providers).map(([providerName, providerConfig]) => [
        providerName,
        parseProvider(providerConfig, providerName),
      ]),
    ),
    version: config.version,
  };
}

export async function readResourceClassificationConfig(cwd = process.cwd()) {
  const filePath = path.join(cwd, CLASSIFICATION_CONFIG_RELATIVE_PATH);

  try {
    const rawConfig = JSON.parse(await readFile(filePath, 'utf8'));
    const config = ensureObject(rawConfig, 'resource classification config');

    return {
      intake: parseIntakeConfig(config.intake, 'resource classification config.intake'),
      laneDefaults: parseLaneDefaults(config.laneDefaults, 'resource classification config.laneDefaults'),
      rules: Array.isArray(config.rules)
        ? config.rules.map((rule, index) => parseClassificationRule(rule, index))
        : [],
      version: config.version,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {
        intake: {
          defaultLane: 'private',
          laneRules: [],
        },
        laneDefaults: {},
        rules: [],
        version: 0,
      };
    }

    throw error;
  }
}

async function getResourceLaneSpec(laneName, cwd = process.cwd()) {
  loadLocalEnvFiles(cwd);

  const [config, classification] = await Promise.all([
    readResourceStorageConfig(cwd),
    readResourceClassificationConfig(cwd),
  ]);
  const lane = config.lanes[laneName];

  if (!lane) {
    throw new Error(\`Unknown resource lane: \${laneName}\`);
  }

  const provider = config.providers[lane.provider];

  if (!provider) {
    throw new Error(\`Unknown resource provider: \${lane.provider}\`);
  }

  if (provider.type !== 'aliyun-oss') {
    throw new Error(\`Unsupported resource provider type: \${provider.type}\`);
  }

  return {
    classification,
    config,
    cwd,
    lane,
    laneName,
    provider,
    sourceDir: path.resolve(cwd, lane.sourceDir),
  };
}

function resolveOptionalEnvValue(value, envName) {
  if (value !== undefined && value !== null && value !== '') {
    return value;
  }

  if (envName && process.env[envName]) {
    return process.env[envName];
  }

  return undefined;
}

async function resolveBucketName(spec, overrides = {}, options = {}) {
  const explicitBucket = resolveOptionalEnvValue(
    overrides.bucket ?? spec.lane.bucket,
    spec.lane.bucketEnv,
  );

  if (explicitBucket) {
    return explicitBucket;
  }

  if (options.allowAutoGenerate === false) {
    return undefined;
  }

  const accessKeyId = process.env[spec.provider.accessKeyIdEnv];

  if (!accessKeyId) {
    if (options.required) {
      readRequiredEnv(spec.provider.accessKeyIdEnv);
    }

    return undefined;
  }

  return buildAutoBucketName(spec.laneName, accessKeyId, overrides.bucketAttempt ?? 0);
}

function resolveRegion(spec, overrides = {}, options = {}) {
  const region = resolveOptionalEnvValue(
    overrides.region ?? spec.provider.region,
    spec.provider.regionEnv,
  );

  if (!region && options.required) {
    throw new Error(
      \`Missing required region for provider "\${spec.lane.provider}". Provide it in config or via \${spec.provider.regionEnv}.\`,
    );
  }

  return region;
}

function resolveEndpoint(spec, overrides = {}) {
  return resolveOptionalEnvValue(overrides.endpoint ?? spec.provider.endpoint, spec.provider.endpointEnv);
}

async function persistResolvedResourceConfig(laneName, resolved, cwd = process.cwd()) {
  const configPath = path.join(cwd, CONFIG_RELATIVE_PATH);
  const rawConfig = JSON.parse(await readFile(configPath, 'utf8'));
  const rawProvider = rawConfig.providers?.[resolved.lane.provider];
  const rawLane = rawConfig.lanes?.[laneName];

  if (!rawProvider || !rawLane) {
    return;
  }

  let changed = false;

  if (resolved.region && rawProvider.region !== resolved.region) {
    rawProvider.region = resolved.region;
    changed = true;
  }

  if (resolved.endpoint) {
    if (rawProvider.endpoint !== resolved.endpoint) {
      rawProvider.endpoint = resolved.endpoint;
      changed = true;
    }
  } else if (rawProvider.endpoint !== undefined) {
    delete rawProvider.endpoint;
    changed = true;
  }

  if (resolved.bucket && rawLane.bucket !== resolved.bucket) {
    rawLane.bucket = resolved.bucket;
    changed = true;
  }

  if (!changed) {
    return;
  }

  await writeFile(configPath, \`\${JSON.stringify(rawConfig, null, 2)}\\n\`, 'utf8');
  console.log(\`[resources] persisted lane "\${laneName}" bucket/region config for future runs.\`);
}

async function buildCatalogDatabase(cwd, config) {
  const databasePath = path.resolve(cwd, config.catalog.databasePath ?? DEFAULT_CATALOG_PATH);

  await mkdir(path.dirname(databasePath), { recursive: true });

  const SQL = await getSqlJs();
  let db;

  try {
    const buffer = await readFile(databasePath);
    db = new SQL.Database(new Uint8Array(buffer));
  } catch {
    db = new SQL.Database();
  }

  db.exec(\`
    CREATE TABLE IF NOT EXISTS assets (
      lane TEXT NOT NULL,
      category_path TEXT NOT NULL,
      bucket TEXT,
      object_key TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      file_name TEXT NOT NULL,
      extension TEXT NOT NULL,
      mime TEXT,
      size_bytes INTEGER NOT NULL,
      source_relative_path TEXT NOT NULL,
      source_absolute_path TEXT NOT NULL,
      etag TEXT,
      tags_json TEXT NOT NULL,
      classification_reason TEXT,
      needs_review INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL,
      source_present INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (lane, source_relative_path)
    );

    CREATE TABLE IF NOT EXISTS asset_tags (
      lane TEXT NOT NULL,
      source_relative_path TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (lane, source_relative_path, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_assets_lane_category ON assets (lane, category_path);
    CREATE INDEX IF NOT EXISTS idx_assets_sha256 ON assets (sha256);
    CREATE INDEX IF NOT EXISTS idx_assets_file_name ON assets (file_name);
    CREATE INDEX IF NOT EXISTS idx_assets_object_key ON assets (object_key);
    CREATE INDEX IF NOT EXISTS idx_assets_needs_review ON assets (needs_review);
    CREATE INDEX IF NOT EXISTS idx_asset_tags_tag ON asset_tags (tag);
  \`);

  for (const statement of [
    "ALTER TABLE assets ADD COLUMN classification_reason TEXT",
    "ALTER TABLE assets ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0",
  ]) {
    try {
      db.exec(statement);
    } catch {}
  }

  return {
    databasePath,
    db,
  };
}

async function persistCatalogDatabase(catalog) {
  const bytes = catalog.db.export();

  await writeFile(catalog.databasePath, Buffer.from(bytes));
  catalog.db.close();
}

function buildClassification(spec, relativePath, extension, mime, overrides = {}) {
  const normalizedPath = toPosixPath(relativePath);
  const matchedRule = spec.classification.rules.find((rule) => {
    const prefix = normalizeMatchPrefix(rule.matchPrefix);

    return normalizedPath === prefix || normalizedPath.startsWith(\`\${prefix}/\`);
  });
  const laneTags = spec.classification.laneDefaults[spec.laneName]?.tags ?? [];
  const fileTypeTag = extension ? \`ext:\${extension.replace(/^\./, '')}\` : null;
  const mimeTag = mime ? \`mime:\${mime.split(';')[0]}\` : null;
  const categoryPath =
    overrides.category ??
    matchedRule?.category ??
    buildCategoryPath(normalizedPath, spec.config.catalog.defaultCategory);
  const tags = [
    ...laneTags,
    ...(matchedRule?.tags ?? []),
    ...(overrides.tags ?? []),
    \`category:\${categoryPath}\`,
    fileTypeTag,
    mimeTag,
  ]
    .filter(Boolean)
    .map((tag) => String(tag))
    .filter((tag, index, list) => list.indexOf(tag) === index)
    .sort();

  return {
    categoryPath,
    tags,
  };
}

function buildClassificationPath(options, fileName) {
  return toPosixPath(options.classificationPath ?? options.relativePath ?? fileName).replace(
    /^\\/+/,
    '',
  );
}

function chooseIntakeLane(classificationConfig, options) {
  if (options.lane) {
    return {
      extraTags: [],
      lane: options.lane,
      matchedRule: null,
      needsReview: false,
      reason: 'explicit lane override',
    };
  }

  const candidatePath = normalizeContainsToken(options.classificationPath);
  const fileNameLower = options.fileName.toLowerCase();
  const extension = options.extension.toLowerCase();
  const mime = options.mime ? options.mime.toLowerCase() : null;
  const sizeBytes = options.sizeBytes ?? null;

  for (const rule of classificationConfig.intake.laneRules) {
    const prefixMatch =
      rule.matchPrefixes.length === 0 ||
      rule.matchPrefixes.some((prefix) => {
        const normalizedPrefix = normalizeMatchPrefix(prefix);

        return (
          candidatePath === normalizedPrefix ||
          candidatePath.startsWith(\`\${normalizedPrefix}/\`)
        );
      });
    const extensionMatch =
      rule.matchExtensions.length === 0 || rule.matchExtensions.includes(extension);
    const nameMatch =
      rule.matchNameIncludes.length === 0 ||
      rule.matchNameIncludes.some((token) => fileNameLower.includes(token));
    const pathMatch =
      rule.matchPathIncludes.length === 0 ||
      rule.matchPathIncludes.some((token) => candidatePath.includes(token));
    const mimeMatch =
      rule.matchMimePrefixes.length === 0 ||
      (mime !== null && rule.matchMimePrefixes.some((token) => mime.startsWith(token)));
    const minSizeMatch =
      rule.matchMinSizeBytes === undefined ||
      (sizeBytes !== null && sizeBytes >= rule.matchMinSizeBytes);
    const maxSizeMatch =
      rule.matchMaxSizeBytes === undefined ||
      (sizeBytes !== null && sizeBytes <= rule.matchMaxSizeBytes);

    if (prefixMatch && extensionMatch && nameMatch && pathMatch && mimeMatch && minSizeMatch && maxSizeMatch) {
      return {
        extraTags: [...rule.tags, ...rule.reviewTags],
        lane: rule.lane,
        matchedRule: rule,
        needsReview: rule.reviewTags.length > 0,
        reason: rule.description ?? \`matched intake rule for lane "\${rule.lane}"\`,
      };
    }
  }

  return {
    extraTags: ['review:needs-human-decision'],
    lane: classificationConfig.intake.defaultLane,
    matchedRule: null,
    needsReview: true,
    reason: \`no intake rule matched; defaulted to "\${classificationConfig.intake.defaultLane}"\`,
  };
}

async function buildUploadPlan(spec) {
  const sourceStats = await stat(spec.sourceDir).catch(() => undefined);

  if (!sourceStats || !sourceStats.isDirectory()) {
    throw new Error(\`Resource source directory not found: \${spec.lane.sourceDir}\`);
  }

  const absolutePaths = await collectFiles(spec.sourceDir);
  const includedPaths = absolutePaths.filter(
    (absolutePath) => !spec.lane.excludeFileNames.includes(path.basename(absolutePath)),
  );
  const uploads = await Promise.all(
    includedPaths.map(async (absolutePath) => {
      const fileStats = await stat(absolutePath);
      const relativePath = toPosixPath(path.relative(spec.sourceDir, absolutePath));
      const fileName = path.basename(relativePath);
      const extension = path.extname(fileName).toLowerCase();
      const sha256 = await hashFileSha256(absolutePath);
      const mime = guessContentType(absolutePath) ?? null;
      const classification = buildClassification(spec, relativePath, extension, mime);

      return {
        absolutePath,
        bucket: spec.bucket ?? null,
        categoryPath: classification.categoryPath,
        classificationReason: 'indexed from managed lane source',
        contentType: mime ?? undefined,
        extension,
        fileName,
        key: buildHashedObjectKey(
          buildLaneObjectPrefix(spec),
          sha256,
          extension,
          spec.config.catalog.hashPathSegments,
        ),
        mime,
        needsReview: false,
        relativePath,
        sha256,
        sizeBytes: fileStats.size,
        tags: classification.tags,
      };
    }),
  );

  return uploads.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function buildSingleEntry(spec, absolutePath, options = {}) {
  const fileStats = await stat(absolutePath).catch(() => undefined);

  if (!fileStats || !fileStats.isFile()) {
    throw new Error(\`Resource source file not found: \${absolutePath}\`);
  }

  const fileName = options.fileName ?? path.basename(absolutePath);
  const extension = path.extname(fileName).toLowerCase();
  const sha256 = await hashFileSha256(absolutePath);
  const mime = guessContentType(fileName) ?? guessContentType(absolutePath) ?? null;
  const relativePath =
    options.relativePath ??
    toPosixPath(path.posix.join('imports', sha256.slice(0, 2), sha256.slice(2, 4), fileName));
  const classification = buildClassification(
    spec,
    options.classificationPath ?? relativePath,
    extension,
    mime,
    {
      category: options.category,
      tags: options.tags,
    },
  );

  return {
    absolutePath,
    bucket: spec.bucket ?? null,
    categoryPath: classification.categoryPath,
    classificationReason: options.classificationReason ?? null,
    contentType: mime ?? undefined,
    extension,
    fileName,
    key: buildHashedObjectKey(
      buildLaneObjectPrefix(spec),
      sha256,
      extension,
      spec.config.catalog.hashPathSegments,
    ),
    mime,
    needsReview: options.needsReview === true,
    relativePath,
    sha256,
    sizeBytes: fileStats.size,
    tags: classification.tags,
  };
}

function writeCatalogEntries(db, laneName, bucket, uploads, syncStatus, options = {}) {
  const now = new Date().toISOString();
  const upsertSql = \`
    INSERT INTO assets (
      lane,
      category_path,
      bucket,
      object_key,
      sha256,
      file_name,
      extension,
      mime,
      size_bytes,
      source_relative_path,
      source_absolute_path,
      etag,
      tags_json,
      classification_reason,
      needs_review,
      sync_status,
      source_present,
      created_at,
      updated_at
    ) VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      1,
      ?,
      ?
    )
    ON CONFLICT(lane, source_relative_path) DO UPDATE SET
      category_path = excluded.category_path,
      bucket = excluded.bucket,
      object_key = excluded.object_key,
      sha256 = excluded.sha256,
      file_name = excluded.file_name,
      extension = excluded.extension,
      mime = excluded.mime,
      size_bytes = excluded.size_bytes,
      source_absolute_path = excluded.source_absolute_path,
      etag = excluded.etag,
      tags_json = excluded.tags_json,
      classification_reason = excluded.classification_reason,
      needs_review = excluded.needs_review,
      sync_status = excluded.sync_status,
      source_present = 1,
      updated_at = excluded.updated_at
  \`;

  db.run('BEGIN');

  try {
    if (options.resetLane !== false) {
      db.run(
        'UPDATE assets SET source_present = 0, sync_status = ?, updated_at = ? WHERE lane = ?',
        [syncStatus, now, laneName],
      );
      db.run('DELETE FROM asset_tags WHERE lane = ?', [laneName]);
    }

    for (const entry of uploads) {
      if (options.resetLane === false) {
        db.run('DELETE FROM asset_tags WHERE lane = ? AND source_relative_path = ?', [
          laneName,
          entry.relativePath,
        ]);
      }

      db.run(upsertSql, [
        laneName,
        entry.categoryPath,
        bucket ?? null,
        entry.key,
        entry.sha256,
        entry.fileName,
        entry.extension,
        entry.mime,
        entry.sizeBytes,
        entry.relativePath,
        entry.absolutePath,
        entry.etag ?? null,
        JSON.stringify(entry.tags),
        entry.classificationReason ?? null,
        entry.needsReview ? 1 : 0,
        syncStatus,
        now,
        now,
      ]);

      for (const tag of entry.tags) {
        db.run(
          'INSERT OR IGNORE INTO asset_tags (lane, source_relative_path, tag) VALUES (?, ?, ?)',
          [laneName, entry.relativePath, tag],
        );
      }
    }

    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  return {
    syncStatus,
    updatedCount: uploads.length,
  };
}

function markCatalogEntryDeleted(db, laneName, sourceRelativePath) {
  const now = new Date().toISOString();

  db.run('BEGIN');

  try {
    db.run(
      'UPDATE assets SET sync_status = ?, source_present = 0, tags_json = ?, classification_reason = ?, needs_review = 0, updated_at = ? WHERE lane = ? AND source_relative_path = ?',
      ['deleted', '[]', 'deleted via resources:delete', now, laneName, sourceRelativePath],
    );
    db.run('DELETE FROM asset_tags WHERE lane = ? AND source_relative_path = ?', [
      laneName,
      sourceRelativePath,
    ]);
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

function garbageCollectCatalog(db, options = {}) {
  const whereClauses = [];
  const values = [];

  if (options.lane) {
    whereClauses.push('lane = ?');
    values.push(options.lane);
  }

  if (options.allMissing) {
    whereClauses.push('source_present = 0');
  } else {
    whereClauses.push("sync_status = 'deleted'");
  }

  const whereClause = whereClauses.length > 0 ? \`WHERE \${whereClauses.join(' AND ')}\` : '';
  const countStatement = db.prepare(\`SELECT COUNT(*) AS count FROM assets \${whereClause}\`);
  const countValues = [...values];

  countStatement.bind(countValues);
  let removedCount = 0;

  if (countStatement.step()) {
    removedCount = Number(countStatement.getAsObject().count ?? 0);
  }

  countStatement.free();

  db.run('BEGIN');

  try {
    db.run(
      \`DELETE FROM asset_tags WHERE EXISTS (
        SELECT 1 FROM assets
        \${whereClause}
          AND assets.lane = asset_tags.lane
          AND assets.source_relative_path = asset_tags.source_relative_path
      )\`,
      values,
    );
    db.run(\`DELETE FROM assets \${whereClause}\`, values);
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  return {
    removedCount,
  };
}
`;

const resourceStorageCatalog = `export async function resolveResourceLane(laneName, cwd = process.cwd(), overrides = {}) {
  const spec = await getResourceLaneSpec(laneName, cwd);
  const accessKeyId = readRequiredEnv(spec.provider.accessKeyIdEnv);
  const accessKeySecret = readRequiredEnv(spec.provider.accessKeySecretEnv);
  const region = resolveRegion(spec, overrides, { required: true });
  const endpoint = resolveEndpoint(spec, overrides);
  const bucket = await resolveBucketName(spec, overrides, { required: true });
  const stsToken = spec.provider.sessionTokenEnv ? process.env[spec.provider.sessionTokenEnv] : undefined;

  if (spec.provider.authMode === 'sts' && !stsToken) {
    throw new Error(
      \`Provider "\${spec.lane.provider}" requires a session token via \${spec.provider.sessionTokenEnv}.\`,
    );
  }

  return {
    ...spec,
    bucket,
    client: new OSS({
      accessKeyId,
      accessKeySecret,
      authorizationV4: spec.provider.authorizationV4,
      bucket,
      region,
      secure: true,
      timeout: 60_000,
      ...(endpoint ? { endpoint } : {}),
      ...(stsToken ? { stsToken } : {}),
    }),
    endpoint,
    region,
  };
}

export async function planResourceLane(laneName, cwd = process.cwd()) {
  const spec = await getResourceLaneSpec(laneName, cwd);
  const uploads = await buildUploadPlan(spec);

  return {
    ...spec,
    bucket: await resolveBucketName(spec, {}, { allowAutoGenerate: false }),
    endpoint: resolveEndpoint(spec),
    region: resolveRegion(spec),
    uploads,
  };
}

export async function indexResourceLane(laneName, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const plan = await planResourceLane(laneName, cwd);
  const catalog = await buildCatalogDatabase(cwd, plan.config);

  try {
    writeCatalogEntries(catalog.db, laneName, options.bucket ?? plan.bucket, plan.uploads, 'indexed');
  } finally {
    await persistCatalogDatabase(catalog);
  }

  console.log(
    \`[resources] indexed lane "\${laneName}" with \${plan.uploads.length} file(s) into \${path.relative(
      cwd,
      catalog.databasePath,
    )}.\`,
  );

  return {
    bucket: options.bucket ?? plan.bucket ?? null,
    databasePath: catalog.databasePath,
    indexedCount: plan.uploads.length,
    lane: laneName,
  };
}
`;

const resourceStorageRuntime = `export async function syncResourceLane(laneName, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun ?? false;
  let createdBucket = false;
  let remoteIndexObjectKey = null;

  if (!dryRun) {
    await createResourceBucketLane(laneName, {
      bucket: options.bucket,
      cwd,
      endpoint: options.endpoint,
      persist: options.persist,
      region: options.region,
    });
    createdBucket = true;
  }

  const resolved = await resolveResourceLane(laneName, cwd, {
    bucket: options.bucket,
    endpoint: options.endpoint,
    region: options.region,
  });
  const uploads = await buildUploadPlan(resolved);

  if (uploads.length === 0) {
    console.log(\`[resources] lane "\${laneName}" has no uploadable files.\`);

    const catalog = await buildCatalogDatabase(cwd, resolved.config);

    try {
      writeCatalogEntries(catalog.db, laneName, resolved.bucket, uploads, dryRun ? 'indexed' : 'synced');
    } finally {
      await persistCatalogDatabase(catalog);
    }

    if (!dryRun) {
      const publishedIndex = await publishRemoteCatalogIndex(resolved);
      remoteIndexObjectKey = publishedIndex.objectKey;
    }

    return {
      bucket: resolved.bucket,
      createdBucket,
      databasePath: catalog.databasePath,
      dryRun,
      lane: laneName,
      remoteIndexObjectKey,
      uploadedCount: 0,
    };
  }

  for (const entry of uploads) {
    if (dryRun) {
      console.log(
        \`[resources] plan [\${entry.categoryPath}] \${entry.relativePath} -> oss://\${resolved.bucket}/\${entry.key}\`,
      );
      continue;
    }

    const headers = {};

    if (resolved.lane.cacheControl) {
      headers['Cache-Control'] = resolved.lane.cacheControl;
    }

    if (entry.contentType) {
      headers['Content-Type'] = entry.contentType;
    }

    const putOptions = Object.keys(headers).length > 0 ? { headers } : {};
    const result = await resolved.client.put(entry.key, entry.absolutePath, putOptions);

    entry.etag = result?.etag ?? null;

    console.log(
      \`[resources] uploaded [\${entry.categoryPath}] \${entry.relativePath} -> oss://\${resolved.bucket}/\${entry.key}\`,
    );
  }

  const catalog = await buildCatalogDatabase(cwd, resolved.config);

  try {
    writeCatalogEntries(catalog.db, laneName, resolved.bucket, uploads, dryRun ? 'indexed' : 'synced');
  } finally {
    await persistCatalogDatabase(catalog);
  }

  if (!dryRun) {
    const publishedIndex = await publishRemoteCatalogIndex(resolved);
    remoteIndexObjectKey = publishedIndex.objectKey;
  }

  return {
    bucket: resolved.bucket,
    createdBucket,
    databasePath: catalog.databasePath,
    dryRun,
    lane: laneName,
    remoteIndexObjectKey,
    uploadedCount: uploads.length,
  };
}

export async function createResourceBucketLane(laneName, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const maxAttempts = options.bucket ? 1 : 5;
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const resolved = await resolveResourceLane(laneName, cwd, {
      bucket: options.bucket,
      bucketAttempt: attempt,
      endpoint: options.endpoint,
      region: options.region,
    });
    const acl = resolved.lane.acl ?? 'private';

    try {
      await resolved.client.putBucket(resolved.bucket, { acl });
    } catch (error) {
      const errorCode = error && typeof error === 'object' ? error.code : undefined;

      if (errorCode === 'BucketAlreadyOwnedByYou') {
        if (options.persist !== false) {
          await persistResolvedResourceConfig(laneName, resolved, cwd);
        }

        console.log(
          \`[resources] ensured bucket "\${resolved.bucket}" for lane "\${laneName}" with ACL "\${acl}".\`,
        );

        return {
          acl,
          bucket: resolved.bucket,
          lane: laneName,
          remoteIndexPrefix: buildLaneIndexPrefix(resolved),
        };
      }

      if (!options.bucket && errorCode === 'BucketAlreadyExists') {
        lastError = error;
        continue;
      }

      throw error;
    }

    if (options.persist !== false) {
      await persistResolvedResourceConfig(laneName, resolved, cwd);
    }

    console.log(
      \`[resources] ensured bucket "\${resolved.bucket}" for lane "\${laneName}" with ACL "\${acl}".\`,
    );

    return {
      acl,
      bucket: resolved.bucket,
      lane: laneName,
      remoteIndexPrefix: buildLaneIndexPrefix(resolved),
    };
  }

  throw (
    lastError ??
    new Error(\`Unable to allocate a bucket name for lane "\${laneName}" after multiple attempts.\`)
  );
}

export async function classifyResourceFile(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const absoluteFilePath = path.resolve(cwd, options.filePath ?? '');

  if (!options.filePath) {
    throw new Error('Missing file path. Provide options.filePath for classifyResourceFile().');
  }

  const fileName = options.fileName ?? path.basename(absoluteFilePath);
  const extension = path.extname(fileName).toLowerCase();
  const fileStats = await stat(absoluteFilePath).catch(() => undefined);

  if (!fileStats || !fileStats.isFile()) {
    throw new Error(\`Resource source file not found: \${absoluteFilePath}\`);
  }

  const mime = guessContentType(fileName) ?? guessContentType(absoluteFilePath) ?? null;
  const classificationConfig = await readResourceClassificationConfig(cwd);
  const classificationPath = buildClassificationPath(
    {
      classificationPath: options.classificationPath,
      relativePath: options.relativePath,
    },
    fileName,
  );
  const laneDecision = chooseIntakeLane(classificationConfig, {
    classificationPath,
    extension,
    fileName,
    mime,
    lane: options.lane,
    sizeBytes: fileStats.size,
  });
  const spec = await getResourceLaneSpec(laneDecision.lane, cwd);
  const entry = await buildSingleEntry({ ...spec, bucket: null }, absoluteFilePath, {
    category: options.category,
    classificationPath,
    classificationReason: laneDecision.reason,
    fileName,
    relativePath: options.relativePath,
    needsReview: laneDecision.needsReview,
    tags: [...laneDecision.extraTags, ...(options.tags ?? [])],
  });

  return {
    classificationPath,
    entry,
    lane: laneDecision.lane,
    laneReason: laneDecision.reason,
    matchedLaneRule: laneDecision.matchedRule
      ? {
          description: laneDecision.matchedRule.description ?? null,
          lane: laneDecision.matchedRule.lane,
          matchExtensions: laneDecision.matchedRule.matchExtensions,
          matchMaxSizeBytes: laneDecision.matchedRule.matchMaxSizeBytes ?? null,
          matchMimePrefixes: laneDecision.matchedRule.matchMimePrefixes,
          matchMinSizeBytes: laneDecision.matchedRule.matchMinSizeBytes ?? null,
          matchNameIncludes: laneDecision.matchedRule.matchNameIncludes,
          matchPathIncludes: laneDecision.matchedRule.matchPathIncludes,
          matchPrefixes: laneDecision.matchedRule.matchPrefixes,
          reviewTags: laneDecision.matchedRule.reviewTags,
          tags: laneDecision.matchedRule.tags,
        }
      : null,
    needsReview: laneDecision.needsReview,
  };
}

export async function intakeResourceFile(options = {}) {
  const preview = await classifyResourceFile(options);
  const summary = await putResourceFile(preview.lane, {
    bucket: options.bucket,
    category: preview.entry.categoryPath,
    classificationPath: preview.classificationPath,
    classificationReason: preview.laneReason,
    cwd: options.cwd,
    dryRun: options.dryRun,
    endpoint: options.endpoint,
    fileName: preview.entry.fileName,
    filePath: options.filePath,
    needsReview: preview.needsReview,
    persist: options.persist,
    region: options.region,
    relativePath: preview.entry.relativePath,
    tags: preview.entry.tags,
  });

  return {
    ...summary,
    classificationPath: preview.classificationPath,
    laneReason: preview.laneReason,
    matchedLaneRule: preview.matchedLaneRule,
    needsReview: preview.needsReview,
  };
}

export async function intakeResourceBatch(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const items = Array.isArray(options.items) ? options.items : [];

  if (items.length === 0) {
    throw new Error('Missing batch items. Provide options.items for intakeResourceBatch().');
  }

  const results = [];
  const errors = [];

  for (const item of items) {
    try {
      const summary = await intakeResourceFile({
        bucket: options.bucket,
        category: item.category ?? options.category,
        classificationPath: item.classificationPath,
        cwd,
        dryRun: options.dryRun,
        endpoint: options.endpoint,
        fileName: item.fileName,
        filePath: item.filePath,
        lane: item.lane ?? options.lane,
        persist: options.persist,
        region: options.region,
        relativePath: item.relativePath,
        tags: [...(options.tags ?? []), ...(item.tags ?? [])],
      });

      results.push(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        filePath: item.filePath,
        message,
      });

      if (options.continueOnError !== true) {
        throw new Error(\`Batch intake failed for \${item.filePath}: \${message}\`);
      }
    }
  }

  return {
    dryRun: options.dryRun === true,
    errorCount: errors.length,
    errors,
    results,
    storedCount: results.length,
  };
}

export async function putResourceFile(laneName, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const absoluteFilePath = path.resolve(cwd, options.filePath ?? '');

  if (!options.filePath) {
    throw new Error('Missing file path. Provide options.filePath for putResourceFile().');
  }

  if (options.dryRun === true) {
    const spec = await getResourceLaneSpec(laneName, cwd);
    const bucket = await resolveBucketName(spec, { bucket: options.bucket }, { allowAutoGenerate: false });
    const entry = await buildSingleEntry({ ...spec, bucket: bucket ?? null }, absoluteFilePath, {
      category: options.category,
      classificationPath: options.classificationPath,
      classificationReason:
        options.classificationReason ?? 'planned direct resource import via resources:put',
      fileName: options.fileName,
      needsReview: options.needsReview,
      relativePath: options.relativePath,
      tags: options.tags,
    });

    console.log(
      \`[resources] plan import \${absoluteFilePath} -> oss://\${bucket ?? '<unresolved-bucket>'}/\${entry.key} [\${entry.categoryPath}]\`,
    );

    return {
      bucket: bucket ?? null,
      dryRun: true,
      entry,
      lane: laneName,
    };
  }

  await createResourceBucketLane(laneName, {
    bucket: options.bucket,
    cwd,
    endpoint: options.endpoint,
    persist: options.persist,
    region: options.region,
  });

  const resolved = await resolveResourceLane(laneName, cwd, {
    bucket: options.bucket,
    endpoint: options.endpoint,
    region: options.region,
  });
  const entry = await buildSingleEntry(resolved, absoluteFilePath, {
    category: options.category,
    classificationPath: options.classificationPath,
    classificationReason:
      options.classificationReason ?? 'direct resource import via resources:put',
    fileName: options.fileName,
    needsReview: options.needsReview,
    relativePath: options.relativePath,
    tags: options.tags,
  });

  const headers = {};

  if (resolved.lane.cacheControl) {
    headers['Cache-Control'] = resolved.lane.cacheControl;
  }

  if (entry.contentType) {
    headers['Content-Type'] = entry.contentType;
  }

  const putOptions = Object.keys(headers).length > 0 ? { headers } : {};
  const result = await resolved.client.put(entry.key, absoluteFilePath, putOptions);

  entry.etag = result?.etag ?? null;

  const catalog = await buildCatalogDatabase(cwd, resolved.config);

  try {
    writeCatalogEntries(catalog.db, laneName, resolved.bucket, [entry], 'synced', {
      resetLane: false,
    });
  } finally {
    await persistCatalogDatabase(catalog);
  }

  const publishedIndex = await publishRemoteCatalogIndex(resolved);

  console.log(
    \`[resources] imported \${absoluteFilePath} -> oss://\${resolved.bucket}/\${entry.key} [\${entry.categoryPath}]\`,
  );

  return {
    bucket: resolved.bucket,
    dryRun: false,
    entry,
    lane: laneName,
    remoteIndexObjectKey: publishedIndex.objectKey,
  };
}

export async function queryResourceCatalog(filters = {}, cwd = process.cwd()) {
  const config = await readResourceStorageConfig(cwd);
  const catalog = await buildCatalogDatabase(cwd, config);
  const clauses = [];
  const values = [];
  const requestedTags = [
    ...(Array.isArray(filters.tags) ? filters.tags : []),
    ...(filters.tag ? [filters.tag] : []),
  ]
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index);
  const tagMode = filters.tagMode === 'any' ? 'any' : 'all';
  const resultLimit =
    filters.all === true
      ? undefined
      : Number.isInteger(filters.limit) && filters.limit > 0
        ? filters.limit
        : 50;
  const sqlLimit = requestedTags.length > 0 ? undefined : resultLimit;

  if (filters.lane) {
    clauses.push('a.lane = ?');
    values.push(filters.lane);
  }

  if (filters.category) {
    clauses.push('a.category_path = ?');
    values.push(filters.category);
  }

  if (filters.name) {
    clauses.push('a.file_name = ?');
    values.push(filters.name);
  }

  if (filters.sha256) {
    clauses.push('a.sha256 = ?');
    values.push(filters.sha256);
  }

  if (filters.objectKey) {
    clauses.push('a.object_key = ?');
    values.push(filters.objectKey);
  }

  if (filters.needsReview === true) {
    clauses.push('a.needs_review = 1');
  } else if (filters.needsReview === false) {
    clauses.push('a.needs_review = 0');
  }

  const whereClause = clauses.length > 0 ? \`WHERE \${clauses.join(' AND ')}\` : '';
  const limitClause = sqlLimit ? 'LIMIT ?' : '';
  const statement = catalog.db.prepare(\`
    SELECT
      a.lane AS lane,
      a.category_path AS categoryPath,
      a.bucket AS bucket,
      a.object_key AS objectKey,
      a.sha256 AS sha256,
      a.file_name AS fileName,
      a.extension AS extension,
      a.mime AS mime,
      a.size_bytes AS sizeBytes,
      a.source_relative_path AS sourceRelativePath,
      a.source_absolute_path AS sourceAbsolutePath,
      a.etag AS etag,
      a.tags_json AS tagsJson,
      a.classification_reason AS classificationReason,
      a.needs_review AS needsReview,
      a.sync_status AS syncStatus,
      a.source_present AS sourcePresent,
      a.created_at AS createdAt,
      a.updated_at AS updatedAt
    FROM assets AS a
    \${whereClause}
    ORDER BY a.updated_at DESC, a.lane ASC, a.category_path ASC, a.file_name ASC
    \${limitClause}
  \`);

  try {
    if (sqlLimit) {
      values.push(sqlLimit);
    }

    statement.bind(values);
    const rows = [];

    while (statement.step()) {
      rows.push(statement.getAsObject());
    }

    const mappedRows = rows.map((row) => {
      const { tagsJson, ...rest } = row;

      return {
        ...rest,
        needsReview: Boolean(row.needsReview),
        sourcePresent: Boolean(row.sourcePresent),
        tags: JSON.parse(String(tagsJson ?? '[]')),
      };
    });
    const filteredRows =
      requestedTags.length > 0
        ? mappedRows.filter((row) =>
            tagMode === 'any'
              ? requestedTags.some((tag) => row.tags.includes(tag))
              : requestedTags.every((tag) => row.tags.includes(tag)),
          )
        : mappedRows;
    const finalRows =
      resultLimit && !filters.all ? filteredRows.slice(0, resultLimit) : filteredRows;

    return {
      databasePath: catalog.databasePath,
      filters: {
        category: filters.category ?? null,
        lane: filters.lane ?? null,
        limit: resultLimit ?? null,
        name: filters.name ?? null,
        needsReview:
          typeof filters.needsReview === 'boolean' ? filters.needsReview : null,
        objectKey: filters.objectKey ?? null,
        sha256: filters.sha256 ?? null,
        tag: filters.tag ?? null,
        tagMode,
        tags: requestedTags,
      },
      rows: finalRows,
    };
  } finally {
    statement.free();
    catalog.db.close();
  }
}

async function publishRemoteCatalogIndex(resolved) {
  const report = await queryResourceCatalog(
    {
      all: true,
      lane: resolved.laneName,
    },
    resolved.cwd,
  );
  const objectKey = buildLaneIndexObjectKey(resolved);
  const rows = report.rows
    .filter((row) => row.syncStatus !== 'deleted')
    .map((row) => ({
      bucket: row.bucket,
      categoryPath: row.categoryPath,
      classificationReason: row.classificationReason,
      extension: row.extension,
      fileName: row.fileName,
      mime: row.mime,
      needsReview: row.needsReview,
      objectKey: row.objectKey,
      sha256: row.sha256,
      sizeBytes: row.sizeBytes,
      sourceRelativePath: row.sourceRelativePath,
      syncStatus: row.syncStatus,
      tags: row.tags,
      updatedAt: row.updatedAt,
    }));
  const payload = {
    generatedAt: new Date().toISOString(),
    lane: resolved.laneName,
    projectNamespace: resolved.config.catalog.projectNamespace,
    bucket: resolved.bucket,
    indexObjectKey: objectKey,
    objectPrefix: buildLaneObjectPrefix(resolved),
    rowCount: rows.length,
    rows,
    version: 1,
  };

  await resolved.client.put(objectKey, Buffer.from(\`\${JSON.stringify(payload, null, 2)}\\n\`, 'utf8'), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });

  return {
    objectKey,
    rowCount: rows.length,
  };
}

export async function reviewResourceCatalog(filters = {}, cwd = process.cwd()) {
  const hasNeedsReviewFilter = Object.prototype.hasOwnProperty.call(filters, 'needsReview');
  const report = await queryResourceCatalog(
    {
      all: true,
      lane: filters.lane,
      needsReview: hasNeedsReviewFilter ? filters.needsReview : true,
      tag: filters.tag,
      tags: filters.tags,
      tagMode: filters.tagMode,
    },
    cwd,
  );
  const countsByLane = {};
  const countsByCategory = {};
  const countsByReviewState = {
    clean: 0,
    needsReview: 0,
  };

  for (const row of report.rows) {
    countsByLane[row.lane] = (countsByLane[row.lane] ?? 0) + 1;
    countsByCategory[row.categoryPath] = (countsByCategory[row.categoryPath] ?? 0) + 1;
    countsByReviewState[row.needsReview ? 'needsReview' : 'clean'] += 1;
  }

  return {
    ...report,
    summary: {
      countsByCategory,
      countsByLane,
      countsByReviewState,
      reviewCount: report.rows.length,
    },
  };
}

export async function deleteResourceObject(laneName, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const query = await queryResourceCatalog(
    {
      all: false,
      lane: laneName,
      limit: 1,
      objectKey: options.objectKey,
      sha256: options.sha256,
    },
    cwd,
  );
  const entry = query.rows[0];

  if (!entry) {
    throw new Error('No indexed resource matched the requested sha256/object key.');
  }

  const resolved = await resolveResourceLane(laneName, cwd, {
    bucket: options.bucket,
    endpoint: options.endpoint,
    region: options.region,
  });

  if (options.dryRun === true) {
    console.log(\`[resources] plan delete oss://\${resolved.bucket}/\${entry.objectKey}\`);

    return {
      bucket: resolved.bucket,
      deletedCount: 0,
      dryRun: true,
      lane: laneName,
      objectKey: entry.objectKey,
      sha256: entry.sha256,
    };
  }

  await resolved.client.delete(entry.objectKey);

  const catalog = await buildCatalogDatabase(cwd, resolved.config);

  try {
    markCatalogEntryDeleted(catalog.db, laneName, entry.sourceRelativePath);
  } finally {
    await persistCatalogDatabase(catalog);
  }

  const publishedIndex = await publishRemoteCatalogIndex(resolved);

  console.log(\`[resources] deleted oss://\${resolved.bucket}/\${entry.objectKey}\`);

  return {
    bucket: resolved.bucket,
    deletedCount: 1,
    dryRun: false,
    lane: laneName,
    objectKey: entry.objectKey,
    remoteIndexObjectKey: publishedIndex.objectKey,
    sha256: entry.sha256,
  };
}

export async function garbageCollectResourceCatalog(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const config = await readResourceStorageConfig(cwd);
  const catalog = await buildCatalogDatabase(cwd, config);
  let summary;

  try {
    summary = garbageCollectCatalog(catalog.db, {
      allMissing: options.allMissing === true,
      lane: options.lane,
    });
  } finally {
    await persistCatalogDatabase(catalog);
  }

  console.log(
    \`[resources] garbage collected \${summary.removedCount} catalog row(s) from \${path.relative(cwd, catalog.databasePath)}.\`,
  );

  return {
    databasePath: catalog.databasePath,
    lane: options.lane ?? null,
    removedCount: summary.removedCount,
  };
}

export async function readResourceObject(laneName, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const resolved = await resolveResourceLane(laneName, cwd, {
    bucket: options.bucket,
    endpoint: options.endpoint,
    region: options.region,
  });
  let objectKey = options.objectKey;

  if (!objectKey && options.sha256) {
    const query = await queryResourceCatalog(
      {
        all: false,
        lane: laneName,
        limit: 1,
        objectKey: options.objectKey,
        sha256: options.sha256,
      },
      cwd,
    );

    objectKey = query.rows[0]?.objectKey;
  }

  if (!objectKey) {
    throw new Error('Missing object key. Provide --key directly or use --sha256 with an indexed asset.');
  }

  const result = await resolved.client.get(objectKey);

  return {
    body: result.content,
    bucket: resolved.bucket,
    headers: result.res?.headers ?? {},
    objectKey,
  };
}
`;

export function createEnvResourcesExample(): string {
  return `# Copy this file to .env.resources.local and fill the values before syncing assets.
# Do not commit real credentials.

AXI_ALIYUN_OSS_ACCESS_KEY_ID=
AXI_ALIYUN_OSS_ACCESS_KEY_SECRET=
AXI_ALIYUN_OSS_STS_TOKEN=
AXI_ALIYUN_OSS_REGION=
AXI_ALIYUN_OSS_ENDPOINT=
AXI_ALIYUN_OSS_PUBLIC_BUCKET=
AXI_ALIYUN_OSS_PRIVATE_BUCKET=
`;
}

export function createResourceStorageConfig(config: ScaffoldConfig): string {
  return serializeJson({
    catalog: {
      databasePath: '.axi/resource-index.sqlite',
      defaultCategory: 'uncategorized',
      hashPathSegments: [2, 2],
      objectKeyStrategy: 'sha256',
      projectNamespace: config.packageSlug,
      remoteIndexDir: 'index',
      remoteObjectDir: 'objects',
      remoteRootPrefix: 'projects',
    },
    lanes: {
      private: {
        acl: 'private',
        bucketEnv: 'AXI_ALIYUN_OSS_PRIVATE_BUCKET',
        excludeFileNames: ['README.md'],
        keyPrefix: '',
        provider: 'aliyunOss',
        sourceDir: 'resources/private',
      },
      public: {
        acl: 'private',
        bucketEnv: 'AXI_ALIYUN_OSS_PUBLIC_BUCKET',
        excludeFileNames: ['README.md'],
        keyPrefix: '',
        provider: 'aliyunOss',
        sourceDir: 'resources/public/web',
      },
    },
    providers: {
      aliyunOss: {
        accessKeyIdEnv: 'AXI_ALIYUN_OSS_ACCESS_KEY_ID',
        accessKeySecretEnv: 'AXI_ALIYUN_OSS_ACCESS_KEY_SECRET',
        authMode: 'aksk',
        authorizationV4: true,
        endpointEnv: 'AXI_ALIYUN_OSS_ENDPOINT',
        region: 'oss-cn-hangzhou',
        regionEnv: 'AXI_ALIYUN_OSS_REGION',
        sessionTokenEnv: 'AXI_ALIYUN_OSS_STS_TOKEN',
        type: 'aliyun-oss',
      },
    },
    version: 2,
  });
}

export function createResourceClassificationConfig(): string {
  return serializeJson({
    intake: {
      defaultLane: 'private',
      laneRules: [
        {
          description: 'Brand files default to the public delivery-safe lane.',
          lane: 'public',
          matchPrefixes: ['brand'],
          matchExtensions: ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'ico'],
          tags: ['delivery-safe'],
        },
        {
          description: 'Icons default to the public delivery-safe lane.',
          lane: 'public',
          matchPrefixes: ['icons'],
          matchExtensions: ['svg', 'png', 'webp', 'ico'],
          tags: ['delivery-safe'],
        },
        {
          description: 'Illustrations default to the public delivery-safe lane.',
          lane: 'public',
          matchPrefixes: ['illustrations'],
          matchExtensions: ['svg', 'png', 'jpg', 'jpeg', 'webp'],
          tags: ['delivery-safe'],
        },
        {
          description: 'Media defaults to the private lane until license and delivery rights are confirmed.',
          lane: 'private',
          matchPrefixes: ['media'],
          matchMimePrefixes: ['image/', 'video/', 'audio/'],
          reviewTags: ['review:license', 'review:delivery'],
          tags: ['media-candidate'],
        },
      ],
    },
    laneDefaults: {
      private: {
        tags: ['private'],
      },
      public: {
        tags: ['public', 'web'],
      },
    },
    rules: [
      {
        category: 'brand',
        matchPrefix: 'brand/',
        tags: ['branding', 'logo'],
      },
      {
        category: 'icons',
        matchPrefix: 'icons/',
        tags: ['icon'],
      },
      {
        category: 'illustrations',
        matchPrefix: 'illustrations/',
        tags: ['illustration'],
      },
      {
        category: 'media',
        matchPrefix: 'media/',
        tags: ['media'],
      },
    ],
    version: 3,
  });
}

export function createResourceStorageUtils(): string {
  return [
    resourceStoragePrelude,
    resourceStoragePlanning,
    resourceStorageCatalog,
    resourceStorageRuntime,
  ].join('\n');
}

export function createResourcesSync(): string {
  return `import { syncResourceLane } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

const [laneName, ...flags] = process.argv.slice(2);

if (!laneName) {
  throw new Error(
    'Usage: node ./scripts/resources-sync.mjs <public|private> [--dry-run] [--bucket <name>] [--region <id>] [--endpoint <url>]',
  );
}

const dryRun = flags.includes('--dry-run');
const summary = await syncResourceLane(laneName, {
  bucket: readFlagValue(flags, '--bucket'),
  dryRun,
  endpoint: readFlagValue(flags, '--endpoint'),
  region: readFlagValue(flags, '--region'),
});

console.log(
  \`[resources] \${dryRun ? 'planned' : 'finished'} lane "\${summary.lane}" with \${summary.uploadedCount} file(s). catalog=\${summary.databasePath}\`,
);
`;
}

export function createResourcesBucket(): string {
  return `import { createResourceBucketLane } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

const [laneName, ...flags] = process.argv.slice(2);

if (!laneName) {
  throw new Error(
    'Usage: node ./scripts/resources-bucket.mjs <public|private> [--bucket <name>] [--region <id>] [--endpoint <url>] [--no-persist]',
  );
}

const summary = await createResourceBucketLane(laneName, {
  bucket: readFlagValue(flags, '--bucket'),
  endpoint: readFlagValue(flags, '--endpoint'),
  persist: !flags.includes('--no-persist'),
  region: readFlagValue(flags, '--region'),
});

console.log(
  \`[resources] bucket ready for lane "\${summary.lane}": \${summary.bucket} (acl=\${summary.acl}).\`,
);
`;
}

export function createResourcesIndex(): string {
  return `import { indexResourceLane } from './resource-storage.mjs';

const [laneName] = process.argv.slice(2);

if (!laneName) {
  throw new Error('Usage: node ./scripts/resources-index.mjs <public|private>');
}

const summary = await indexResourceLane(laneName);

console.log(
  \`[resources] indexed lane "\${summary.lane}" with \${summary.indexedCount} file(s). catalog=\${summary.databasePath}\`,
);
`;
}

export function createResourcesClassify(): string {
  return `import { classifyResourceFile } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

function readFlagValues(flags, flagName) {
  const values = [];

  for (let index = 0; index < flags.length; index += 1) {
    if (flags[index] !== flagName) {
      continue;
    }

    const value = flags[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(\`Expected a value after \${flagName}\`);
    }

    values.push(value);
    index += 1;
  }

  return values;
}

const flags = process.argv.slice(2);
const filePath = readFlagValue(flags, '--file');

if (!filePath) {
  throw new Error(
    'Usage: node ./scripts/resources-classify.mjs --file <path> [--lane <public|private>] [--category <name>] [--tag <value>] [--name <fileName>] [--path <classificationPath>]',
  );
}

const summary = await classifyResourceFile({
  category: readFlagValue(flags, '--category'),
  classificationPath: readFlagValue(flags, '--path'),
  fileName: readFlagValue(flags, '--name'),
  filePath,
  lane: readFlagValue(flags, '--lane'),
  tags: readFlagValues(flags, '--tag'),
});

console.log(JSON.stringify(summary, null, 2));
`;
}

export function createResourcesBatchIntake(): string {
  return `import { intakeResourceBatch } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

function readFlagValues(flags, flagName) {
  const values = [];

  for (let index = 0; index < flags.length; index += 1) {
    if (flags[index] !== flagName) {
      continue;
    }

    const value = flags[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(\`Expected a value after \${flagName}\`);
    }

    values.push(value);
    index += 1;
  }

  return values;
}

const flags = process.argv.slice(2);
const files = readFlagValues(flags, '--file');
const classificationPaths = readFlagValues(flags, '--path');
const fileNames = readFlagValues(flags, '--name');

if (files.length === 0) {
  throw new Error(
    'Usage: node ./scripts/resources-batch-intake.mjs --file <path> [--file <path>] [--path <classificationPath>] [--name <fileName>] [--tag <value>] [--lane <public|private>] [--dry-run] [--continue-on-error]',
  );
}

if (classificationPaths.length > 0 && classificationPaths.length !== files.length) {
  throw new Error('When --path is provided for batch intake, provide one --path per --file.');
}

if (fileNames.length > 0 && fileNames.length !== files.length) {
  throw new Error('When --name is provided for batch intake, provide one --name per --file.');
}

const summary = await intakeResourceBatch({
  bucket: readFlagValue(flags, '--bucket'),
  continueOnError: flags.includes('--continue-on-error'),
  dryRun: flags.includes('--dry-run'),
  endpoint: readFlagValue(flags, '--endpoint'),
  items: files.map((filePath, index) => ({
    classificationPath: classificationPaths[index],
    fileName: fileNames[index],
    filePath,
  })),
  lane: readFlagValue(flags, '--lane'),
  region: readFlagValue(flags, '--region'),
  tags: readFlagValues(flags, '--tag'),
});

console.log(JSON.stringify(summary, null, 2));
`;
}

export function createResourcesQuery(): string {
  return `import { queryResourceCatalog } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

function readFlagValues(flags, flagName) {
  const values = [];

  for (let index = 0; index < flags.length; index += 1) {
    if (flags[index] !== flagName) {
      continue;
    }

    const value = flags[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(\`Expected a value after \${flagName}\`);
    }

    values.push(value);
    index += 1;
  }

  return values;
}

const flags = process.argv.slice(2);
const limitValue = readFlagValue(flags, '--limit');
const report = await queryResourceCatalog({
  all: flags.includes('--all'),
  category: readFlagValue(flags, '--category'),
  lane: readFlagValue(flags, '--lane'),
  limit: limitValue ? Number.parseInt(limitValue, 10) : undefined,
  objectKey: readFlagValue(flags, '--key'),
  name: readFlagValue(flags, '--name'),
  needsReview: flags.includes('--needs-review')
    ? true
    : flags.includes('--no-needs-review')
      ? false
      : undefined,
  sha256: readFlagValue(flags, '--sha256'),
  tag: readFlagValue(flags, '--tag'),
  tagMode: readFlagValue(flags, '--tag-mode'),
  tags: readFlagValues(flags, '--tag'),
});

console.log(JSON.stringify(report, null, 2));
`;
}

export function createResourcesReview(): string {
  return `import { reviewResourceCatalog } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

function readFlagValues(flags, flagName) {
  const values = [];

  for (let index = 0; index < flags.length; index += 1) {
    if (flags[index] !== flagName) {
      continue;
    }

    const value = flags[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(\`Expected a value after \${flagName}\`);
    }

    values.push(value);
    index += 1;
  }

  return values;
}

const flags = process.argv.slice(2);
const report = await reviewResourceCatalog({
  lane: readFlagValue(flags, '--lane'),
  needsReview: flags.includes('--all-status') ? undefined : true,
  tag: readFlagValue(flags, '--tag'),
  tagMode: readFlagValue(flags, '--tag-mode'),
  tags: readFlagValues(flags, '--tag'),
});

console.log(JSON.stringify(report, null, 2));
`;
}

export function createResourcesFetch(): string {
  return `import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readResourceObject } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

const [laneName, ...flags] = process.argv.slice(2);

if (!laneName) {
  throw new Error(
    'Usage: node ./scripts/resources-fetch.mjs <public|private> [--sha256 <hash> | --key <objectKey>] [--output <file>] [--stdout]',
  );
}

const outputPath = readFlagValue(flags, '--output');
const stdout = flags.includes('--stdout');

if (!outputPath && !stdout) {
  throw new Error('Provide either --output <file> or --stdout.');
}

const result = await readResourceObject(laneName, {
  objectKey: readFlagValue(flags, '--key'),
  sha256: readFlagValue(flags, '--sha256'),
});
const buffer = Buffer.isBuffer(result.body) ? result.body : Buffer.from(result.body);

if (outputPath) {
  const absoluteOutputPath = path.resolve(process.cwd(), outputPath);

  await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await writeFile(absoluteOutputPath, buffer);
  console.log(
    \`[resources] fetched oss://\${result.bucket}/\${result.objectKey} -> \${absoluteOutputPath}\`,
  );
}

if (stdout) {
  process.stdout.write(buffer);
}
`;
}

export function createResourcesGet(): string {
  return `import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readResourceObject } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

const [laneName, ...flags] = process.argv.slice(2);

if (!laneName) {
  throw new Error(
    'Usage: node ./scripts/resources-get.mjs <public|private> [--sha256 <hash> | --key <objectKey>] [--output <file>] [--stdout]',
  );
}

const outputPath = readFlagValue(flags, '--output');
const stdout = flags.includes('--stdout');

if (!outputPath && !stdout) {
  throw new Error('Provide either --output <file> or --stdout.');
}

const result = await readResourceObject(laneName, {
  objectKey: readFlagValue(flags, '--key'),
  sha256: readFlagValue(flags, '--sha256'),
});
const buffer = Buffer.isBuffer(result.body) ? result.body : Buffer.from(result.body);

if (outputPath) {
  const absoluteOutputPath = path.resolve(process.cwd(), outputPath);

  await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await writeFile(absoluteOutputPath, buffer);
  console.log(
    \`[resources] fetched oss://\${result.bucket}/\${result.objectKey} -> \${absoluteOutputPath}\`,
  );
}

if (stdout) {
  process.stdout.write(buffer);
}
`;
}

export function createResourcesPut(): string {
  return `import { putResourceFile } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

function readFlagValues(flags, flagName) {
  const values = [];

  for (let index = 0; index < flags.length; index += 1) {
    if (flags[index] !== flagName) {
      continue;
    }

    const value = flags[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(\`Expected a value after \${flagName}\`);
    }

    values.push(value);
    index += 1;
  }

  return values;
}

const [laneName, ...flags] = process.argv.slice(2);

if (!laneName) {
  throw new Error(
    'Usage: node ./scripts/resources-put.mjs <public|private> --file <path> [--category <name>] [--tag <value>] [--name <fileName>] [--path <classificationPath>] [--dry-run]',
  );
}

const summary = await putResourceFile(laneName, {
  category: readFlagValue(flags, '--category'),
  classificationPath: readFlagValue(flags, '--path'),
  dryRun: flags.includes('--dry-run'),
  fileName: readFlagValue(flags, '--name'),
  filePath: readFlagValue(flags, '--file'),
  tags: readFlagValues(flags, '--tag'),
});

console.log(
  \`[resources] \${summary.dryRun ? 'planned' : 'stored'} lane "\${summary.lane}" file "\${summary.entry.fileName}" as \${summary.entry.sha256}.\`,
);
`;
}

export function createResourcesIntake(): string {
  return `import { intakeResourceFile } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

function readFlagValues(flags, flagName) {
  const values = [];

  for (let index = 0; index < flags.length; index += 1) {
    if (flags[index] !== flagName) {
      continue;
    }

    const value = flags[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(\`Expected a value after \${flagName}\`);
    }

    values.push(value);
    index += 1;
  }

  return values;
}

const flags = process.argv.slice(2);
const filePath = readFlagValue(flags, '--file');

if (!filePath) {
  throw new Error(
    'Usage: node ./scripts/resources-intake.mjs --file <path> [--lane <public|private>] [--category <name>] [--tag <value>] [--name <fileName>] [--path <classificationPath>] [--dry-run] [--bucket <name>] [--region <id>] [--endpoint <url>]',
  );
}

const summary = await intakeResourceFile({
  bucket: readFlagValue(flags, '--bucket'),
  category: readFlagValue(flags, '--category'),
  classificationPath: readFlagValue(flags, '--path'),
  dryRun: flags.includes('--dry-run'),
  endpoint: readFlagValue(flags, '--endpoint'),
  fileName: readFlagValue(flags, '--name'),
  filePath,
  lane: readFlagValue(flags, '--lane'),
  region: readFlagValue(flags, '--region'),
  tags: readFlagValues(flags, '--tag'),
});

console.log(JSON.stringify(summary, null, 2));
`;
}

export function createResourcesDelete(): string {
  return `import { deleteResourceObject } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

const [laneName, ...flags] = process.argv.slice(2);

if (!laneName) {
  throw new Error(
    'Usage: node ./scripts/resources-delete.mjs <public|private> [--sha256 <hash> | --key <objectKey>] [--dry-run]',
  );
}

const summary = await deleteResourceObject(laneName, {
  dryRun: flags.includes('--dry-run'),
  objectKey: readFlagValue(flags, '--key'),
  sha256: readFlagValue(flags, '--sha256'),
});

console.log(
  \`[resources] \${summary.dryRun ? 'planned delete for' : 'deleted'} lane "\${summary.lane}" object \${summary.objectKey}.\`,
);
`;
}

export function createResourcesGc(): string {
  return `import { garbageCollectResourceCatalog } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

const flags = process.argv.slice(2);
const summary = await garbageCollectResourceCatalog({
  allMissing: flags.includes('--all-missing'),
  lane: readFlagValue(flags, '--lane'),
});

console.log(
  \`[resources] garbage collected \${summary.removedCount} row(s) from \${summary.databasePath}.\`,
);
`;
}
