import { useMemo } from 'react'
import type { Components } from 'react-markdown'
import { processChildren } from './wikiLink'
import { CopyButton } from './CopyButton'
import { extractText, headingId } from './markdownContent'
import {
  blockCodeClassName,
  codeLanguage,
  isShellLanguage,
  renderShellSyntax,
} from './shellSyntax'
import type { PageCopyLocale } from '../../config/pageCopy'

export function useMarkdownComponents(wikiLinkSourceId?: string, effectiveLocale?: PageCopyLocale): Components {
  return useMemo(() => ({
    p({ children }) { return <p>{processChildren(children, wikiLinkSourceId)}</p> },
    li({ children }) { return <li>{processChildren(children, wikiLinkSourceId)}</li> },
    a({ href, children, className, title }) {
      const isExternal = Boolean(href && /^(?:https?:)?\/\//iu.test(href))
      const linkClassName = ['md-link', isExternal ? 'md-link--external' : '', className].filter(Boolean).join(' ')
      return (
        <a
          className={linkClassName}
          href={href}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          target={isExternal ? '_blank' : undefined}
          title={title}
        >
          {children}
        </a>
      )
    },
    pre({ children }) {
      const codeEl = Array.isArray(children) ? children[0] : children
      const className = (codeEl as React.ReactElement)?.props?.className || ''
      const rawText = extractText(children)
      const lang = codeLanguage(className as string) || (rawText.includes('\n') ? 'text' : '')
      const codeBlockClassName = [
        'code-block',
        lang ? `language-${lang}` : '',
        lang === 'text' ? 'code-block--text' : '',
      ].filter(Boolean).join(' ')
      return (
        <div className={codeBlockClassName}>
          <CopyButton text={rawText} locale={effectiveLocale} />
          {lang && <span className="code-lang lang">{lang}</span>}
          <pre>{children}</pre>
        </div>
      )
    },
    code({ className, children }) {
      const rawClassName = className || ''
      const rawText = extractText(children)
      const lang = codeLanguage(rawClassName)
      const isBlock = Boolean(lang || rawClassName.includes('hljs') || rawText.includes('\n'))
      if (isBlock && isShellLanguage(lang)) {
        return <code className={blockCodeClassName(rawClassName, rawText)}>{renderShellSyntax(rawText)}</code>
      }
      if (isBlock) return <code className={blockCodeClassName(rawClassName, rawText)}>{children}</code>
      return <code className="inline-code">{children}</code>
    },
    h1: ({ children }) => {
      const id = headingId(children)
      return <h1 id={id}><a href={`#${id}`} className="heading-anchor" aria-hidden="true">#</a>{children}</h1>
    },
    h2: ({ children }) => {
      const id = headingId(children)
      return <h2 id={id}><a href={`#${id}`} className="heading-anchor" aria-hidden="true">#</a>{children}</h2>
    },
    h3: ({ children }) => {
      const id = headingId(children)
      return <h3 id={id}><a href={`#${id}`} className="heading-anchor" aria-hidden="true">#</a>{children}</h3>
    },
    h4: ({ children }) => {
      const id = headingId(children)
      return <h4 id={id}><a href={`#${id}`} className="heading-anchor" aria-hidden="true">#</a>{children}</h4>
    },
  }), [wikiLinkSourceId, effectiveLocale])
}