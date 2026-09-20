import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TableOfContents } from './TableOfContents'

describe('TableOfContents', () => {
  it('scrolls the configured document container when a heading is selected', async () => {
    const { container } = render(
      <div className="reader">
        <div className="app-content">
          <article className="doc-body">
            <h1><a className="heading-anchor" href="#简介">#</a>简介</h1>
            <h2><a className="heading-anchor" href="#执行步骤">#</a>执行步骤</h2>
          </article>
        </div>
        <TableOfContents
          content={`# 简介

## 执行步骤`}
          headingRootSelector=".reader .doc-body"
          scrollContainerSelector=".reader .app-content"
        />
      </div>,
    )

    const scrollContainer = container.querySelector('.app-content') as HTMLElement
    const targetHeading = container.querySelector('h2') as HTMLElement
    const scrollTo = vi.fn()

    scrollContainer.scrollTop = 100
    scrollContainer.scrollTo = scrollTo
    scrollContainer.getBoundingClientRect = () => ({ top: 20 }) as DOMRect
    targetHeading.getBoundingClientRect = () => ({ top: 220 }) as DOMRect

    fireEvent.click(await screen.findByRole('button', { name: '执行步骤' }))

    expect(scrollTo).toHaveBeenCalledWith({
      top: 276,
      behavior: 'smooth',
    })
  })

  it('falls back to the nearest scrollable ancestor when the configured container is not scrollable', async () => {
    const { container } = render(
      <div className="scroll-shell">
        <div className="reader">
          <div className="app-content">
            <article className="doc-body">
              <h1><a className="heading-anchor" href="#简介">#</a>简介</h1>
              <h2><a className="heading-anchor" href="#搜索文档">#</a>搜索文档</h2>
            </article>
          </div>
          <TableOfContents
            content={`# 简介

## 搜索文档`}
            headingRootSelector=".reader .doc-body"
            scrollContainerSelector=".reader .app-content"
          />
        </div>
      </div>,
    )

    const scrollShell = container.querySelector('.scroll-shell') as HTMLElement
    const appContent = container.querySelector('.app-content') as HTMLElement
    const targetHeading = container.querySelector('h2') as HTMLElement
    const scrollTo = vi.fn()

    Object.defineProperty(appContent, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(appContent, 'scrollHeight', { configurable: true, value: 400 })
    Object.defineProperty(scrollShell, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(scrollShell, 'scrollHeight', { configurable: true, value: 1200 })

    scrollShell.scrollTop = 100
    scrollShell.scrollTo = scrollTo
    scrollShell.getBoundingClientRect = () => ({ top: 20 }) as DOMRect
    targetHeading.getBoundingClientRect = () => ({ top: 220 }) as DOMRect

    fireEvent.click(await screen.findByRole('button', { name: '搜索文档' }))

    expect(scrollTo).toHaveBeenCalledWith({
      top: 276,
      behavior: 'smooth',
    })
  })

  it('notifies when a heading is selected', async () => {
    const onItemSelect = vi.fn()
    render(
      <div className="reader">
        <div className="app-content">
          <article className="doc-body">
            <h1><a className="heading-anchor" href="#简介">#</a>简介</h1>
            <h2><a className="heading-anchor" href="#执行步骤">#</a>执行步骤</h2>
          </article>
        </div>
        <TableOfContents
          content={`# 简介

## 执行步骤`}
          headingRootSelector=".reader .doc-body"
          onItemSelect={onItemSelect}
          scrollContainerSelector=".reader .app-content"
        />
      </div>,
    )

    fireEvent.click(await screen.findByRole('button', { name: '执行步骤' }))

    expect(onItemSelect).toHaveBeenCalledTimes(1)
  })

  it('tracks the active heading relative to the configured scroll container', async () => {
    const { container } = render(
      <div className="reader">
        <div className="app-content">
          <article className="doc-body">
            <h1><a className="heading-anchor" href="#简介">#</a>简介</h1>
            <h2><a className="heading-anchor" href="#执行步骤">#</a>执行步骤</h2>
          </article>
        </div>
        <TableOfContents
          content={`# 简介

## 执行步骤`}
          headingRootSelector=".reader .doc-body"
          scrollContainerSelector=".reader .app-content"
        />
      </div>,
    )

    const scrollContainer = container.querySelector('.app-content') as HTMLElement
    const [introHeading, targetHeading] = Array.from(container.querySelectorAll('.doc-body h1, .doc-body h2')) as HTMLElement[]

    await screen.findByRole('button', { name: '执行步骤' })

    scrollContainer.getBoundingClientRect = () => ({ top: 100 }) as DOMRect
    introHeading.getBoundingClientRect = () => ({ top: 80 }) as DOMRect
    targetHeading.getBoundingClientRect = () => ({ top: 124 }) as DOMRect

    fireEvent.scroll(scrollContainer)

    expect(screen.getByRole('button', { name: '执行步骤' })).toHaveClass('active')
  })
})
