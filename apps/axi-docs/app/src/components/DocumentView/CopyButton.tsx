import { useState } from 'react'
import { getPageCopy, type PageCopyLocale } from '../../config/pageCopy'

// Copy button
export function CopyButton({ text, locale = 'zh' }: { text: string; locale?: PageCopyLocale }) {
  const copy = getPageCopy(locale).document
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text.trim()).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text.trim()
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      aria-label={copied ? copy.codeCopied : copy.copyCode}
      className={`copy-btn copy${copied ? ' copy-btn--copied copied' : ''}`}
      onClick={handleCopy}
      title={copied ? copy.copiedTitle : copy.copyTitle}
      type="button"
    >
      {copied ? (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m5 12 5 5L20 7" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      )}
    </button>
  )
}