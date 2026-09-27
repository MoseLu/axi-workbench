import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FileService } from './fileService'
import { DocSource } from '../types'

// Mock sources for testing
const mockSources: DocSource[] = [
  {
    id: 'test-source',
    name: 'Test Source',
    path: '/test/path',
    enabled: true,
    type: 'local',
  },
  {
    id: 'disabled-source',
    name: 'Disabled Source',
    path: '/disabled',
    enabled: false,
    type: 'local',
  },
]

describe('FileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should filter out disabled sources', () => {
      const service = new FileService(mockSources)
      // @ts-ignore - accessing private property for testing
      expect(service.sources.length).toBe(1)
      // @ts-ignore
      expect(service.sources[0].id).toBe('test-source')
    })
  })

  describe('scanDirectory', () => {
    it('should return empty array for non-existent source', async () => {
      const service = new FileService(mockSources)
      const result = await service.scanDirectory('non-existent')
      expect(result).toEqual([])
    })

    it('should call API endpoint with correct parameters', async () => {
      const mockResponse = [
        { id: '1', name: 'file1.md', type: 'file' },
        { id: '2', name: 'folder', type: 'directory' },
      ]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => '',
      } as Response)

      const service = new FileService(mockSources)
      const result = await service.scanDirectory('test-source', 'sub/path')

      expect(fetch).toHaveBeenCalledWith(
        '/api/api/scan?source=test-source&path=' + encodeURIComponent('sub/path')
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle API errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      } as Response)

      const service = new FileService(mockSources)
      const result = await service.scanDirectory('test-source')

      expect(result).toEqual([])
    })

    it('should handle network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const service = new FileService(mockSources)
      const result = await service.scanDirectory('test-source')

      expect(result).toEqual([])
    })
  })

  describe('readFile', () => {
    it('should fetch file content from API', async () => {
      const mockContent = '# Test Markdown\n\nContent here.'
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      } as Response)

      const service = new FileService(mockSources)
      const result = await service.readFile('test-source', 'file.md')

      expect(fetch).toHaveBeenCalledWith(
        '/api/api/file?source=test-source&path=' + encodeURIComponent('file.md')
      )
      expect(result).toBe(mockContent)
    })

    it('should return null for non-existent files', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      const service = new FileService(mockSources)
      const result = await service.readFile('test-source', 'nonexistent.md')

      expect(result).toBeNull()
    })

    it('should handle network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const service = new FileService(mockSources)
      const result = await service.readFile('test-source', 'file.md')

      expect(result).toBeNull()
    })
  })

  describe('isExcluded', () => {
    it('should exclude pattern matches', () => {
      const service = new FileService(mockSources)
      expect(service.isExcluded('.git')).toBe(true)
      expect(service.isExcluded('node_modules')).toBe(true)
    })

    it('should exclude hidden files', () => {
      const service = new FileService(mockSources)
      expect(service.isExcluded('.hidden')).toBe(true)
      expect(service.isExcluded('.DS_Store')).toBe(true)
    })

    it('should not exclude regular names', () => {
      const service = new FileService(mockSources)
      expect(service.isExcluded('docs')).toBe(false)
      expect(service.isExcluded('file.md')).toBe(false)
    })
  })

  describe('isSupported', () => {
    it('should support markdown files', () => {
      const service = new FileService(mockSources)
      expect(service.isSupported('note.md')).toBe(true)
      expect(service.isSupported('file.markdown')).toBe(true)
    })

    it('should be case insensitive', () => {
      const service = new FileService(mockSources)
      expect(service.isSupported('NOTE.MD')).toBe(true)
    })

    it('should not support other file types', () => {
      const service = new FileService(mockSources)
      expect(service.isSupported('file.txt')).toBe(false)
      expect(service.isSupported('doc.pdf')).toBe(false)
    })
  })
})
