export function codeLanguage(className: string): string {
  const rawLanguage = className.split(/\s+/u).find((entry) => entry.startsWith('language-'))?.replace('language-', '') || ''
  return ['plain', 'plaintext', 'txt'].includes(rawLanguage) ? 'text' : rawLanguage
}

export function blockCodeClassName(className: string, text: string): string {
  if (codeLanguage(className)) return className
  return text.includes('\n') ? 'language-text' : className
}

export function isShellLanguage(language: string): boolean {
  return ['bash', 'sh', 'shell', 'zsh', 'console'].includes(language)
}

export function shellTokenClass(token: string, isFirstToken: boolean): string {
  if (/^#/.test(token)) return 'shell-comment'
  if (/^(['"`]).*\1$/u.test(token)) return 'shell-string'
  if (/^-{1,2}[\w-]+(?:=.*)?$/u.test(token)) return 'shell-flag'
  if (isFirstToken || /^(?:npm|npx|pnpm|yarn|bun|turbo|git|curl|docker|node|tsx|vite|vercel)$/u.test(token)) {
    return 'shell-command'
  }
  if (/^(?:@?[\w.-]+\/)?[\w.-]+@[\w.-]+$/u.test(token)) return 'shell-package'
  return 'shell-arg'
}

export function renderShellLine(line: string, lineIndex: number): React.ReactNode {
  const leadingWhitespace = line.match(/^\s*/u)?.[0] || ''
  const content = line.slice(leadingWhitespace.length)
  if (!content) return line
  if (content.startsWith('#')) {
    return (
      <span key={lineIndex}>
        {leadingWhitespace}
        <span className="shell-comment">{content}</span>
      </span>
    )
  }

  const tokenRegex = /\s+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\S+/gu
  let commandSeen = false
  return (
    <span key={lineIndex}>
      {leadingWhitespace}
      {Array.from(content.matchAll(tokenRegex)).map((match, tokenIndex) => {
        const token = match[0]
        if (/^\s+$/u.test(token)) return token
        const isFirstToken = !commandSeen && token !== '$'
        if (token !== '$') commandSeen = true
        return (
          <span key={tokenIndex} className={token === '$' ? 'shell-prompt' : shellTokenClass(token, isFirstToken)}>
            {token}
          </span>
        )
      })}
    </span>
  )
}

export function renderShellSyntax(text: string): React.ReactNode {
  return text.split(/(\n)/u).map((part, index) => (
    part === '\n' ? part : renderShellLine(part, index)
  ))
}