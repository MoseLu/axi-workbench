import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/useTranslation'
import {
  Bot,
  FileCode,
  Terminal,
  Settings,
  Sparkles,
  Zap,
  Shield,
  BookOpen,
  ExternalLink,
  Github,
  Copy,
  Check
} from 'lucide-react'

interface AboutInfo {
  version: string
  pythonVersion: string
  platform: string
  uptime: string
}

export function WelcomeScreen() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [aboutInfo, setAboutInfo] = useState<AboutInfo | null>(null)

  useEffect(() => {
    // Get basic info
    setAboutInfo({
      version: '0.1.0',
      pythonVersion: '3.10+',
      platform: navigator.platform,
      uptime: '0:00:00'
    })
  }, [])

  const copyVersion = () => {
    navigator.clipboard.writeText('Mini-Agent Desktop v0.1.0')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-background to-background/80">
      <div className="max-w-2xl w-full mx-8 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
            <Bot className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{t('welcome.title')}</h1>
          <p className="text-muted-foreground">{t('welcome.subtitle')}</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <QuickAction
            icon={FileCode}
            label={t('welcome.newFile')}
            description={t('welcome.createNewFile')}
          />
          <QuickAction
            icon={Terminal}
            label={t('welcome.terminal')}
            description={t('welcome.openTerminal')}
          />
          <QuickAction
            icon={Settings}
            label={t('welcome.settings')}
            description={t('welcome.configureAI')}
          />
          <QuickAction
            icon={Sparkles}
            label={t('welcome.aiChat')}
            description={t('welcome.startChatting')}
          />
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <FeatureCard
            icon={Zap}
            title={t('welcome.fastLightweight')}
            description={t('welcome.fastDescription')}
          />
          <FeatureCard
            icon={Shield}
            title={t('welcome.secure')}
            description={t('welcome.secureDescription')}
          />
          <FeatureCard
            icon={BookOpen}
            title={t('welcome.fullControl')}
            description={t('welcome.fullControlDescription')}
          />
        </div>

        {/* Version Info */}
        <div className="text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span>Mini-Agent v0.1.0</span>
            <button
              onClick={copyVersion}
              className="p-1 hover:bg-accent rounded"
              title={t('welcome.copyVersion')}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://github.com/mini-agent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Github className="w-4 h-4" />
              {t('welcome.github')}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Keyboard Shortcut Hint */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            {t('welcome.keyboardHint').split('Ctrl+Shift+P')[0]}<kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+Shift+P</kbd>{t('welcome.keyboardHint').split('Ctrl+Shift+P')[1]}
          </p>
        </div>
      </div>
    </div>
  )
}

function QuickAction({ 
  icon: Icon, 
  label, 
  description 
}: { 
  icon: React.ElementType
  label: string 
  description: string 
}) {
  return (
    <button className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-center">
      <Icon className="w-6 h-6 text-primary" />
      <span className="font-medium text-sm">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: React.ElementType
  title: string 
  description: string 
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-card/50">
      <Icon className="w-5 h-5 text-primary mt-0.5" />
      <div>
        <h3 className="font-medium text-sm mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
