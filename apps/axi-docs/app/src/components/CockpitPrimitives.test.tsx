import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedTabs } from './CockpitPrimitives'

describe('SegmentedTabs', () => {
  it('exposes selected tab semantics', () => {
    render(
      <SegmentedTabs
        ariaLabel="结果类型"
        idBase="segmented-tabs-test"
        items={[
          { value: 'all', label: '全部' },
          { value: 'docs', label: '文档' },
        ]}
        onChange={vi.fn()}
        panelId="segmented-tabs-panel"
        value="all"
      />,
    )

    expect(screen.getByRole('tab', { name: '全部' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '全部' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: '文档' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: '文档' })).toHaveAttribute('aria-controls', 'segmented-tabs-panel')
  })

  it('supports arrow key roving', () => {
    const onChange = vi.fn()
    render(
      <SegmentedTabs
        ariaLabel="结果类型"
        idBase="segmented-tabs-keyboard"
        items={[
          { value: 'all', label: '全部' },
          { value: 'docs', label: '文档' },
          { value: 'nodes', label: '节点' },
        ]}
        onChange={onChange}
        panelId="segmented-tabs-panel"
        value="all"
      />,
    )

    fireEvent.keyDown(screen.getByRole('tab', { name: '全部' }), { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('tab', { name: '全部' }), { key: 'End' })

    expect(onChange).toHaveBeenNthCalledWith(1, 'docs')
    expect(onChange).toHaveBeenNthCalledWith(2, 'nodes')
  })
})
