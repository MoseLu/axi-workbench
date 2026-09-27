import { describe, it, expect } from 'vitest'
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
// @ts-expect-error - JS file without types
import { noteToMarkdown } from '../../sync-blinko.js'

const TEST_CONFIG = {
  attachmentMaxBytes: 2048,
  attachmentPolicy: 'oss<=0MB; local-only>0MB',
}

function parseMarkdownExport(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  expect(match).not.toBeNull()

  return {
    frontmatter: match![1],
    body: match![2],
  }
}

describe('Blinko Sync - noteToMarkdown', () => {
  const createMockNote = (overrides = {}) => ({
    id: 123,
    title: 'Test Note',
    content: 'This is test content',
    createdAt: '2026-03-24T10:00:00.000Z',
    updatedAt: '2026-03-24T11:00:00.000Z',
    tags: [{ name: 'test' }, { name: 'demo' }],
    url: 'https://example.com/note/123',
    attachments: [],
    comments: [],
    ...overrides,
  })

  it('should return export metadata and markdown frontmatter', () => {
    const note = createMockNote()
    const result = noteToMarkdown(note, TEST_CONFIG)
    const { frontmatter, body } = parseMarkdownExport(result.markdown)

    expect(result.filename).toBe('123.md')
    expect(result.syncHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.snapshot).toEqual({
      id: 123,
      content: 'This is test content',
      type: -1,
      tags: ['test', 'demo'],
      isArchived: false,
      isTop: false,
      isShare: false,
      attachments: [],
    })

    expect(frontmatter).toContain('title: "Test Note"')
    expect(frontmatter).toContain('blinko_id: 123')
    expect(frontmatter).toContain('blinko_type: -1')
    expect(frontmatter).toContain('blinko_created_at: "2026-03-24T10:00:00.000Z"')
    expect(frontmatter).toContain('blinko_updated_at: "2026-03-24T11:00:00.000Z"')
    expect(frontmatter).toContain('mirror_updated_at: "2026-03-24T11:00:00.000Z"')
    expect(frontmatter).toContain(`sync_hash: "${result.syncHash}"`)
    expect(frontmatter).toContain('attachment_policy: "oss<=0MB; local-only>0MB"')
    expect(frontmatter).toContain('attachment_count: 0')
    expect(frontmatter).toContain('tags:\n  - "test"\n  - "demo"')
    expect(frontmatter).toContain('attachment_names: []')
    expect(frontmatter).toContain('local_only_attachments: []')
    expect(frontmatter).toContain('source: "Blinko"')
    expect(body).toBe('This is test content\n')
  })

  it('should derive title from the first meaningful content line when title is missing', () => {
    const note = createMockNote({
      title: undefined,
      content: '# Imported heading\nSecond line',
    })
    const result = noteToMarkdown(note, TEST_CONFIG)
    const { frontmatter, body } = parseMarkdownExport(result.markdown)

    expect(frontmatter).toContain('title: "Imported heading"')
    expect(body).toBe('# Imported heading\nSecond line\n')
  })

  it('should fall back to a generated title when title and content are empty', () => {
    const note = createMockNote({
      title: undefined,
      content: '',
    })
    const result = noteToMarkdown(note, TEST_CONFIG)
    const { frontmatter, body } = parseMarkdownExport(result.markdown)

    expect(frontmatter).toContain('title: "Blinko-123"')
    expect(body).toBe('# Blinko-123\n')
  })

  it('should serialize empty tags as an empty yaml array', () => {
    const note = createMockNote({ tags: [] })
    const result = noteToMarkdown(note, TEST_CONFIG)
    const { frontmatter } = parseMarkdownExport(result.markdown)

    expect(result.snapshot.tags).toEqual([])
    expect(frontmatter).toContain('tags: []')
  })

  it('should normalize string tags and remove duplicates', () => {
    const note = createMockNote({ tags: ['tag1', 'tag2', 'tag1'] as any })
    const result = noteToMarkdown(note, TEST_CONFIG)
    const { frontmatter } = parseMarkdownExport(result.markdown)

    expect(result.snapshot.tags).toEqual(['tag1', 'tag2'])
    expect(frontmatter).toContain('tags:\n  - "tag1"\n  - "tag2"')
  })

  it('should record attachment metadata in frontmatter and snapshot', () => {
    const note = createMockNote({
      attachments: [
        { id: 1, name: 'image.png', path: '/files/1.png', size: 1024, type: 'image/png', url: 'https://example.com/files/1.png' },
      ],
    })
    const result = noteToMarkdown(note, TEST_CONFIG)
    const { frontmatter } = parseMarkdownExport(result.markdown)

    expect(result.snapshot.attachments).toEqual([
      {
        name: 'image.png',
        path: '/files/1.png',
        type: 'image/png',
        size: 1024,
        localOnly: false,
      },
    ])
    expect(frontmatter).toContain('attachment_count: 1')
    expect(frontmatter).toContain('attachment_names:\n  - "image.png"')
    expect(frontmatter).toContain('local_only_attachments: []')
  })

  it('should flag oversized attachments as local-only', () => {
    const note = createMockNote({
      attachments: [
        { id: 1, name: 'archive.zip', path: '/files/archive.zip', size: 4096, type: 'application/zip' },
      ],
    })
    const result = noteToMarkdown(note, TEST_CONFIG)
    const { frontmatter } = parseMarkdownExport(result.markdown)

    expect(result.snapshot.attachments[0]).toMatchObject({
      name: 'archive.zip',
      localOnly: true,
    })
    expect(frontmatter).toContain('local_only_attachments:\n  - "archive.zip"')
  })

  it('should ignore comments because they are not part of the mirror payload', () => {
    const note = createMockNote({
      comments: [
        { id: 1, author: 'User1', content: 'Great note!' },
      ],
    })
    const result = noteToMarkdown(note, TEST_CONFIG)

    expect(result.markdown).not.toContain('## 评论')
    expect(result.markdown).not.toContain('Great note!')
  })

  it('should keep missing dates as empty strings in frontmatter', () => {
    const note = createMockNote({ createdAt: undefined, updatedAt: undefined })
    const result = noteToMarkdown(note, TEST_CONFIG)
    const { frontmatter } = parseMarkdownExport(result.markdown)

    expect(frontmatter).toContain('blinko_created_at: ""')
    expect(frontmatter).toContain('blinko_updated_at: ""')
    expect(frontmatter).toContain('mirror_updated_at: ""')
  })

  it('should preserve special characters in titles while keeping the mirror filename stable', () => {
    const note = createMockNote({
      title: 'Test/Invalid:*?"<>|Title',
      content: '',
    })
    const result = noteToMarkdown(note, TEST_CONFIG)
    const { frontmatter, body } = parseMarkdownExport(result.markdown)

    expect(result.filename).toBe('123.md')
    expect(frontmatter).toContain('title: "Test/Invalid:*?\\"<>|Title"')
    expect(body).toBe('# Test/Invalid:*?"<>|Title\n')
  })

  it('should ignore note url fields because the current export schema does not serialize them', () => {
    const note = createMockNote({ url: 'https://example.com/note/123' })
    const result = noteToMarkdown(note, TEST_CONFIG)

    expect(result.markdown).not.toContain('\nurl:')
  })
})
