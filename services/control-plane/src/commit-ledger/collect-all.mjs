/**
 * Commit Ledger Git Collector
 * 采集 Axi 工作区所有 canonical Git 项目的提交日志
 *
 * This module is the single implementation of the commit-ledger collector.
 * `collector.ts` is a thin typed facade over it.
 *
 * The repo roster comes from the workspace governance registry
 * (`workspace.graph.json`) through `repos-loader.mjs`: there is no
 * hardcoded project list and no hardcoded partition path in this file. The
 * previous version kept its own `CANONICAL_REPOS` list and concatenated
 * `AXI_WORKSPACE_ROOT` onto retired partition directories (`projects/`,
 * `shared/`, `infra/`), which the 2026-10-17 partition split removed.
 *
 * Usage: node collect-all.mjs [--since <ISO-date>] [--until <ISO-date>]
 *                              [--limit <num>] [--repo <projectId>]
 *                              [--output <file>]
 */

import { createHash } from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { loadRepos, loadReposFromGraph } from './repos-loader.mjs';

export { loadRepos, loadReposFromGraph };

/** Default per-repo commit cap, so a sync never walks an unbounded history. */
const DEFAULT_LIMIT = 500;

/**
 * The roster, resolved once per module load from the governance registry.
 * @type {Array<{projectId: string, partition: string, path: string}>}
 */
const CANONICAL_REPOS = loadRepos();

/** projectId -> absolute repository path, both taken from the registry. */
const PATH_MAP = Object.fromEntries(CANONICAL_REPOS.map((repo) => [repo.projectId, repo.path]));

/**
 * 生成 recordId (sha256)
 */
export function generateRecordId(projectId, sha) {
  return createHash('sha256').update(`${projectId}:${sha}`).digest('hex');
}

/**
 * 解析 Conventional Commit
 */
export function parseConventionalCommit(subject) {
  const match = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)/);
  if (match) {
    return { type: match[1], scope: match[2] || null, breaking: !!match[3], subject: match[4] };
  }
  return { type: 'unknown', scope: null, breaking: false, subject };
}

/**
 * 解析 body 中的 trailers
 */
export function parseTrailers(body) {
  const testedMatch = body?.match(/^Tested:(.+)$/gm);
  const notTestedMatch = body?.match(/^Not-tested:(.+)$/gm);
  const confidenceMatch = body?.match(/^Confidence:\s*(\d+(?:\.\d+)?)/m);
  const scopeRiskMatch = body?.match(/^Scope-risk:\s*(.+)$/m);
  const directiveMatch = body?.match(/^Directive:\s*(.+)$/m);
  const refsMatch = body?.match(/^Refs?:\s*(.+)$/gm);

  return {
    tested: testedMatch?.map(m => m.replace(/^Tested:\s*/i, '').trim()) || [],
    notTested: notTestedMatch?.map(m => m.replace(/^Not-tested:\s*/i, '').trim()) || [],
    confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : null,
    scopeRisk: scopeRiskMatch?.[1]?.trim() || null,
    directive: directiveMatch?.[1]?.trim() || null,
    refs: refsMatch?.map(m => m.replace(/^Refs?:\s*/i, '').trim()) || [],
  };
}

/**
 * 执行 Git 命令
 */
function git(cwd, cmd, timeout = 5000) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout });
  } catch (e) {
    return null;
  }
}

/**
 * 构建 git log 过滤参数
 */
function buildLogFilters(options = {}) {
  const filters = [];
  if (options.since) filters.push(`--since="${options.since}"`);
  if (options.until) filters.push(`--until="${options.until}"`);
  filters.push(`-n ${Number.isFinite(options.limit) ? options.limit : DEFAULT_LIMIT}`);
  return filters.join(' ');
}

/**
 * 采集单个仓库的提交
 */
export function collectRepoCommits(repoConfig, options = {}) {
  const { projectId, partition } = repoConfig;
  const repoPath = repoConfig.path || PATH_MAP[projectId];

  if (!repoPath) {
    return { error: 'unknown-path', projectId };
  }

  if (!fs.existsSync(repoPath)) {
    return { error: 'not-found', projectId, path: repoPath };
  }

  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    return { error: 'not-git', projectId, path: repoPath };
  }

  const records = [];
  const errors = [];

  try {
    // 获取仓库状态
    const branch = git(repoPath, 'git branch --show-current')?.trim() || 'unknown';
    const status = git(repoPath, 'git status --porcelain') || '';
    const isDirty = status.trim().length > 0;
    const remote = git(repoPath, 'git remote get-url origin 2>/dev/null')?.trim() || null;

    // 获取 commit SHAs
    const filters = buildLogFilters(options);
    const shaList = git(repoPath, `git log --all --format="%H" ${filters}`.trim())?.trim()?.split('\n') || [];
    if (shaList.length === 0) {
      return { error: 'no-commits', projectId };
    }

    for (const sha of shaList) {
      if (!sha.trim()) continue;

      try {
        // 获取单个 commit 信息 - 使用 %x00 分隔符避免换行问题
        const commitInfo = git(repoPath, `git log -1 --format="%H%x00%P%x00%s%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI" ${sha.trim()}`);
        if (!commitInfo) continue;

        const parts = commitInfo.split('\x00');
        if (parts.length < 8) continue;

        const [commitSha, parents, subject, authorName, authorEmail, authoredAt, committerName, committerEmail, committedAt] = parts;
        const parentShas = parents ? parents.split(' ').filter(s => s) : [];

        // 获取 body 和 trailers (单独查询)
        const body = git(repoPath, `git log -1 --format="%b" ${sha.trim()}`) || '';

        // 获取 diff stat
        const diffStat = git(repoPath, `git diff-tree -r --no-commit-id --shortstat ${commitSha.trim()}`) || '';
        const diffMatch = diffStat.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);

        const parsed = parseConventionalCommit(subject);

        const record = {
          schemaVersion: 'commit-ledger.v1',
          recordId: generateRecordId(projectId, commitSha.trim()),
          repo: {
            projectId,
            canonicalPath: repoPath,
            gitRoot: repoPath,
            remote,
            defaultBranch: branch
          },
          commit: {
            sha: commitSha.trim(),
            shortSha: commitSha.trim().substring(0, 12),
            parentShas,
            subject: subject.trim(),
            body: body?.trim().substring(0, 4096) || '',
            type: parsed.type,
            scope: parsed.scope,
            breaking: parsed.breaking,
            authoredAt: authoredAt?.trim(),
            committedAt: committedAt?.trim()
          },
          actor: {
            name: authorName?.trim() || 'unknown',
            email: authorEmail?.trim() || null
          },
          refs: { branches: [], tags: [] },
          diff: {
            filesChanged: diffMatch ? parseInt(diffMatch[1]) || 0 : 0,
            insertions: diffMatch ? parseInt(diffMatch[2]) || 0 : 0,
            deletions: diffMatch ? parseInt(diffMatch[3]) || 0 : 0
          },
          trailers: parseTrailers(body),
          workspaceState: {
            observedBranch: branch,
            isDirty,
            ahead: 0,
            behind: 0,
            observedAt: new Date().toISOString()
          },
          verification: {
            status: 'unverified',
            commands: [],
            evidenceRefs: [],
            observedAt: new Date().toISOString()
          },
          provenance: {
            source: 'git',
            sourcePath: repoPath,
            sourceCommand: 'git log + git show',
            sourceHash: commitSha.trim(),
            observedAt: new Date().toISOString()
          },
          ingestion: {
            idempotencyKey: `${projectId}:${commitSha.trim()}`,
            firstSeenAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            status: 'new'
          }
        };

        records.push(record);
      } catch (e) {
        errors.push({ sha: sha.trim(), error: e.message });
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
      ...(errors.length > 0 ? { errors } : {})
    };

  } catch (e) {
    return { error: 'exception', projectId, message: e.message };
  }
}

/**
 * 采集所有仓库
 */
export function collectAll(options = {}) {
  const results = [];
  const errors = [];

  let reposToCollect = CANONICAL_REPOS;
  if (options.repo) {
    reposToCollect = CANONICAL_REPOS.filter(r => r.projectId === options.repo);
    if (reposToCollect.length === 0) {
      errors.push({ error: 'unknown-repo', projectId: options.repo });
    }
  }

  for (const repo of reposToCollect) {
    const result = collectRepoCommits(repo, options);
    if (result.error) {
      errors.push(result);
    } else {
      results.push(result);
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
export function outputJsonl(records, outputPath) {
  const payload = records.map((record) => JSON.stringify(record)).join('\n');
  if (!outputPath) {
    process.stdout.write(payload + (payload ? '\n' : ''));
    return;
  }
  fs.writeFileSync(outputPath, payload + (payload ? '\n' : ''), 'utf8');
}

// 主入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since' && args[i + 1]) {
      options.since = args[++i];
    } else if (args[i] === '--until' && args[i + 1]) {
      options.until = args[++i];
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (args[i] === '--repo' && args[i + 1]) {
      options.repo = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[++i];
    }
  }

  const output = collectAll(options);

  if (output.errors.length > 0) {
    console.error('[Errors]');
    for (const err of output.errors) {
      console.error(`  ${err.projectId}: ${err.error}`);
    }
  }

  if (options.output) {
    fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
    console.log(`Written to ${options.output}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }

  if (output.errors.some(err => err.error === 'unknown-repo')) {
    process.exit(1);
  }
}
