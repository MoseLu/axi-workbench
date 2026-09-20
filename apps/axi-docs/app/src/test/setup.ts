import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock fetch for testing
global.fetch = vi.fn()

// Mock window.location
const mockLocation = {
  href: 'http://localhost:3003',
  origin: 'http://localhost:3003',
}
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
})
