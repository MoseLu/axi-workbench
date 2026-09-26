import { useEffect, useState } from 'react'
import { TocHeading } from '../types'

interface TableOfContentsProps {
  content: string
  scrollContainerSelector?: string
  headingRootSelector?: string
  label?: string
  onItemSelect?: () => void
}

function extractHeadings(markdown: string): TocHeading[] {
  const lines = markdown.split('\n')
  const headings: TocHeading[] = []
  let inCodeBlock = false

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length as TocHeading['level']
      const text = match[2].replace(/\*\*|__|\*|_|`/g, '').trim()
      const id = normalizeHeadingId(text)
      headings.push({ level, text, id })
    }
  }
  return headings
}

function normalizeHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function getRenderedHeadingText(el: Element): string {
  const clone = el.cloneNode(true) as Element
  clone.querySelector('.heading-anchor')?.remove()
  return clone.textContent?.trim() || ''
}

function hasScrollableY(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1
}

function resolveScrollContainer(selector: string): HTMLElement | null {
  const selected = document.querySelector(selector)
  if (!(selected instanceof HTMLElement)) return null

  let current: HTMLElement | null = selected
  while (current) {
    if (hasScrollableY(current)) return current
    current = current.parentElement
  }

  return selected
}

export function TableOfContents({
  content,
  scrollContainerSelector = '.app-main',
  headingRootSelector = '.doc-body',
  label = '目录',
  onItemSelect,
}: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocHeading[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    setHeadings(extractHeadings(content))
    setActiveId('')
  }, [content])

  useEffect(() => {
    const handleScroll = () => {
      const docBody = document.querySelector(headingRootSelector)
      if (!docBody) return

      const scrollContainer = resolveScrollContainer(scrollContainerSelector)
      const activationTop = scrollContainer
        ? scrollContainer.getBoundingClientRect().top + 32
        : 120
      const allHeadings = docBody.querySelectorAll('h1, h2, h3, h4, h5, h6')
      let current = ''

      allHeadings.forEach(el => {
        const rect = el.getBoundingClientRect()
        if (rect.top <= activationTop) {
          current = normalizeHeadingId(getRenderedHeadingText(el))
        }
      })
      setActiveId(current)
    }

    const scrollContainer = resolveScrollContainer(scrollContainerSelector)
    handleScroll()
    scrollContainer?.addEventListener('scroll', handleScroll)
    return () => scrollContainer?.removeEventListener('scroll', handleScroll)
  }, [headingRootSelector, headings, scrollContainerSelector])

  const scrollToHeading = (heading: TocHeading) => {
    const docBody = document.querySelector(headingRootSelector)
    if (!docBody) return

    const allHeadings = docBody.querySelectorAll('h1, h2, h3, h4, h5, h6')
    for (const el of allHeadings) {
      if (getRenderedHeadingText(el) === heading.text) {
        const scrollContainer = resolveScrollContainer(scrollContainerSelector)
        if (scrollContainer) {
          const containerTop = scrollContainer.getBoundingClientRect().top
          const headingTop = el.getBoundingClientRect().top
          const top = scrollContainer.scrollTop + headingTop - containerTop - 24
          if (typeof scrollContainer.scrollTo === 'function') {
            scrollContainer.scrollTo({
              top,
              behavior: 'smooth',
            })
          } else {
            scrollContainer.scrollTop = top
          }
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        setActiveId(heading.id)
        onItemSelect?.()
        break
      }
    }
  }

  if (headings.length < 2) return null

  return (
    <>
      <div className="toc-header">{label}</div>
      <nav className="toc-nav">
        {headings.map((h, i) => (
          <button
            key={i}
            className={`toc-item toc-level-${h.level} ${activeId === h.id ? 'active' : ''}`}
            onClick={() => scrollToHeading(h)}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </nav>
    </>
  )
}
