import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RefreshIcon, SearchIcon, BookIcon, EditIcon, FileIcon, FolderIcon, LanguageIcon, TagIcon } from './Icons'

describe('Icons', () => {
  describe('RefreshIcon', () => {
    it('should render SVG element', () => {
      render(<RefreshIcon />)
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument()
    })
  })

  describe('SearchIcon', () => {
    it('should render SVG element', () => {
      render(<SearchIcon />)
      expect(screen.getByTestId('search-icon')).toBeInTheDocument()
    })
  })

  describe('BookIcon', () => {
    it('should render SVG element', () => {
      render(<BookIcon />)
      expect(screen.getByTestId('book-icon')).toBeInTheDocument()
    })
  })

  describe('FileIcon', () => {
    it('should render SVG element', () => {
      render(<FileIcon />)
      expect(screen.getByTestId('file-icon')).toBeInTheDocument()
    })
  })

  describe('FolderIcon', () => {
    it('should render SVG element', () => {
      render(<FolderIcon />)
      expect(screen.getByTestId('folder-icon')).toBeInTheDocument()
    })
  })

  describe('TagIcon', () => {
    it('should render SVG element', () => {
      render(<TagIcon />)
      expect(screen.getByTestId('tag-icon')).toBeInTheDocument()
    })
  })

  describe('EditIcon', () => {
    it('should render SVG element', () => {
      render(<EditIcon />)
      expect(screen.getByTestId('edit-icon')).toBeInTheDocument()
    })
  })

  describe('LanguageIcon', () => {
    it('should render SVG element', () => {
      render(<LanguageIcon />)
      expect(screen.getByTestId('language-icon')).toBeInTheDocument()
    })
  })
})
