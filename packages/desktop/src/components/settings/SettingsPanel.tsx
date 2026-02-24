/**
 * Settings Panel Component
 */

import { useState, useEffect } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/useTranslation'
import {
  Settings,
  X,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Key,
  Cpu,
  Terminal,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UpdateButton } from './UpdateChecker'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

interface SettingsForm {
  llm_model: string
  llm_api_base: string
  llm_api_key: string
  max_steps: number
  workspace_dir: string
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { t } = useTranslation()
  const { config, loadConfig } = useSessionStore()
  const [form, setForm] = useState<SettingsForm>({
    llm_model: 'gpt-4o',
    llm_api_base: '',
    llm_api_key: '',
    max_steps: 50,
    workspace_dir: '.',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load config on mount
  useEffect(() => {
    if (isOpen && config) {
      setForm({
        llm_model: config.llm_model || 'gpt-4o',
        llm_api_base: '',
        llm_api_key: '',
        max_steps: config.max_steps || 50,
        workspace_dir: config.workspace_dir || '.',
      })
    }
  }, [isOpen, config])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      // In a real implementation, this would call an API to save settings
      // For now, we just simulate saving
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Save to localStorage as a fallback
      localStorage.setItem('mini-agent-settings', JSON.stringify(form))
      
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      
      // Reload config
      await loadConfig()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleBrowseFolder = async () => {
    // In a real implementation, this would use Tauri/OpenDialog
    // For now, we'll just use a prompt
    const dir = prompt('Enter workspace directory:', form.workspace_dir)
    if (dir) {
      setForm(prev => ({ ...prev, workspace_dir: dir }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[80vh] bg-background rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* LLM Settings */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Cpu className="h-4 w-4" />
              {t('settings.llmConfig')}
            </h3>
            
            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('settings.model')}</label>
                <Input
                  value={form.llm_model}
                  onChange={(e) => setForm(prev => ({ ...prev, llm_model: e.target.value }))}
                  placeholder={t('settings.modelPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.modelHint')}
                </p>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('settings.apiBaseUrl')}</label>
                <Input
                  value={form.llm_api_base}
                  onChange={(e) => setForm(prev => ({ ...prev, llm_api_base: e.target.value }))}
                  placeholder={t('settings.apiBasePlaceholder')}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('settings.apiKey')}</label>
                <Input
                  type="password"
                  value={form.llm_api_key}
                  onChange={(e) => setForm(prev => ({ ...prev, llm_api_key: e.target.value }))}
                  placeholder={t('settings.apiKeyPlaceholder')}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('settings.maxSteps')}</label>
                <Input
                  type="number"
                  value={form.max_steps}
                  onChange={(e) => setForm(prev => ({ ...prev, max_steps: parseInt(e.target.value) || 50 }))}
                  min={1}
                  max={500}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.maxStepsHint')}
                </p>
              </div>
            </div>
          </section>

          {/* Workspace Settings */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
              <FolderOpen className="h-4 w-4" />
              {t('settings.workspace')}
            </h3>

            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('settings.workingDirectory')}</label>
                <div className="flex gap-2">
                  <Input
                    value={form.workspace_dir}
                    onChange={(e) => setForm(prev => ({ ...prev, workspace_dir: e.target.value }))}
                    placeholder="."
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={handleBrowseFolder}>
                    {t('settings.browse')}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Terminal className="h-4 w-4" />
              {t('settings.keyboardShortcuts')}
            </h3>

            <div className="bg-muted rounded-lg p-4">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-mono">Ctrl+S</td>
                    <td className="py-2">{t('settings.saveFile')}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono">Ctrl+W</td>
                    <td className="py-2">{t('settings.closeTab')}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono">Ctrl+`</td>
                    <td className="py-2">{t('settings.toggleTerminal')}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono">Ctrl+Shift+P</td>
                    <td className="py-2">{t('settings.commandPalette')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Updates */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
              <RefreshCw className="h-4 w-4" />
              {t('settings.updates')}
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('settings.currentVersion')}: 0.1.0
              </p>
              <UpdateButton />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-card">
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          
          {saved && (
            <div className="flex items-center gap-2 text-green-500 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              {t('settings.saved')}
            </div>
          )}
          
          <div className="flex-1" />
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('settings.saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('settings.save')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
