import { useEffect, useState } from 'react'
import type { ProjectHandoffCard as HandoffCard } from '../lib/knowledgeBase'
import { getProjectHandoffCard } from '../lib/knowledgeBase'

const STATE_LABELS: Record<HandoffCard['state'], { label: string; tone: 'ok' | 'warn' | 'danger' }> = {
  ok: { label: 'handoff 正常', tone: 'ok' },
  stale: { label: 'handoff 过期', tone: 'warn' },
  missing: { label: 'handoff 缺失', tone: 'danger' },
}

const READINESS_LABELS: Record<HandoffCard['readiness'], string> = {
  verified: 'verified',
  documented: 'documented',
  stale: 'stale',
  unready: 'unready',
  unknown: 'unknown',
}

type ProjectHandoffCardProps = {
  projectId: string
  locale?: 'en' | 'zh'
}

export function ProjectHandoffCard({ projectId, locale = 'zh' }: ProjectHandoffCardProps) {
  const [card, setCard] = useState<HandoffCard | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getProjectHandoffCard(projectId)
      .then((result) => {
        if (!cancelled) {
          setCard(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCard({
            state: 'missing',
            readiness: 'unknown',
            score: 0,
            readOrder: [],
            entrypoints: [],
            smokeCommand: null,
            verifyCommand: null,
            currentWork: { active: [], knownFailures: [] },
            lastVerifiedAt: null,
            ageDays: null,
            handoffPath: null,
            manifestPath: null,
            handoffSource: 'none',
            handoffGeneratedAt: null,
          })
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (loading) {
    return (
      <div className="project-handoff-card project-handoff-card--loading" data-testid="project-handoff-loading">
        加载 handoff…
      </div>
    )
  }
  if (!card) return null

  const stateMeta = STATE_LABELS[card.state]
  const labels = locale === 'en'
    ? {
        heading: 'Zero-Context Handoff',
        score: 'Score',
        verified: 'Last verified',
        known: 'Known failures',
        active: 'Active work',
        readOrder: 'Read order',
        entrypoints: 'Entrypoints',
        smoke: 'Smoke command',
        verify: 'Verify command',
        manifest: 'Manifest',
        handoff: 'Handoff',
        generated: 'Snapshot generated',
        age: 'days ago',
        missing: 'The handoff snapshot is missing or unreadable; the legacy WORKSPACE_INDEX.md may still cover this project.',
        stale: 'The handoff snapshot is older than 14 days. Re-run `workspace-project handoff --json` to refresh.',
      }
    : {
        heading: '零上下文接手 (Handoff)',
        score: '评分',
        verified: '最近校验',
        known: '已知故障',
        active: '当前工作',
        readOrder: '阅读顺序',
        entrypoints: '入口',
        smoke: '冒烟命令',
        verify: '验证命令',
        manifest: '清单',
        handoff: '接手文档',
        generated: '快照生成',
        age: '天前',
        missing: '未读取到 handoff 快照；可能由 WORKSPACE_INDEX.md 兜底维护。',
        stale: 'handoff 快照超过 14 天，请运行 `workspace-project handoff --json` 刷新。',
      }

  return (
    <section
      className={`project-handoff-card project-handoff-card--${stateMeta.tone}`}
      data-state={card.state}
      data-testid="project-handoff-card"
    >
      <header className="project-handoff-card__header">
        <span className={`project-handoff-card__state project-handoff-card__state--${stateMeta.tone}`}>
          {stateMeta.label}
        </span>
        <span className="project-handoff-card__readiness">
          {READINESS_LABELS[card.readiness]}
        </span>
        <span className="project-handoff-card__score">
          {labels.score}: {card.score} / 10
        </span>
        {card.ageDays !== null && (
          <span className="project-handoff-card__age">
            {labels.age}: {card.ageDays.toFixed(1)} {labels.age}
          </span>
        )}
      </header>

      {(card.state === 'stale' || card.state === 'missing') && (
        <p className="project-handoff-card__notice">
          {card.state === 'stale' ? labels.stale : labels.missing}
        </p>
      )}

      {card.readOrder.length > 0 && (
        <details open className="project-handoff-card__section">
          <summary>{labels.readOrder}</summary>
          <ol>
            {card.readOrder.map((entry, index) => (
              <li key={`${entry}-${index}`}><code>{entry}</code></li>
            ))}
          </ol>
        </details>
      )}

      {card.entrypoints.length > 0 && (
        <details className="project-handoff-card__section">
          <summary>{labels.entrypoints}</summary>
          <table>
            <thead>
              <tr><th>id</th><th>path</th><th>purpose</th></tr>
            </thead>
            <tbody>
              {card.entrypoints.map((entry, index) => (
                <tr key={`${entry.id}-${index}`}>
                  <td><code>{entry.id}</code></td>
                  <td><code>{entry.path}</code></td>
                  <td>{entry.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {card.verifyCommand && (
        <details className="project-handoff-card__section">
          <summary>{labels.verify}</summary>
          <pre><code>{card.verifyCommand}</code></pre>
        </details>
      )}

      {card.smokeCommand && (
        <details className="project-handoff-card__section">
          <summary>{labels.smoke}</summary>
          <pre><code>{card.smokeCommand}</code></pre>
        </details>
      )}

      {card.currentWork.active.length > 0 && (
        <details className="project-handoff-card__section">
          <summary>{labels.active}</summary>
          <ul>
            {card.currentWork.active.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </details>
      )}

      {card.currentWork.knownFailures.length > 0 && (
        <details open className="project-handoff-card__section project-handoff-card__section--failures">
          <summary>{labels.known}</summary>
          <ul>
            {card.currentWork.knownFailures.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </details>
      )}

      <footer className="project-handoff-card__footer">
        {card.lastVerifiedAt && (
          <span>{labels.verified}: <code>{card.lastVerifiedAt}</code></span>
        )}
        {card.handoffGeneratedAt && (
          <span>{labels.generated}: <code>{card.handoffGeneratedAt}</code></span>
        )}
        {card.manifestPath && (
          <a href={`file://${card.manifestPath}`} target="_blank" rel="noreferrer">
            {labels.manifest}
          </a>
        )}
        {card.handoffPath && (
          <a href={`file://${card.handoffPath}`} target="_blank" rel="noreferrer">
            {labels.handoff}
          </a>
        )}
      </footer>
    </section>
  )
}
