/**
 * Commit Ledger Git Collector
 * 采集 Axi 工作区所有 canonical Git 项目的提交日志
 *
 * Usage: node collect-all.mjs [--since <ISO-date>] [--repo <projectId>] [--output <file>]
 */

import { createHash } from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Canonical 仓库列表 - 从 workspace-project 获取
const CANONICAL_REPOS = [
  // projects 分区
  { projectId: 'axi-agent-platform', partition: 'projects' },
  { projectId: 'axi-docs', partition: 'projects' },
  { projectId: 'axi-image-preview', partition: 'projects' },
  { projectId: 'axi-notify', partition: 'projects' },
  { projectId: 'axi-pet', partition: 'projects' },
  { projectId: 'axi-pet-desktop', partition: 'projects' },
  { projectId: 'axi-rules', partition: 'projects' },
  { projectId: 'axi-sports-management-app', partition: 'projects' },
  { projectId: 'axi-workbench', partition: 'projects' },
  // products 分区
  { projectId: 'ai-resource-orchestration', partition: 'products' },
  { projectId: 'axi-artboard', partition: 'products' },
  { projectId: 'axi-soul-world', partition: 'products' },
  { projectId: 'ielts-vocab', partition: 'products' },
  { projectId: 'story-graph', partition: 'products' },
  // shared 分区
  { projectId: 'axi-skills', partition: 'shared' },
  { projectId: 'axi-tauri-starter', partition: 'shared' },
  { projectId: 'axi-ui', partition: 'shared' },
  // infra 分区
  { projectId: 'axi-registry', partition: 'infra' },
  { projectId: 'axi-workspace-governance', partition: 'infra' },
  // tools 分区
  { projectId: 'axi-feishu-codex-bridge', partition: 'tools' },
  { projectId: 'axi-proxy-companion', partition: 'tools' },
  { projectId: 'axi-video-downloader', partition: 'tools' },
];

// 路径映射
const PATH_MAP = {
  'axi-agent-platform': '/Volumes/code/workspace/projects/axi-agent-platform',
  'axi-docs': '/Volumes/code/workspace/projects/axi-docs',
  'axi-image-preview': '/Volumes/code/workspace/projects/axi-image-preview',
  'axi-notify': '/Volumes/code/workspace/projects/axi-notify',
  'axi-pet': '/Volumes/code/workspace/projects/axi-pet',
  'axi-pet-desktop': '/Volumes/code/workspace/projects/axi-pet-desktop',
  'axi-rules': '/Volumes/code/workspace/projects/axi-rules',
  'axi-sports-management-app': '/Volumes/code/workspace/projects/axi-sports-management-app',
  'axi-workbench': '/Volumes/code/workspace/projects/axi-workbench',
  'ai-resource-orchestration': '/Volumes/code/workspace/products/ai-resource-orchestration',
  'axi-artboard': '/Volumes/code/workspace/products/axi-artboard',
  'axi-soul-world': '/Volumes/code/workspace/products/axi-soul-world',
  'ielts-vocab': '/Volumes/code/workspace/products/ielts-vocab',
  'story-graph': '/Volumes/code/workspace/products/story-graph',
  'axi-skills': '/Volumes/code/workspace/shared/axi-skills',
  'axi-tauri-starter': '/Volumes/code/workspace/shared/axi-tauri-starter',
  'axi-ui': '/Volumes/code/workspace/shared/axi-ui',
  'axi-registry': '/Volumes/code/workspace/infra/axi-registry',
  'axi-workspace-governance': '/Volumes/code/workspace/infra/axi-workspace-governance',
  'axi-feishu-codex-bridge': '/Volumes/code/workspace/tools/axi-feishu-codex-bridge',
  'axi-proxy-companion': '/Volumes/code/workspace/tools/axi-proxy-companion',
  'axi-video-downloader': '/Volumes/code/workspace/tools/axi-video-downloader',
};

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
 * 采集单个仓库的提交
 */
export function collectRepoCommits(repoConfig, options = {}) {
  const { projectId, partition } = repoConfig;
  const repoPath = PATH_MAP[projectId];

  if (!repoPath) {
    return { error: 'unknown-path', projectId };
  }

  if (!fs.existsSync(repoPath)) {
    return { error: 'not-found', projectId, path: repoPath };
  }

  if (!fs.existsSync(`${repoPath}/.git`)) {
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
    const shaList = git(repoPath, 'git log --all --format="%H" -n 500')?.trim()?.split('\n') || [];
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

        // 解析 body 中的 trailers
        const testedMatch = body?.match(/^Tested:(.+)$/gm);
        const notTestedMatch = body?.match(/^Not-tested:(.+)$/gm);
        const confidenceMatch = body?.match(/^Confidence:(.+)$/gm);
        const scopeRiskMatch = body?.match(/^Scope-risk:(.+)$/gm);
        const directiveMatch = body?.match(/^Directive:(.+)$/gm);

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
          trailers: {
            tested: testedMatch?.map(m => m.replace(/^Tested:/, '').trim()) || [],
            notTested: notTestedMatch?.map(m => m.replace(/^Not-tested:/, '').trim()) || [],
            confidence: confidenceMatch ? parseFloat(confidenceMatch[0].replace(/^Confidence:/, '').trim()) : null,
            scopeRisk: scopeRiskMatch?.[0]?.replace(/^Scope-risk:/, '').trim() || null,
            directive: directiveMatch?.[0]?.replace(/^Directive:/, '').trim() || null,
            refs: []
          },
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
      count: records.length
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

  for (const repo of CANONICAL_REPOS) {
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
      totalRepos: CANONICAL_REPOS.length,
      successfulRepos: results.length,
      failedRepos: errors.length,
      totalCommits: results.reduce((sum, r) => sum + r.count, 0)
    },
    collectedAt: new Date().toISOString()
  };
}

// 主入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since' && args[i + 1]) {
      options.since = args[++i];
    }
    if (args[i] === '--repo' && args[i + 1]) {
      options.repo = args[++i];
    }
    if (args[i] === '--output' && args[i + 1]) {
      options.output = args[++i];
    }
  }

  const output = collectAll(options);

  if (options.output) {
    fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
    console.log(`Written to ${options.output}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}
