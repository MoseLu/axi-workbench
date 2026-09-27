import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { prepareDocumentDisplayMarkdown } from '../lib/documentDisplay'
import { DocumentView } from './DocumentView'
import type { DocSource, SelectedFile } from '../types'

const skillSource: DocSource = {
  id: 'axi-skills-zh',
  name: 'Axi Skills · 中文镜像',
  description: 'Axi Skills 中文镜像',
  path: '/skills',
  enabled: true,
  type: 'local',
  kind: 'skill-library',
  adapter: 'skills',
  skillRoot: 'skills.zh',
  locale: 'zh',
}

const selectedFile: SelectedFile = {
  sourceId: 'axi-skills-zh',
  path: 'skills.zh/worker/SKILL.md',
}

const englishSkillSource: DocSource = {
  ...skillSource,
  id: 'axi-skills',
  name: 'Axi Skills',
  skillRoot: 'skills',
  locale: 'en',
}

const workspaceSource: DocSource = {
  id: 'workspace',
  name: 'Axi Workspace',
  description: '工作区项目索引',
  path: '/workspace',
  enabled: true,
  type: 'local',
  kind: 'workspace-registry',
  adapter: 'workspace',
}

describe('DocumentView', () => {
  it('keeps skill document headers focused on the title and description', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: Worker 协作协议
description: 基于 tmux 的 OMX 团队 worker 协议
type: skill
modified: 2026-06-07
tech: tmux
domain: Agent
---
# Worker 技能

正文内容`}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={selectedFile}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const header = container.querySelector('.doc-header')
    expect(header).not.toBeNull()

    const skillHeader = within(header as HTMLElement)
    expect(skillHeader.getByRole('heading', { name: 'Worker 协作协议' })).toBeInTheDocument()
    expect(skillHeader.getByText('基于 tmux 的 OMX 团队 worker 协议')).toBeInTheDocument()
    expect(skillHeader.queryByText('Axi Skills · 中文镜像')).not.toBeInTheDocument()
    expect(skillHeader.queryByText('skills.zh')).not.toBeInTheDocument()
    expect(skillHeader.queryByText('worker')).not.toBeInTheDocument()
    expect(skillHeader.queryByText('skill')).not.toBeInTheDocument()
    expect(skillHeader.queryByText('2026年6月7日')).not.toBeInTheDocument()
    expect(skillHeader.queryByText('tmux')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Worker 技能' })).toBeInTheDocument()
  })

  it('uses the same clean header for every skill-library document even without explicit skill type', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: Formatter 结构
description: 检查技能文档渲染结构
modified: 2026-06-07
---
# Formatter

正文内容`}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={{
            sourceId: 'dbskill',
            path: 'skills/formatter/SKILL.md',
          }}
          showKnowledgePanel={false}
          source={{
            ...skillSource,
            id: 'dbskill',
            name: 'dbskill',
            skillRoot: 'skills',
          }}
        />
      </MemoryRouter>,
    )

    const header = container.querySelector('.doc-header')
    expect(header).not.toBeNull()

    const skillHeader = within(header as HTMLElement)
    expect(skillHeader.getByRole('heading', { name: 'Formatter 结构' })).toBeInTheDocument()
    expect(skillHeader.getByText('检查技能文档渲染结构')).toBeInTheDocument()
    expect(skillHeader.queryByText('dbskill')).not.toBeInTheDocument()
    expect(skillHeader.queryByText('skills')).not.toBeInTheDocument()
    expect(skillHeader.queryByText('formatter')).not.toBeInTheDocument()
    expect(skillHeader.queryByText('2026年6月7日')).not.toBeInTheDocument()
  })

  it('keeps workspace registry document headers free of path, type, and frontmatter date chrome', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: Axi 技能库
type: project
modified: 2026-06-07
---
# Axi Skills

Path: /Volumes/code/workspace/shared/axi-skills

Shared version-controlled skill tree for Axi agents.`}
          fileName="axi-skills.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={{
            sourceId: 'workspace',
            path: 'projects/axi-skills.md',
          }}
          showKnowledgePanel={false}
          source={workspaceSource}
        />
      </MemoryRouter>,
    )

    const header = container.querySelector('.doc-header')
    expect(header).not.toBeNull()

    const workspaceHeader = within(header as HTMLElement)
    expect(workspaceHeader.getByRole('heading', { name: 'Axi 技能库' })).toBeInTheDocument()
    expect(workspaceHeader.queryByText('Axi Workspace')).not.toBeInTheDocument()
    expect(workspaceHeader.queryByText('projects')).not.toBeInTheDocument()
    expect(workspaceHeader.queryByText('project')).not.toBeInTheDocument()
    expect(workspaceHeader.queryByText('2026年6月7日')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Axi Skills' })).toBeInTheDocument()
  })

  it('renders code blocks with a language label and icon copy control', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: Code Sample
---

\`\`\`json
{
  "name": "axi-docs"
}
\`\`\``}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={selectedFile}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const codeBlock = container.querySelector('.code-block')
    expect(codeBlock).not.toBeNull()
    expect(codeBlock).toHaveClass('language-json')
    expect(within(codeBlock as HTMLElement).getByText('json')).toBeInTheDocument()
    expect(within(codeBlock as HTMLElement).getByRole('button', { name: '复制代码块' })).toBeInTheDocument()
    expect(codeBlock?.querySelector(':scope > .copy-btn.copy')).not.toBeNull()
    expect(codeBlock?.querySelector(':scope > .code-lang.lang')).not.toBeNull()
  })

  it('renders markdown links with VitePress-like internal and external semantics', () => {
    render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: Link Sample
---

[Internal guide](/zh/guide/getting-started)

[External guide](https://vitepress.dev/zh/guide/what-is-vitepress)

[Protocol relative](//example.com/docs)`}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={selectedFile}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const internalLink = screen.getByRole('link', { name: 'Internal guide' })
    const externalLink = screen.getByRole('link', { name: 'External guide' })
    const protocolRelativeLink = screen.getByRole('link', { name: 'Protocol relative' })

    expect(internalLink).toHaveClass('md-link')
    expect(internalLink).not.toHaveClass('md-link--external')
    expect(internalLink).not.toHaveAttribute('target')
    expect(internalLink).not.toHaveAttribute('rel')

    expect(externalLink).toHaveClass('md-link', 'md-link--external')
    expect(externalLink).toHaveAttribute('target', '_blank')
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer')

    expect(protocolRelativeLink).toHaveClass('md-link--external')
    expect(protocolRelativeLink).toHaveAttribute('target', '_blank')
  })

  it('pretty prints valid fenced json before rendering', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: Provider JSON
---

\`\`\`json
{ "models": { "providers": { "claude": { "baseUrl": "https://your-proxy.example.com/v1", "apiKey": "sk-your-proxy-api-key", "api": "anthropic" } } } }
\`\`\``}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={selectedFile}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const code = container.querySelector('.code-block code')
    expect(code?.textContent).toContain('{\n  "models": {')
    expect(code?.textContent).toContain('      "claude": {')
    expect(code?.textContent).toContain('        "api": "anthropic"')
  })

  it('leaves invalid fenced json unchanged', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: Invalid JSON
---

\`\`\`json
{ "models": }
\`\`\``}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={selectedFile}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const code = container.querySelector('.code-block code')
    expect(code?.textContent).toContain('{ "models": }')
  })

  it('keeps highlighted typescript fences as block code', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: TypeScript Sample
---

\`\`\`typescript
import OpenAI from "openai";

const openai = new OpenAI();
\`\`\``}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={selectedFile}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const code = container.querySelector('.code-block code')
    expect(code).not.toHaveClass('inline-code')
    expect(code?.className).toContain('language-typescript')
    expect(code?.textContent).toContain('import OpenAI from "openai";\n\nconst openai = new OpenAI();')
  })

  it('adds readable shell token spans to bash code blocks', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: Bash Sample
---

\`\`\`bash
npx create-turbo@latest
# or add to existing monorepo:
npm install turbo --save-dev
\`\`\``}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={selectedFile}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const code = container.querySelector('.code-block code')
    expect(code).toHaveClass('language-bash')
    expect(code?.querySelector('.shell-command')?.textContent).toBe('npx')
    expect(code?.querySelector('.shell-package')?.textContent).toBe('create-turbo@latest')
    expect(code?.querySelector('.shell-comment')?.textContent).toBe('# or add to existing monorepo:')
    expect(code?.querySelector('.shell-flag')?.textContent).toBe('--save-dev')
    expect(code?.textContent).toContain('npm install turbo --save-dev')
  })

  it('labels unlanguaged multiline fences as text code blocks', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: Plain Tree
---

\`\`\`
├── apps/
│   └── web/
\`\`\``}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={selectedFile}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const codeBlock = container.querySelector('.code-block')
    const code = container.querySelector('.code-block code')
    expect(within(codeBlock as HTMLElement).getByText('text')).toBeInTheDocument()
    expect(codeBlock).toHaveClass('code-block--text')
    expect(code).toHaveClass('language-text')
    expect(code).not.toHaveClass('inline-code')
  })

  it('normalizes plain text language aliases in code block labels', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={`---
title: Plain Text
---

\`\`\`plaintext
plain content
\`\`\``}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={selectedFile}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const codeBlock = container.querySelector('.code-block')
    expect(within(codeBlock as HTMLElement).getByText('text')).toBeInTheDocument()
  })

  it('renders skill cross-reference directives as linked list items', () => {
    render(
      <MemoryRouter>
        <DocumentView
          content={[
            '---',
            'title: Next Forge',
            '---',
            '## 交叉参考',
            '',
            '=> skill: turborepo —— Monorepo 配置、缓存、远程缓存',
            '=> skill: auth —— Clerk 设置、middleware pattern、sign-in / up 流程',
          ].join('\n')}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={{ sourceId: 'axi-skills-zh', path: 'skills.zh/next-forge/SKILL.md' }}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('link', { name: 'turborepo' })).toHaveAttribute(
      'href',
      '/docs/axi-skills-zh/skills.zh/turborepo/SKILL',
    )
    expect(items[0]).toHaveTextContent('Monorepo 配置、缓存、远程缓存')
    expect(within(items[1]).getByRole('link', { name: 'auth' })).toHaveAttribute(
      'href',
      '/docs/axi-skills-zh/skills.zh/auth/SKILL',
    )
  })

  it('removes emoji from document headers, prose, tables, and code blocks', () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={[
            '---',
            'title: Skill Vetter 🔒',
            'description: Review unknown skills 🚨',
            '---',
            '# Body ✅',
            '',
            '| Risk | Verdict |',
            '| --- | --- |',
            '| LOW 🟢 | SAFE ✅ |',
            '',
            '```text',
            'RISK LEVEL: 🔴 HIGH',
            'VERDICT: ❌ DO NOT INSTALL',
            '```',
          ].join('\n')}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={{ sourceId: 'axi-skills-zh', path: 'skills.zh/skill-vetter/SKILL.md' }}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '技能 vetter' })).toBeInTheDocument()
    expect(screen.getByText('Review unknown skills')).toBeInTheDocument()
    expect(container).not.toHaveTextContent('🔒')
    expect(container).not.toHaveTextContent('🚨')
    expect(container).not.toHaveTextContent('✅')
    expect(container).not.toHaveTextContent('🟢')
    expect(container).not.toHaveTextContent('🔴')
    expect(container).not.toHaveTextContent('❌')
  })

  it('hides the preserved English runbook section in Chinese skill documents', () => {
    const content = `---
title: 浏览器游戏架构
description: 中文说明。
---
# 中文用途说明

这是中文说明。

## 英文原始运行说明

# Web Game Foundations

## Overview

Use this skill to establish the architecture.`

    const { container } = render(
      <MemoryRouter>
        <DocumentView
          content={content}
          fileName="SKILL.md"
          loading={false}
          onWikiLink={vi.fn()}
          selectedFile={{ sourceId: 'axi-skills-zh', path: 'skills.zh/web-game-foundations/SKILL.md' }}
          showKnowledgePanel={false}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('这是中文说明。')).toBeInTheDocument()
    expect(container).not.toHaveTextContent('英文原始运行说明')
    expect(container).not.toHaveTextContent('Web Game Foundations')
    expect(container).not.toHaveTextContent('Use this skill to establish the architecture.')
  })

  it('removes localized boilerplate that points to the hidden English section', () => {
    const content = [
      '# 中文用途说明',
      '',
      '阅读时先确认它解决的问题、适合触发的场景，以及下方英文运行说明中的命令、约束和安全边界。',
      '',
      '## 什么时候应该使用',
      '',
      '若任务涉及具体命令、外部服务、凭证、安全限制或运行顺序，应以下方英文原始说明为准。',
      '',
      '## 阅读边界',
      '',
      '中文部分用于帮助文档站用户理解用途；英文部分保留 agent 执行所需的完整细节。',
      '',
      '## 英文原始运行说明',
      '',
      '# Web Game Foundations',
    ].join('\n')

    const display = prepareDocumentDisplayMarkdown(
      content,
      skillSource,
      { sourceId: 'axi-skills-zh', path: 'skills.zh/web-game-foundations/SKILL.md' },
    )

    expect(display).toContain('执行边界和关键约束')
    expect(display).toContain('回到原始技能仓库核对完整执行规范')
    expect(display).not.toContain('下方英文')
    expect(display).not.toContain('阅读边界')
    expect(display).not.toContain('Web Game Foundations')
  })

  it('keeps English runbook content in English skill documents', () => {
    const content = [
      '# Web Game Foundations',
      '',
      '## Overview',
      '',
      'Use this skill to establish the architecture.',
    ].join('\n')

    expect(
      prepareDocumentDisplayMarkdown(
        content,
        englishSkillSource,
        { sourceId: 'axi-skills', path: 'skills/web-game-foundations/SKILL.md' },
      ),
    ).toContain('Use this skill to establish the architecture.')
  })
})
