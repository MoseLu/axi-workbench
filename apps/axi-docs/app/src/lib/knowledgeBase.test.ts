import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { classifyKnowledgeCategories } from '../config/knowledgeRules'
import { getDocumentSourceRegistry, validateDocumentSourceRegistry } from '../config/documentSources'
import {
  __clearKnowledgeBaseCacheForTests,
  getProjectSummary,
  getKnowledgeCatalog,
  getKnowledgeDocuments,
  listKnowledgeSources,
  readKnowledgeFile,
  searchKnowledge,
  searchKnowledgeAll,
} from './knowledgeBase'

describe('knowledge classification rules', () => {
  it('prefers explicit frontmatter categories over heuristics', () => {
    const categories = classifyKnowledgeCategories({
      path: 'notes/button.md',
      title: 'Button Design System',
      description: 'React component usage guide',
      docType: 'component',
      tags: ['react', 'design-system'],
      techStack: ['react', 'typescript'],
      frontmatter: {
        category: 'frontend,components',
      },
    })

    expect(categories).toEqual(['frontend', 'components'])
  })

  it('can derive categories from tags and path conventions', () => {
    const categories = classifyKnowledgeCategories({
      path: 'frontend/components/button.md',
      title: 'Button',
      description: 'Reusable UI component',
      docType: 'component',
      tags: ['react', 'component'],
      techStack: ['react'],
      frontmatter: {},
    })

    expect(categories).toContain('frontend')
    expect(categories).toContain('components')
  })
})

describe('knowledge base local index', () => {
  const originalObsidianPath = process.env.OBSIDIAN_PATH
  const originalExtraSources = process.env.AXI_DOCS_EXTRA_SOURCES_JSON
  const originalAxiSkillsPath = process.env.AXI_SKILLS_PATH
  const originalDbskillPath = process.env.DBSKILL_PATH
  const originalDbskillEnabled = process.env.DBSKILL_CONTENT_ASSETS_ENABLED
  const originalWorkspaceGovernancePath = process.env.AXI_WORKSPACE_GOVERNANCE_PATH
  let tempDir = ''

  afterEach(async () => {
    __clearKnowledgeBaseCacheForTests()
    if (originalObsidianPath === undefined) {
      delete process.env.OBSIDIAN_PATH
    } else {
      process.env.OBSIDIAN_PATH = originalObsidianPath
    }
    if (originalExtraSources === undefined) {
      delete process.env.AXI_DOCS_EXTRA_SOURCES_JSON
    } else {
      process.env.AXI_DOCS_EXTRA_SOURCES_JSON = originalExtraSources
    }
    if (originalAxiSkillsPath === undefined) {
      delete process.env.AXI_SKILLS_PATH
    } else {
      process.env.AXI_SKILLS_PATH = originalAxiSkillsPath
    }
    if (originalDbskillPath === undefined) {
      delete process.env.DBSKILL_PATH
    } else {
      process.env.DBSKILL_PATH = originalDbskillPath
    }
    if (originalDbskillEnabled === undefined) {
      delete process.env.DBSKILL_CONTENT_ASSETS_ENABLED
    } else {
      process.env.DBSKILL_CONTENT_ASSETS_ENABLED = originalDbskillEnabled
    }
    if (originalWorkspaceGovernancePath === undefined) {
      delete process.env.AXI_WORKSPACE_GOVERNANCE_PATH
    } else {
      process.env.AXI_WORKSPACE_GOVERNANCE_PATH = originalWorkspaceGovernancePath
    }
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
      tempDir = ''
    }
  })

  it('reindexes changed markdown files when the file timestamp changes', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-kb-'))
    process.env.OBSIDIAN_PATH = tempDir

    const filePath = path.join(tempDir, 'playbook.md')

    await fs.promises.writeFile(filePath, [
      '---',
      'id: concept-button-playbook',
      'title: Button Playbook',
      'tags: [react, component]',
      'type: component',
      'status: draft',
      'created: 2026-03-25',
      'modified: 2026-03-25',
      'graph-title: 按钮手册',
      'graph-tags: [前端, 组件]',
      '---',
      '# Button Playbook',
      '',
      'Initial design system note',
    ].join('\n'), 'utf-8')

    const initialResults = await searchKnowledge('obsidian', 'button')
    expect(initialResults.some((result) => result.path === 'playbook.md')).toBe(true)

    const initialCatalog = await getKnowledgeCatalog('obsidian')
    expect(initialCatalog.sections.some((section) => section.key === 'components')).toBe(true)

    await new Promise(resolve => setTimeout(resolve, 30))

    await fs.promises.writeFile(filePath, [
      '---',
      'id: solution-cache-recovery-playbook',
      'title: Cache Recovery Playbook',
      'category: solutions',
      'tags: [incident, fix]',
      'type: troubleshooting',
      'status: evergreen',
      'created: 2026-03-25',
      'modified: 2026-03-26',
      'graph-title: 缓存恢复手册',
      'graph-tags: [排障, 缓存]',
      '---',
      '# Cache Recovery Playbook',
      '',
      'How to fix cache invalidation issues fast',
    ].join('\n'), 'utf-8')

    const updatedResults = await searchKnowledge('obsidian', 'cache invalidation')
    expect(updatedResults.some((result) => result.path === 'playbook.md')).toBe(true)

    const updatedCatalog = await getKnowledgeCatalog('obsidian')
    const solutionsSection = updatedCatalog.sections.find((section) => section.key === 'solutions')
    expect(solutionsSection?.items.some((item) => item.path === 'playbook.md')).toBe(true)
  })

  it('uses git commit time as the document last updated value when available', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-kb-git-'))
    process.env.OBSIDIAN_PATH = tempDir

    const committedAt = '2026-04-08T09:10:11+08:00'
    const filePath = path.join(tempDir, 'git-updated.md')
    await fs.promises.writeFile(filePath, [
      '---',
      'id: git-updated',
      'title: Git Updated',
      'tags: [docs, git]',
      'type: concept',
      'status: evergreen',
      'created: 2025-01-01',
      'modified: 2025-01-01',
      'graph-title: Git 更新时间',
      'graph-tags: [文档, Git]',
      '---',
      '# Git Updated',
      '',
      'This document should use the commit timestamp.',
    ].join('\n'), 'utf-8')

    execFileSync('git', ['init'], { cwd: tempDir, stdio: 'ignore' })
    execFileSync('git', ['config', 'user.name', 'Axi Test'], { cwd: tempDir, stdio: 'ignore' })
    execFileSync('git', ['config', 'user.email', 'axi-test@example.com'], { cwd: tempDir, stdio: 'ignore' })
    execFileSync('git', ['add', 'git-updated.md'], { cwd: tempDir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'Add git updated doc'], {
      cwd: tempDir,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: committedAt,
        GIT_COMMITTER_DATE: committedAt,
      },
      stdio: 'ignore',
    })

    const documents = await getKnowledgeDocuments('obsidian')
    const item = documents.find((entry) => entry.path === 'git-updated.md')
    expect(item?.updated).toBe('2026-04-08T09:10:11+08:00')
  })

  it('admits documents with standard frontmatter even when graph metadata is omitted', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-kb-fallback-'))
    process.env.OBSIDIAN_PATH = tempDir

    await fs.promises.writeFile(path.join(tempDir, 'context.md'), [
      '---',
      'id: agent-context',
      'title: Current Context',
      'tags: [vault, context, current]',
      'type: concept',
      'status: evergreen',
      'created: 2026-03-25',
      'modified: 2026-03-25',
      '---',
      '# Current Context',
      '',
      'This note should still be indexed without explicit graph metadata.',
    ].join('\n'), 'utf-8')

    const catalog = await getKnowledgeCatalog('obsidian')
    expect(catalog.totalDocs).toBe(1)
    expect(catalog.recentDocs[0]?.title).toBe('当前上下文')
    expect(catalog.recentDocs[0]?.description).toContain('概念文档')
    expect(catalog.recentDocs[0]?.tags).toEqual(['vault', 'context', 'current'])

    const searchResults = await searchKnowledge('obsidian', 'current context')
    expect(searchResults.some((result) => result.path === 'context.md')).toBe(true)
  })

  it('blocks documents from the library when IQC metadata is missing', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-kb-iqc-'))
    process.env.OBSIDIAN_PATH = tempDir

    await fs.promises.writeFile(path.join(tempDir, 'invalid.md'), [
      '# Missing Frontmatter',
      '',
      'This note should never enter the knowledge library.',
    ].join('\n'), 'utf-8')

    const catalog = await getKnowledgeCatalog('obsidian')
    expect(catalog.totalDocs).toBe(0)

    const searchResults = await searchKnowledge('obsidian', 'missing')
    expect(searchResults).toHaveLength(0)
  })

  it('supports extra local sources from AXI_DOCS_EXTRA_SOURCES_JSON', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-kb-extra-'))
    const extraDir = path.join(tempDir, 'hermes-system')
    await fs.promises.mkdir(extraDir, { recursive: true })

    process.env.OBSIDIAN_PATH = path.join(tempDir, 'primary')
    process.env.AXI_DOCS_EXTRA_SOURCES_JSON = JSON.stringify([
      {
        id: 'hermes-system',
        name: 'Hermes System',
        path: extraDir,
        type: 'local',
        enabled: true,
      },
    ])

    await fs.promises.mkdir(process.env.OBSIDIAN_PATH, { recursive: true })
    const sources = listKnowledgeSources()
    const hermesSource = sources.find((source) => source.id === 'hermes-system')
    expect(hermesSource).toBeDefined()
    expect(hermesSource?.path).toBe(extraDir)
    expect(hermesSource?.type).toBe('local')
  })

  it('validates the document source registry shape', () => {
    const registry = getDocumentSourceRegistry()
    expect(validateDocumentSourceRegistry(registry)).toEqual([])
    const dbskillSource = registry.find((source) => source.id === 'dbskill')
    expect(dbskillSource?.skillNames).toBeUndefined()
    expect(dbskillSource?.includeSkillAssets).toBe(true)
    expect(dbskillSource?.includeSupportDocs).toBe(true)
    expect(dbskillSource?.organizationHint).toBe('dbskill')
    expect(validateDocumentSourceRegistry([
      { id: 'dup', adapter: 'markdown', enabled: true },
      { id: 'dup', adapter: 'skills', enabled: true },
      { id: 'bad', adapter: 'unknown' as never, enabled: true },
    ])).toContain('duplicate source id: dup')
  })

  it('exposes the localized axi-skills-zh source alongside the English axi-skills source', () => {
    const registry = getDocumentSourceRegistry()
    const enSource = registry.find((source) => source.id === 'axi-skills')
    const zhSource = registry.find((source) => source.id === 'axi-skills-zh')
    expect(enSource).toBeDefined()
    expect(zhSource).toBeDefined()
    expect(enSource?.skillRoot).toBe('skills')
    expect(enSource?.locale).toBe('en')
    expect(zhSource?.skillRoot).toBe('skills.zh')
    expect(zhSource?.locale).toBe('zh')
    expect(enSource?.path).toBe(zhSource?.path)
  })

  it('exposes locale-specific Axi Docs content roots for translation work', () => {
    const registry = getDocumentSourceRegistry()
    const enSource = registry.find((source) => source.id === 'axi-docs-en')
    const zhSource = registry.find((source) => source.id === 'axi-docs-zh')

    expect(enSource).toBeDefined()
    expect(zhSource).toBeDefined()
    expect(enSource?.adapter).toBe('markdown')
    expect(zhSource?.adapter).toBe('markdown')
    expect(enSource?.locale).toBe('en')
    expect(zhSource?.locale).toBe('zh')
    expect(enSource?.path.endsWith(path.join('docs', 'content', 'en'))).toBe(true)
    expect(zhSource?.path.endsWith(path.join('docs', 'content', 'zh'))).toBe(true)
  })

  it('reads Chinese skills from a localized skills.zh mirror without silent English fallback', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-skills-zh-'))
    const englishRoot = path.join(tempDir, 'skills', 'frontend-dev')
    const chineseRoot = path.join(tempDir, 'skills.zh', 'frontend-dev')
    await fs.promises.mkdir(englishRoot, { recursive: true })
    await fs.promises.mkdir(chineseRoot, { recursive: true })

    await fs.promises.writeFile(path.join(englishRoot, 'SKILL.md'), [
      '---',
      'name: frontend-dev',
      'description: Build frontend features.',
      '---',
      '# Frontend Dev',
    ].join('\n'), 'utf-8')
    await fs.promises.writeFile(path.join(chineseRoot, 'SKILL.md'), [
      '---',
      'name: frontend-dev',
      'title: 前端开发',
      'description: 构建前端功能。',
      '---',
      '# 前端开发',
    ].join('\n'), 'utf-8')

    process.env.AXI_SKILLS_PATH = tempDir

    const enDocs = await getKnowledgeDocuments('axi-skills')
    const zhDocs = await getKnowledgeDocuments('axi-skills-zh')
    expect(enDocs.some((doc) => doc.path === 'skills/frontend-dev/SKILL.md')).toBe(true)
    expect(enDocs.some((doc) => doc.path === 'skills.zh/frontend-dev/SKILL.md')).toBe(false)
    expect(zhDocs.some((doc) => doc.path === 'skills.zh/frontend-dev/SKILL.md')).toBe(true)
    expect(zhDocs.some((doc) => doc.path === 'skills/frontend-dev/SKILL.md')).toBe(false)
    expect(zhDocs.find((doc) => doc.path === 'skills.zh/frontend-dev/SKILL.md')?.description)
      .toContain('构建前端功能')
    expect(zhDocs.find((doc) => doc.path === 'skills.zh/frontend-dev/SKILL.md')?.title)
      .toBe('前端开发')
    expect(enDocs.find((doc) => doc.path === 'skills/frontend-dev/SKILL.md')?.description)
      .toContain('Build frontend features')
  })

  it('keeps localized skill titles from loose CRLF frontmatter', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-skills-zh-loose-'))
    const chineseRoot = path.join(tempDir, 'skills.zh', 'blueprint')
    await fs.promises.mkdir(chineseRoot, { recursive: true })

    await fs.promises.writeFile(path.join(chineseRoot, 'SKILL.md'), [
      '---',
      '',
      'name: blueprint',
      'title: "Blueprint 指南"',
      'description: 将单行目标转化为多会话计划。',
      '---',
      '',
      '# /blueprint',
    ].join('\r\n'), 'utf-8')

    process.env.AXI_SKILLS_PATH = tempDir

    const zhDocs = await getKnowledgeDocuments('axi-skills-zh')
    const blueprint = zhDocs.find((doc) => doc.path === 'skills.zh/blueprint/SKILL.md')

    expect(blueprint?.title).toBe('Blueprint 指南')
    expect(blueprint?.description).toContain('将单行目标转化')
  })

  it('honors skillRoot from extra sources when reading a custom skills directory', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-skills-extra-'))
    const customRoot = path.join(tempDir, 'custom', 'skills-x')
    await fs.promises.mkdir(customRoot, { recursive: true })

    process.env.AXI_DOCS_EXTRA_SOURCES_JSON = JSON.stringify([
      {
        id: 'custom-skills',
        name: 'Custom Skills',
        path: tempDir,
        enabled: true,
        type: 'local',
        adapter: 'skills',
        skillRoot: 'custom/skills-x',
      },
    ])

    await fs.promises.writeFile(path.join(customRoot, 'SKILL.md'), [
      '---',
      'name: custom-skill',
      'description: A custom skill that lives in a non-default folder.',
      '---',
      '# Custom Skill',
    ].join('\n'), 'utf-8')

    const documents = await getKnowledgeDocuments('custom-skills')
    expect(documents.some((doc) => doc.path === 'custom/skills-x/SKILL.md')).toBe(true)
  })

  it('indexes Axi Skills SKILL.md files without Obsidian frontmatter', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-skills-'))
    const skillDirs = [
      'deep-init-pro',
      'frontend-dev',
      'google-docs',
      'cloudflare-deploy',
      'gwas-catalog-skill',
      'content-engine',
    ]
    for (const skillName of skillDirs) {
      await fs.promises.mkdir(path.join(tempDir, 'skills', skillName), { recursive: true })
    }
    await fs.promises.mkdir(path.join(tempDir, 'docs'), { recursive: true })
    process.env.AXI_SKILLS_PATH = tempDir

    await fs.promises.writeFile(path.join(tempDir, 'skills', 'deep-init-pro', 'SKILL.md'), [
      '---',
      'name: deep-init-pro',
      'description: Generate layered project docs for agents.',
      '---',
      '# Deep Init Pro',
      '',
      'Use this to create PARADIGM and ARCHITECTURE docs.',
    ].join('\n'), 'utf-8')
    await fs.promises.writeFile(path.join(tempDir, 'skills', 'frontend-dev', 'SKILL.md'), [
      '---',
      'name: frontend-dev',
      'description: Build frontend features.',
      '---',
      '# Frontend Dev',
    ].join('\n'), 'utf-8')
    await fs.promises.writeFile(path.join(tempDir, 'skills', 'google-docs', 'SKILL.md'), [
      '---',
      'name: google-docs',
      'description: Work with Google Docs.',
      '---',
      '# Google Docs',
    ].join('\n'), 'utf-8')
    await fs.promises.writeFile(path.join(tempDir, 'skills', 'cloudflare-deploy', 'SKILL.md'), [
      '---',
      'name: cloudflare-deploy',
      'description: Deploy to Cloudflare.',
      '---',
      '# Cloudflare Deploy',
    ].join('\n'), 'utf-8')
    await fs.promises.writeFile(path.join(tempDir, 'skills', 'gwas-catalog-skill', 'SKILL.md'), [
      '---',
      'name: gwas-catalog-skill',
      'description: Query GWAS Catalog.',
      '---',
      '# GWAS Catalog',
    ].join('\n'), 'utf-8')
    await fs.promises.writeFile(path.join(tempDir, 'skills', 'content-engine', 'SKILL.md'), [
      '---',
      'name: content-engine',
      'description: Build content systems.',
      '---',
      '# Content Engine',
    ].join('\n'), 'utf-8')
    await fs.promises.writeFile(path.join(tempDir, 'docs', 'SKILL_INDEX.md'), [
      '# Skill Index',
      '',
      'Generated truncated table.',
    ].join('\n'), 'utf-8')

    const catalog = await getKnowledgeCatalog('axi-skills')
    expect(catalog.totalDocs).toBe(7)
    expect(catalog.sections[0]?.key).toBe('skill-support-docs')
    expect(catalog.sections[0]?.title).toBe('技能库附属文档')
    expect(catalog.sections.find((section) => section.key === 'agent-planning')?.count).toBe(1)
    expect(catalog.sections.find((section) => section.key === 'frontend-ui')?.count).toBe(1)
    expect(catalog.sections.find((section) => section.key === 'google-workspace')?.count).toBe(1)
    expect(catalog.sections.find((section) => section.key === 'cloud-deployment')?.count).toBe(1)
    expect(catalog.sections.find((section) => section.key === 'bio-health-research')?.count).toBe(1)
    expect(catalog.sections.find((section) => section.key === 'design-content')?.count).toBe(1)

    const results = await searchKnowledge('axi-skills', 'deep-init-pro')
    expect(results[0]?.path).toBe('skills/deep-init-pro/SKILL.md')
    expect(results[0]?.title).toContain('技能')
    expect(results[0]?.description).toContain('技能用途')
    expect(results[0]?.description).toContain('Generate layered project docs for agents')

    const allResults = await searchKnowledgeAll('deep-init-pro')
    expect(allResults.some((result) => result.sourceId === 'axi-skills')).toBe(true)

    const raw = await readKnowledgeFile('axi-skills', 'skills/deep-init-pro/SKILL.md')
    expect(raw).toContain('name: deep-init-pro')
    const indexRaw = await readKnowledgeFile('axi-skills', 'docs/SKILL_INDEX.md')
    expect(indexRaw).toContain('## 能力分组')
    expect(indexRaw).toContain('## Agent 规划与需求')
    expect(indexRaw).toContain('## 前端界面与组件')
    expect(indexRaw).toContain('`skills/frontend-dev/SKILL.md`')

    const staticDocuments = await getKnowledgeDocuments('axi-skills')
    const staticDeepInit = staticDocuments.find((document) => document.path === 'skills/deep-init-pro/SKILL.md')
    expect(staticDeepInit?.content).toContain('# Deep Init Pro')
    expect(staticDeepInit?.content).toContain('Use this to create PARADIGM and ARCHITECTURE docs.')
    expect(staticDeepInit?.content).not.toContain('Source path:')
    expect(staticDeepInit?.content).not.toContain('## Excerpt')
  }, 30000)

  it('indexes dbskill as a full organized skill library', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-dbskill-'))
    process.env.DBSKILL_PATH = tempDir

    const contentSystemDir = path.join(tempDir, 'skills', 'dbs-content-system')
    const diagnosisDir = path.join(tempDir, 'skills', 'dbs-diagnosis')
    await fs.promises.mkdir(contentSystemDir, { recursive: true })
    await fs.promises.mkdir(diagnosisDir, { recursive: true })

    await fs.promises.writeFile(path.join(contentSystemDir, 'SKILL.md'), [
      '---',
      'name: dbs-content-system',
      'description: 把本地大量文稿搭成可持续生长的内容结构化工程。',
      '---',
      '# dbs-content-system',
      '',
      '先审计内容规模与边界，再建立可重组的内容资产工程。',
    ].join('\n'), 'utf-8')
    await fs.promises.mkdir(path.join(contentSystemDir, 'templates'), { recursive: true })
    await fs.promises.writeFile(path.join(contentSystemDir, 'templates', '主题地图模板.md'), [
      '# 主题地图模板',
      '',
      '用于把内容单元装配成主题地图。',
    ].join('\n'), 'utf-8')

    await fs.promises.writeFile(path.join(diagnosisDir, 'SKILL.md'), [
      '---',
      'name: dbs-diagnosis',
      'description: 商业模式诊断。',
      '---',
      '# dbs-diagnosis',
    ].join('\n'), 'utf-8')

    await fs.promises.writeFile(path.join(tempDir, 'README.md'), [
      '# dbskill',
      '',
      'dontbesilent 商业诊断工具箱。',
    ].join('\n'), 'utf-8')

    const catalog = await getKnowledgeCatalog('dbskill')
    expect(catalog.totalDocs).toBe(4)
    expect(catalog.recentDocs.some((doc) => doc.path === 'skills/dbs-content-system/SKILL.md')).toBe(true)
    expect(catalog.recentDocs.some((doc) => doc.path === 'skills/dbs-content-system/templates/主题地图模板.md')).toBe(true)
    expect(catalog.recentDocs.some((doc) => doc.path === 'skills/dbs-diagnosis/SKILL.md')).toBe(true)
    expect(catalog.sections.some((section) => section.key === 'dbskill-content-engineering')).toBe(true)
    expect(catalog.sections.some((section) => section.key === 'dbskill-diagnosis')).toBe(true)
    expect(catalog.sections.some((section) => section.key === 'skill-support-docs')).toBe(true)

    const contentResults = await searchKnowledge('dbskill', '内容资产')
    expect(contentResults.some((result) => result.path === 'skills/dbs-content-system/SKILL.md')).toBe(true)
    const templateResults = await searchKnowledge('dbskill', '主题地图')
    expect(templateResults.some((result) => result.path === 'skills/dbs-content-system/templates/主题地图模板.md')).toBe(true)

    const diagnosisResults = await searchKnowledge('dbskill', '商业模式诊断')
    expect(diagnosisResults.some((result) => result.path === 'skills/dbs-diagnosis/SKILL.md')).toBe(true)
  })

  it('handles missing skill descriptions and nested skill paths', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-skills-nested-'))
    const nestedSkillDir = path.join(tempDir, 'skills', 'vendor', 'nested-skill')
    await fs.promises.mkdir(nestedSkillDir, { recursive: true })
    process.env.AXI_SKILLS_PATH = tempDir

    await fs.promises.writeFile(path.join(nestedSkillDir, 'SKILL.md'), [
      '---',
      'name: nested-skill',
      '---',
      '# Nested Skill',
      '',
      'A nested skill entrypoint.',
    ].join('\n'), 'utf-8')

    const results = await searchKnowledge('axi-skills', 'nested skill')
    expect(results.some((result) => result.path === 'skills/vendor/nested-skill/SKILL.md')).toBe(true)
    expect(results[0]?.description).toBeTruthy()
  })

  it('indexes workspace project status from WORKSPACE_INDEX.md', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'axi-docs-workspace-'))
    const workspaceRoot = tempDir
    const governanceRoot = path.join(workspaceRoot, 'infra', 'axi-workspace-governance')
    const projectRoot = path.join(workspaceRoot, 'projects', 'axi-docs')
    await fs.promises.mkdir(path.join(governanceRoot, 'docs'), { recursive: true })
    await fs.promises.mkdir(projectRoot, { recursive: true })
    await fs.promises.mkdir(path.join(workspaceRoot, 'shared', 'axi-skills'), { recursive: true })
    process.env.AXI_WORKSPACE_GOVERNANCE_PATH = governanceRoot

    await fs.promises.writeFile(path.join(projectRoot, 'README.md'), [
      '# Axi Docs',
      '',
      '用途：Axi 文档中心，用于浏览多源文档、查看知识图谱并通过 MCP 提供文档访问。',
      '技术栈：React, TypeScript',
      '验证：pnpm --dir app verify',
    ].join('\n'), 'utf-8')
    await fs.promises.writeFile(path.join(projectRoot, 'PRD.md'), '# Axi Docs PRD\n\nREQ-DOC-001\n', 'utf-8')
    await fs.promises.writeFile(path.join(projectRoot, 'TDD.md'), '# Axi Docs TDD\n\nReact, TypeScript\n', 'utf-8')
    await fs.promises.writeFile(path.join(projectRoot, 'AGENTS.md'), '# Axi Docs Agent Guide\n\nTODO.md\n', 'utf-8')
    await fs.promises.writeFile(path.join(projectRoot, 'TODO.md'), '# Axi Docs TODO\n\nREQ-DOC-001\n', 'utf-8')
    await fs.promises.writeFile(path.join(projectRoot, 'MILESTONE.md'), '# Axi Docs Milestone\n\nMilestone\n', 'utf-8')
    await fs.promises.writeFile(path.join(projectRoot, 'CHANGELOG.md'), '# Axi Docs Changelog\n\nChanged\n', 'utf-8')
    await fs.promises.writeFile(path.join(projectRoot, 'INDEX.md'), '# Axi Docs Index\n\nPRD / TDD\n', 'utf-8')

    await fs.promises.writeFile(path.join(workspaceRoot, 'WORKSPACE_INDEX.md'), [
      '# Workspace Index',
      '',
      '| Project | Path | Purpose | Stack | Status | Authoritative docs | Common verification | Notes |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      `| Axi Docs | \`${projectRoot}\` | Documentation hub | React, TypeScript | active | \`TODO.md\` | \`pnpm --dir app verify\` | Canonical docs project |`,
    ].join('\n'), 'utf-8')

    await fs.promises.writeFile(path.join(governanceRoot, 'docs', 'project-catalog.md'), '# Catalog\n', 'utf-8')

    const catalog = await getKnowledgeCatalog('workspace')
    expect(catalog.totalDocs).toBeGreaterThanOrEqual(5)

    const overviewSection = catalog.sections.find((section) => section.key === 'workspace-overview')
    const prdSection = catalog.sections.find((section) => section.key === 'workspace-requirements')
    const tddSection = catalog.sections.find((section) => section.key === 'workspace-technical-design')
    const agentSection = catalog.sections.find((section) => section.key === 'workspace-agent-guides')
    expect(catalog.sections.map((section) => section.title)).toEqual(expect.arrayContaining([
      '项目入口',
      '需求文档',
      '技术设计',
      '智能体指南',
      '任务清单',
      '里程碑',
      '变更记录',
      '文档索引',
    ]))
    expect(catalog.sections.map((section) => section.title)).not.toEqual(expect.arrayContaining([
      '需求文档 PRD',
      '技术设计 TDD',
      'Agent 指南',
      '任务清单 TODO',
    ]))
    expect(catalog.sections.some((section) => section.title === '项目知识')).toBe(false)
    expect(catalog.sections.some((section) => section.title === '架构决策')).toBe(false)
    expect(overviewSection?.items.some((item) => item.path === 'project-docs/axi-docs/README.md')).toBe(true)
    expect(prdSection?.items.some((item) => item.path === 'project-docs/axi-docs/PRD.md')).toBe(true)
    expect(tddSection?.items.some((item) => item.path === 'project-docs/axi-docs/TDD.md')).toBe(true)
    expect(agentSection?.subsections?.[0]?.title).toBe('Axi Docs')

    const summary = await getProjectSummary('axi-docs')
    expect(summary?.title).toBe('Axi 文档站')
    expect(summary?.description).toContain('用途：Axi 文档中心')
    expect(summary?.description).toContain('技术栈：React, TypeScript')
    expect(summary?.description).toContain('验证：pnpm dir app verify')

    const projectDocument = await readKnowledgeFile('workspace', 'project-docs/axi-docs/README.md')
    const projectBody = projectDocument?.replace(/^---[\s\S]*?---\s*/u, '') || ''
    expect(projectDocument).toContain('# Axi Docs')
    expect(projectBody).not.toContain('Path:')
    expect(projectBody).not.toContain(projectRoot)

    const architectureDocument = await readKnowledgeFile('workspace', 'project-docs/axi-docs/TDD.md')
    expect(architectureDocument).toContain('# Axi Docs TDD')
    expect(architectureDocument).toContain('React, TypeScript')

    const operationsDocument = await readKnowledgeFile('workspace', 'project-docs/axi-docs/TODO.md')
    expect(operationsDocument).toContain('# Axi Docs TODO')
    expect(operationsDocument).toContain('REQ-DOC-001')

    const standardsDocument = await readKnowledgeFile('workspace', 'project-docs/axi-docs/AGENTS.md')
    expect(standardsDocument).toContain('# Axi Docs Agent Guide')
    expect(standardsDocument).toContain('TODO.md')

    const axiSkillsDocument = await readKnowledgeFile('workspace', 'projects/axi-skills.md')
    expect(axiSkillsDocument).toContain('# Axi 技能库')
    expect(axiSkillsDocument).toContain('Axi 智能体共享技能树')
    expect(axiSkillsDocument).not.toContain('Shared version-controlled skill tree')
  })
})
