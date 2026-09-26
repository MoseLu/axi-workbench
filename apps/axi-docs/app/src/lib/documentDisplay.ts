import type { DocSource, SelectedFile } from '../types'
import { buildDocumentRoute } from './routes'

function formatJsonCodeBlock(source: string): string {
  const trimmed = source.trim()
  if (!trimmed) return source

  try {
    return `${JSON.stringify(JSON.parse(trimmed), null, 2)}\n`
  } catch {
    return source
  }
}

function formatStructuredCodeBlocks(markdown: string): string {
  return markdown.replace(/```(json)([^\n`]*)\n([\s\S]*?)```/giu, (_match, lang: string, meta: string, code: string) => {
    return `\`\`\`${lang}${meta}\n${formatJsonCodeBlock(code)}\`\`\``
  })
}

export function stripDisplayEmoji(markdown: string): string {
  return markdown
    .replace(/[\u{1f000}-\u{1faff}\u{1fc00}-\u{1ffff}]/gu, '')
    .replace(/[\u2600-\u27bf]\ufe0f?/gu, '')
    .replace(/[\ufe0f\u200d]/gu, '')
    .replace(/[ \t]+$/gmu, '')
}

function skillDocumentRoute(skillName: string, source?: DocSource): string | null {
  if (!source?.id || source.kind !== 'skill-library') return null

  return buildDocumentRoute({
    sourceId: source.id,
    path: `${source.skillRoot || 'skills'}/${skillName}/SKILL.md`,
  })
}

function formatSkillCrossReferenceLine(line: string, source?: DocSource): string | null {
  const match = line.match(/^=>\s*skill:\s*([^\s—–-]+)\s*(?:—+|–+|-+)\s*(.+?)\s*$/u)
  if (!match) return null

  const [, skillName, description] = match
  const route = skillDocumentRoute(skillName, source)
  const label = route ? `[\`${skillName}\`](${route})` : `\`${skillName}\``
  return `- ${label} — ${description}`
}

function formatSkillCrossReferences(markdown: string, source?: DocSource): string {
  return markdown
    .split('\n')
    .map((line) => formatSkillCrossReferenceLine(line, source) || line)
    .join('\n')
}

function isLocalizedChineseSkill(source?: DocSource, selectedFile?: SelectedFile | null): boolean {
  return source?.locale === 'zh' && (
    source.kind === 'skill-library'
    || selectedFile?.path.includes('skills.zh/') === true
  )
}

function stripEnglishOriginalRunbook(markdown: string): string {
  const marker = markdown.match(/^##\s+英文原始运行说明\s*$/imu)
  if (marker?.index === undefined) return markdown
  return `${markdown.slice(0, marker.index).trimEnd()}\n`
}

function polishChineseSkillSummary(markdown: string): string {
  return markdown
    .replace(
      /阅读时先确认它解决的问题、适合触发的场景，以及下方英文运行说明中的命令、约束和安全边界。/gu,
      '阅读时先确认它解决的问题、适合触发的场景、执行边界和关键约束。',
    )
    .replace(
      /若任务涉及具体命令、外部服务、凭证、安全限制或运行顺序，应以下方英文原始说明为准。/gu,
      '若任务涉及具体命令、外部服务、凭证、安全限制或运行顺序，应回到原始技能仓库核对完整执行规范。',
    )
    .replace(/^##\s+阅读边界\s*\n[\s\S]*?(?=^##\s+|\s*$)/imu, '')
}

export function prepareDocumentDisplayMarkdown(
  markdown: string,
  source?: DocSource,
  selectedFile?: SelectedFile | null,
): string {
  const localizedMarkdown = isLocalizedChineseSkill(source, selectedFile)
    ? polishChineseSkillSummary(stripEnglishOriginalRunbook(markdown))
    : markdown
  return stripDisplayEmoji(formatStructuredCodeBlocks(formatSkillCrossReferences(localizedMarkdown, source)))
}
