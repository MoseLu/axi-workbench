/**
 * Terminal Component using xterm.js
 */

import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSessionStore } from '@/stores/sessionStore'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/useTranslation'
import { Terminal, Plus, Trash2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TerminalInstance {
  id: string
  name: string
  terminal: XTerm | null
  fitAddon: FitAddon | null
}

export function TerminalPanel() {
  const { t } = useTranslation()
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [terminals, setTerminals] = useState<TerminalInstance[]>([])
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)
  const [commandInput, setCommandInput] = useState('')
  const { sendTerminalCommand, currentSessionId } = useSessionStore()

  // Initialize terminals
  useEffect(() => {
    if (terminals.length === 0) {
      const id = `term-${Date.now()}`
      setTerminals([{
        id,
        name: t('terminal.terminal') + ' 1',
        terminal: null,
        fitAddon: null,
      }])
      setActiveTerminalId(id)
    }
  }, [])

  // Setup each terminal when terminals change
  useEffect(() => {
    terminals.forEach(async (term) => {
      const container = terminalRefs.current.get(term.id)
      if (!container || term.terminal) return

      // Create xterm instance
      const terminal = new XTerm({
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontSize: 13,
        lineHeight: 1.2,
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#aeafad',
          cursorAccent: '#1e1e1e',
          selectionBackground: '#264f78',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5',
        },
        cursorBlink: true,
        allowProposedApi: true,
      })

      // Add addons
      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()
      terminal.loadAddon(fitAddon)
      terminal.loadAddon(webLinksAddon)

      // Open terminal
      terminal.open(container)
      fitAddon.fit()

      // Welcome message
      terminal.writeln('\x1b[1;34m╔════════════════════════════════════╗\x1b[0m')
      terminal.writeln('\x1b[1;34m║\x1b[0m  \x1b[1;36m' + t('terminal.welcomeMessageLine1') + '\x1b[0m             \x1b[1;34m║\x1b[0m')
      terminal.writeln('\x1b[1;34m║\x1b[0m  ' + t('terminal.welcomeMessageLine2') + '    \x1b[1;34m║\x1b[0m')
      terminal.writeln('\x1b[1;34m╚════════════════════════════════════╝\x1b[0m')
      terminal.writeln('')
      terminal.write('\x1b[1;32m$\x1b[0m ')

      // Update terminal instance
      setTerminals(prev => prev.map(t => 
        t.id === term.id ? { ...t, terminal, fitAddon } : t
      ))

      // Handle terminal input
      terminal.onData((data) => {
        // Handle special keys
        if (data === '\r') { // Enter
          terminal.writeln('')

          // Get current line buffer
          // In a real implementation, we'd track the current input
          // For now, we'll handle via a separate input for simplicity
        } else if (data === '\x7f') { // Backspace
          terminal.write('\b \b')
        } else {
          terminal.write(data)
        }
      })
    })

    return () => {
      terminals.forEach(term => {
        term.terminal?.dispose()
      })
    }
  }, [])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      terminals.forEach(term => {
        term.fitAddon?.fit()
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [terminals])

  // Add new terminal
  const addTerminal = () => {
    const id = `term-${Date.now()}`
    setTerminals(prev => [...prev, {
      id,
      name: t('terminal.terminal') + ' ' + (prev.length + 1),
      terminal: null,
      fitAddon: null,
    }])
    setActiveTerminalId(id)
  }

  // Close terminal
  const closeTerminal = (id: string) => {
    const term = terminals.find(t => t.id === id)
    term?.terminal?.dispose()

    setTerminals(prev => prev.filter(t => t.id !== id))

    if (activeTerminalId === id) {
      setActiveTerminalId(terminals[0]?.id || null)
    }
  }

  // Execute command
  const handleExecute = async () => {
    if (!commandInput.trim() || !currentSessionId) return

    const activeTerm = terminals.find(t => t.id === activeTerminalId)
    if (!activeTerm?.terminal) return

    activeTerm.terminal.writeln(commandInput)

    try {
      const result = await sendTerminalCommand(currentSessionId, commandInput)
      if (result.output) {
        activeTerm.terminal.writeln(result.output)
      }
      if (result.error) {
        activeTerm.terminal.writeln(`\x1b[31mError: ${result.error}\x1b[0m`)
      }
    } catch (error) {
      activeTerm.terminal.writeln(`\x1b[31mError: ${(error as Error).message}\x1b[0m`)
    }

    activeTerm.terminal.write('\n\x1b[1;32m$\x1b[0m ')
    setCommandInput('')
  }

  // Get active terminal
  const activeTerminal = terminals.find(t => t.id === activeTerminalId)

  return (
    <div className="flex flex-col h-full">
      {/* Terminal Tabs */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-card overflow-x-auto">
        {terminals.map((term) => (
          <div
            key={term.id}
            className={cn(
              "flex items-center gap-2 px-3 py-1 text-sm rounded cursor-pointer hover:bg-accent",
              activeTerminalId === term.id && "bg-accent"
            )}
            onClick={() => setActiveTerminalId(term.id)}
          >
            <Terminal className="h-3 w-3" />
            <span>{term.name}</span>
            {terminals.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTerminal(term.id)
                }}
                className="hover:bg-destructive/20 rounded p-0.5"
              >
                <span className="text-xs">×</span>
              </button>
            )}
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={addTerminal}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 relative">
        {terminals.map((term) => (
          <div
            key={term.id}
            ref={(el) => {
              if (el) terminalRefs.current.set(term.id, el)
            }}
            className={cn(
              "absolute inset-0",
              activeTerminalId === term.id ? "block" : "hidden"
            )}
          />
        ))}

        {!activeTerminalId && (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('terminal.noTerminalOpen')}</p>
              <Button variant="link" onClick={addTerminal} className="mt-2">
                {t('terminal.createNewTerminal')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Command Input */}
      {currentSessionId && (
        <div className="flex items-center gap-2 px-2 py-1 border-t bg-card">
          <span className="text-green-500 font-mono text-sm">$</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            className="flex-1 bg-transparent border-none outline-none text-sm font-mono"
            placeholder={t('terminal.enterCommand')}
          />
        </div>
      )}
    </div>
  )
}
