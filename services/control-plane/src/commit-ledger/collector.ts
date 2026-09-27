/**
 * Commit Ledger Git Collector (TypeScript)
 * 采集 Axi 工作区所有 canonical Git 项目的提交日志
 *
 * Usage: npx ts-node collector.ts [--since <ISO-date>] [--until <ISO-date>] [--limit <num>] [--repo <projectId>]
 *
 * Output: JSONL with CommitLedgerV1 schema
 */

import { createHash } from 'crypto';
import { execSync, ExecSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ============================================================================
// Types
// ============================================================================

interface RepoConfig {
  projectId: string;
  partition: 'projects' | 'products' | 'shared' | 'infra' | 'tools';
}

interface CommitRecord {
  schemaVersion: string;
  recordId: string;
  repo: {
    projectId: string;
    canonicalPath: string;
    gitRoot: string;
    remote: string | null;
    defaultBranch: string;
  };
  commit: {
    sha: string;
    shortSha: string;
    parentShas: string[];
    subject: string;
    body: string;
    type: string;
    scope: string | null;
    breaking: boolean;
    authoredAt: string;
    committedAt: string;
  };
  actor: {
    name: string;
    email: string | null;
  };
  refs: {
    branches: string[];
    tags: string[];
  };
  diff: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
  trailers: {
    tested: string[];
    notTested: string[];
    confidence: number | null;
    scopeRisk: string | null;
    directive: string | null;
    refs: string[];
  };
  workspaceState: {
    observedBranch: string;
    isDirty: boolean;
    ahead: number;
    behind: number;
    observedAt: string;
  };
  verification: {
    status: string;
    commands: string[];
    evidenceRefs: string[];
    observedAt: string;
  };
  provenance: {
    source: string;
    sourcePath: string;
    sourceCommand: string;
    sourceHash: string;
    observedAt: string;
  };
  ingestion: {
    idempotencyKey: string;
    firstSeenAt: string;
    lastSeenAt: string;
    status: string;
  };
}

interface CollectResult {
  projectId: string;
  partition: string;
  path: string;
  branch: string;
  isDirty: boolean;
  commits: CommitRecord[];
  count: number;
  errors?: CollectError[];
}

interface CollectError {
  error: string;
  projectId?: string;
  path?: string;
  message?: string;
  sha?: string;
}

interface CollectOptions {
  since?: string;
  until?: string;
  limit?: number;
  repo?: string;
  output?: string;
}

// ============================================================================
// Canonical Repository List (24 repos from Phase 1 findings)
// ============================================================================

const CANONICAL_REPOS: RepoConfig[] = [
  // projects 分区 (9)
  { projectId: 'axi-workbench', partition: 'projects' },
  { projectId: 'axi-docs', partition: 'projects' },
  { projectId: 'axi-image-preview', partition: 'projects' },
  { projectId: 'axi-pet', partition: 'projects' },
  { projectId: 'axi-rules', partition: 'projects' },
  { projectId: 'axi-notify', partition: 'projects' },
  { projectId: 'axi-sports-management-app', partition: 'projects' },
  { projectId: 'axi-agent-platform', partition: 'projects' },
  { projectId: 'axi-pet-desktop', partition: 'projects' },
  // products 分区 (5)
  { projectId: 'ielts-vocab', partition: 'products' },
  { projectId: 'ai-resource-orchestration', partition: 'products' },
  { projectId: 'axi-artboard', partition: 'products' },
  { projectId: 'axi-soul-world', partition: 'products' },
  { projectId: 'story-graph', partition: 'products' },
  // shared 分区 (3)
  { projectId: 'axi-ui', partition: 'shared' },
  { projectId: 'axi-tauri-starter', partition: 'shared' },
  { projectId: 'axi-skills', partition: 'shared' },
  // infra 分区 (2)
  { projectId: 'axi-workspace-governance', partition: 'infra' },
  { projectId: 'axi-registry', partition: 'infra' },
  // tools 分区 (5)
  { projectId: 'axi-video-downloader', partition: 'tools' },
  { projectId: 'axi-proxy-companion', partition: 'tools' },
  { projectId: 'axi-feishu-codex-bridge', partition: 'tools' },
];

// 路径映射：从环境变量 AXI_WORKSPACE_ROOT 派生，便于移植到不同机器/容器
function buildPathMap(): Record<string, string> {
  const root = process.env.AXI_WORKSPACE_ROOT;
  if (!root) return {};
  const r = (suffix: string) => `${root.replace(/\/$/, '')}/${suffix}`;
  return {
    'axi-workbench': r('projects/axi-workbench'),
    'axi-docs': r('projects/axi-workbench/apps/axi-docs'),
    'axi-image-preview': r('projects/axi-image-preview'),
    'axi-pet': r('projects/axi-pet'),
    'axi-rules': r('projects/axi-rules'),
    'axi-notify': r('projects/axi-notify'),
    'axi-sports-management-app': r('projects/axi-sports-management-app'),
    'axi-agent-platform': r('projects/axi-agent-platform'),
    'axi-pet-desktop': r('projects/axi-pet-desktop'),
    'ielts-vocab': r('products/ielts-vocab'),
    'ai-resource-orchestration': r('products/ai-resource-orchestration'),
    'axi-artboard': r('products/axi-artboard'),
    'axi-soul-world': r('products/axi-soul-world'),
    'story-graph': r('products/story-graph'),
    'axi-ui': r('shared/axi-ui'),
    'axi-tauri-starter': r('shared/axi-tauri-starter'),
    'axi-skills': r('shared/axi-skills'),
    'axi-workspace-governance': r('infra/axi-workspace-governance'),
    'axi-registry': r('infra/axi-registry'),
    'axi-video-downloader': r('tools/axi-video-downloader'),
    'axi-proxy-companion': r('tools/axi-proxy-companion'),
    'axi-feishu-codex-bridge': r('tools/axi-feishu-codex-bridge'),
  };
}

const PATH_MAP: Record<string, string> = buildPathMap();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 生成 recordId (sha256:repoId:commitSha)
 */
export function generateRecordId(projectId: string, sha: string): string {
  return createHash('sha256').update(`${projectId}:${sha}`).digest('hex');
}

/**
 * 生成幂等键
 */
function generateIdempotencyKey(projectId: string, sha: string): string {
  return `${projectId}:${sha}`;
}

/**
 * 解析 Conventional Commit
 */
export function parseConventionalCommit(subject: string): {
  type: string;
  scope: string | null;
  breaking: boolean;
  subject: string;
} {
  const match = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)/);
  if (match) {
    return {
      type: match[1],
      scope: match[2] || null,
      breaking: !!match[3],
      subject: match[4]
    };
  }
  return { type: 'unknown', scope: null, breaking: false, subject };
}

/**
 * Git 错误分类
 */
type GitErrorType = 'not-found' | 'not-git' | 'no-commits' | 'permission-denied' | 'git-error' | 'unknown';

/**
 * 执行 Git 命令
 */
function git(cwd: string, cmd: string, timeout = 5000): string | null {
  const options: ExecSyncOptions = {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout,
    stdio: ['pipe', 'pipe', 'pipe']
  };

  try {
    return execSync(cmd, options) as string;
  } catch (e: unknown) {
    const error = e as { status?: number; message?: string };
    if (error.status === 128) {
      // Permission denied
      return null;
    }
    // 其他 git 错误
    return null;
  }
}

/**
 * 检查路径是否为有效 Git 仓库
 */
function validateRepoPath(projectId: string): { valid: boolean; error?: GitErrorType; path?: string } {
  const repoPath = PATH_MAP[projectId];
  if (!repoPath) {
    return { valid: false, error: 'not-found' };
  }

  if (!fs.existsSync(repoPath)) {
    console.warn(`[WARN] Repository not found: ${projectId} at ${repoPath}`);
    return { valid: false, error: 'not-found', path: repoPath };
  }

  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    console.warn(`[WARN] Not a git repository: ${projectId} at ${repoPath}`);
    return { valid: false, error: 'not-git', path: repoPath };
  }

  return { valid: true, path: repoPath };
}

// ============================================================================
// Git Data Collection
// ============================================================================

/**
 * 获取仓库元信息
 */
function getRepoMetadata(repoPath: string): {
  branch: string;
  isDirty: boolean;
  remote: string | null;
} {
  const branch = git(repoPath, 'git branch --show-current')?.trim() || 'unknown';
  const status = git(repoPath, 'git status --porcelain') || '';
  const isDirty = status.trim().length > 0;
  const remote = git(repoPath, 'git remote get-url origin 2>/dev/null')?.trim() || null;

  return { branch, isDirty, remote };
}

/**
 * 构建 git log 命令
 */
function buildGitLogCmd(sha: string, format: string): string {
  // format: %H|%P|%s|%b|%an|%ae|%aI|%cI
  // 使用 %x00 分隔符避免换行问题
  return `git log -1 --format="${format.replace(/\|/g, '%x00')}" ${sha}`;
}

/**
 * 获取单个 commit 详细信息
 */
function getCommitDetails(repoPath: string, sha: string): {
  commitSha: string;
  parents: string[];
  subject: string;
  body: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committerName: string;
  committerEmail: string;
  committedAt: string;
} | null {
  // 使用 \x00 分隔符
  const format = '%H|%P|%s|%b|%an|%ae|%aI|%cn|%ce|%cI';
  const commitInfo = git(repoPath, `git log -1 --format="${format.replace(/\|/g, '%x00')}" ${sha}`);
  if (!commitInfo) return null;

  const parts = commitInfo.split('\x00');
  if (parts.length < 10) return null;

  return {
    commitSha: parts[0],
    parents: parts[1] ? parts[1].split(' ').filter(s => s.trim()) : [],
    subject: parts[2],
    body: parts[3] || '',
    authorName: parts[4],
    authorEmail: parts[5],
    authoredAt: parts[6],
    committerName: parts[7],
    committerEmail: parts[8],
    committedAt: parts[9]
  };
}

/**
 * 获取 diff stat
 */
function getDiffStat(repoPath: string, sha: string): { filesChanged: number; insertions: number; deletions: number } {
  const diffStat = git(repoPath, `git diff-tree -r --no-commit-id --shortstat ${sha}`) || '';
  const match = diffStat.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);

  return {
    filesChanged: match ? parseInt(match[1]) || 0 : 0,
    insertions: match ? parseInt(match[2]) || 0 : 0,
    deletions: match ? parseInt(match[3]) || 0 : 0
  };
}

/**
 * 获取 refs (branches and tags)
 */
function getRefs(repoPath: string, sha: string): { branches: string[]; tags: string[] } {
  // 获取包含此 commit 的分支
  const branchesOutput = git(repoPath, `git branch --contains ${sha} 2>/dev/null`) || '';
  const branches = branchesOutput
    .split('\n')
    .map(b => b.trim().replace(/^\*\s+/, ''))
    .filter(b => b && b !== '(HEAD detached');

  // 获取包含此 commit 的标签
  const tagsOutput = git(repoPath, `git tag --contains ${sha} 2>/dev/null`) || '';
  const tags = tagsOutput.split('\n').map(t => t.trim()).filter(t => t);

  return { branches, tags };
}

/**
 * 获取 commit 关联的分支名 (git name-rev)
 */
function getNameRev(repoPath: string, sha: string): string | null {
  return git(repoPath, `git name-rev --name-only ${sha}`)?.trim() || null;
}

/**
 * 解析 body 中的 trailers
 */
function parseTrailers(body: string): {
  tested: string[];
  notTested: string[];
  confidence: number | null;
  scopeRisk: string | null;
  directive: string | null;
  refs: string[];
} {
  const testedMatch = body.match(/^Tested:(.+)$/gm);
  const notTestedMatch = body.match(/^Not-tested:(.+)$/gm);
  const confidenceMatch = body.match(/^Confidence:\s*(\d+(?:\.\d+)?)/m);
  const scopeRiskMatch = body.match(/^Scope-risk:\s*(.+)$/m);
  const directiveMatch = body.match(/^Directive:\s*(.+)$/m);
  const refsMatch = body.match(/^Refs?:\s*(.+)$/gm);

  return {
    tested: testedMatch?.map(m => m.replace(/^Tested:\s*/i, '').trim()) || [],
    notTested: notTestedMatch?.map(m => m.replace(/^Not-tested:\s*/i, '').trim()) || [],
    confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : null,
    scopeRisk: scopeRiskMatch?.[1]?.trim() || null,
    directive: directiveMatch?.[1]?.trim() || null,
    refs: refsMatch?.map(m => m.replace(/^Refs?:\s*/i, '').trim()) || []
  };
}

/**
 * 构建 git log 过滤参数
 */
function buildLogFilters(options: CollectOptions): string {
  const filters: string[] = [];

  if (options.since) {
    filters.push(`--since="${options.since}"`);
  }
  if (options.until) {
    filters.push(`--until="${options.until}"`);
  }
  if (options.limit) {
    filters.push(`-n ${options.limit}`);
  }

  return filters.join(' ');
}

/**
 * 获取 commit SHA 列表
 */
function getCommitShas(repoPath: string, options: CollectOptions): string[] {
  const filters = buildLogFilters(options);
  const output = git(repoPath, `git log --all --format="%H" ${filters}`.trim()) || '';
  return output.split('\n').filter(s => s.trim());
}

// ============================================================================
// Core Collection Function
// ============================================================================

/**
 * 采集单个仓库的提交
 */
export function collectRepoCommits(
  repoConfig: RepoConfig,
  options: CollectOptions = {}
): CollectResult | CollectError {
  const { projectId, partition } = repoConfig;
  const validation = validateRepoPath(projectId);

  if (!validation.valid || !validation.path) {
    return {
      error: validation.error || 'unknown',
      projectId,
      path: validation.path
    };
  }

  const repoPath = validation.path;
  const records: CommitRecord[] = [];
  const errors: CollectError[] = [];
  const now = new Date().toISOString();

  try {
    // 获取仓库元信息
    const { branch, isDirty, remote } = getRepoMetadata(repoPath);

    // 获取 commit SHA 列表
    const shaList = getCommitShas(repoPath, options);

    if (shaList.length === 0) {
      return {
        error: 'no-commits',
        projectId,
        path: repoPath
      };
    }

    for (const sha of shaList) {
      if (!sha.trim()) continue;

      try {
        // 获取单个 commit 详细信息
        const details = getCommitDetails(repoPath, sha.trim());
        if (!details) {
          errors.push({ error: 'git-error', sha: sha.trim(), message: 'Failed to get commit details' });
          continue;
        }

        // 获取 diff stat
        const diffStat = getDiffStat(repoPath, sha.trim());

        // 获取 refs
        const refs = getRefs(repoPath, sha.trim());

        // 获取 git name-rev
        const nameRev = getNameRev(repoPath, sha.trim());

        // 解析 trailers
        const trailers = parseTrailers(details.body);

        // 解析 Conventional Commit
        const parsed = parseConventionalCommit(details.subject);

        const record: CommitRecord = {
          schemaVersion: 'commit-ledger.v1',
          recordId: generateRecordId(projectId, details.commitSha.trim()),
          repo: {
            projectId,
            canonicalPath: repoPath,
            gitRoot: repoPath,
            remote,
            defaultBranch: branch
          },
          commit: {
            sha: details.commitSha.trim(),
            shortSha: details.commitSha.trim().substring(0, 12),
            parentShas: details.parents,
            subject: details.subject.trim(),
            body: details.body?.trim().substring(0, 4096) || '',
            type: parsed.type,
            scope: parsed.scope,
            breaking: parsed.breaking,
            authoredAt: details.authoredAt,
            committedAt: details.committedAt
          },
          actor: {
            name: details.authorName?.trim() || 'unknown',
            email: details.authorEmail?.trim() || null
          },
          refs: {
            branches: refs.branches,
            tags: refs.tags
          },
          diff: diffStat,
          trailers,
          workspaceState: {
            observedBranch: branch,
            isDirty,
            ahead: 0,
            behind: 0,
            observedAt: now
          },
          verification: {
            status: 'unverified',
            commands: nameRev ? [`git name-rev ${sha.trim()}`] : [],
            evidenceRefs: [],
            observedAt: now
          },
          provenance: {
            source: 'git',
            sourcePath: repoPath,
            sourceCommand: 'git log + git diff-tree + git branch --contains + git tag --contains',
            sourceHash: details.commitSha.trim(),
            observedAt: now
          },
          ingestion: {
            idempotencyKey: generateIdempotencyKey(projectId, details.commitSha.trim()),
            firstSeenAt: now,
            lastSeenAt: now,
            status: 'new'
          }
        };

        records.push(record);
      } catch (e: unknown) {
        const err = e as Error;
        errors.push({
          error: 'git-error',
          sha: sha.trim(),
          message: err.message
        });
      }
    }

    return {
      projectId,
      partition,
      path: repoPath,
      branch,
      isDirty,
      commits: records,
      count: records.length,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (e: unknown) {
    const err = e as Error;
    return {
      error: 'unknown',
      projectId,
      message: err.message
    };
  }
}

/**
 * 采集所有仓库
 */
export function collectAll(options: CollectOptions = {}): {
  results: CollectResult[];
  errors: CollectError[];
  summary: {
    totalRepos: number;
    successfulRepos: number;
    failedRepos: number;
    totalCommits: number;
  };
  collectedAt: string;
} {
  const results: CollectResult[] = [];
  const errors: CollectError[] = [];

  // 过滤仓库列表
  let reposToCollect = CANONICAL_REPOS;
  if (options.repo) {
    reposToCollect = CANONICAL_REPOS.filter(r => r.projectId === options.repo);
    if (reposToCollect.length === 0) {
      console.error(`[ERROR] Unknown repo: ${options.repo}`);
      console.error(`Available repos: ${CANONICAL_REPOS.map(r => r.projectId).join(', ')}`);
      process.exit(1);
    }
  }

  for (const repo of reposToCollect) {
    console.log(`[INFO] Collecting ${repo.projectId}...`);
    const result = collectRepoCommits(repo, options);

    if ('error' in result) {
      errors.push(result);
    } else {
      results.push(result);
      console.log(`[OK] ${result.projectId}: ${result.count} commits`);
    }
  }

  return {
    results,
    errors,
    summary: {
      totalRepos: reposToCollect.length,
      successfulRepos: results.length,
      failedRepos: errors.length,
      totalCommits: results.reduce((sum, r) => sum + r.count, 0)
    },
    collectedAt: new Date().toISOString()
  };
}

/**
 * 输出 JSONL 格式
 */
export function outputJsonl(records: CommitRecord[], outputPath?: string): void {
  const outputStream = outputPath
    ? fs.createWriteStream(outputPath)
    : process.stdout;

  for (const record of records) {
    outputStream.write(JSON.stringify(record) + '\n');
  }

  if (outputPath) {
    outputStream.end();
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function parseArgs(): CollectOptions {
  const args = process.argv.slice(2);
  const options: CollectOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--since':
        options.since = args[++i];
        break;
      case '--until':
        options.until = args[++i];
        break;
      case '--limit':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--repo':
        options.repo = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      default:
        if (!args[i].startsWith('--')) {
          // 位置参数支持
          if (args[i] === 'jsonl') {
            options.output = args[++i];
          }
        }
    }
  }

  return options;
}

// 主入口
if (require.main === module) {
  const options = parseArgs();

  // 如果指定了单个 repo，使用 JSONL 输出
  if (options.repo) {
    const result = collectRepoCommits(
      CANONICAL_REPOS.find(r => r.projectId === options.repo)!,
      options
    );

    if ('error' in result) {
      console.error(`[ERROR] ${result.error}: ${result.projectId}`);
      if (result.message) console.error(`  ${result.message}`);
      process.exit(1);
    }

    outputJsonl(result.commits, options.output);

    if (!options.output) {
      // stdout 已经输出，输出摘要
      console.error(`\n[OK] ${result.count} commits collected from ${result.projectId}`);
    }
  } else {
    // 采集所有仓库
    const output = collectAll(options);

    if (options.output) {
      // JSONL 格式输出所有记录
      const allRecords = output.results.flatMap(r => r.commits);
      outputJsonl(allRecords, options.output);
      console.error(`[OK] ${allRecords.length} commits written to ${options.output}`);
    }

    // 摘要输出到 stderr
    console.error(`\n[Summary]`);
    console.error(`  Total repos: ${output.summary.totalRepos}`);
    console.error(`  Successful: ${output.summary.successfulRepos}`);
    console.error(`  Failed: ${output.summary.failedRepos}`);
    console.error(`  Total commits: ${output.summary.totalCommits}`);

    if (output.errors.length > 0) {
      console.error(`\n[Errors]`);
      for (const err of output.errors) {
        console.error(`  ${err.projectId}: ${err.error}`);
      }
    }
  }
}

// ESM 导出
export default {
  collectAll,
  collectRepoCommits,
  generateRecordId,
  parseConventionalCommit,
  outputJsonl
};
