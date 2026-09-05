import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

interface UpdateInfo {
  available: boolean
  version?: string
  notes?: string
  downloading?: boolean
  error?: string
}

export function UpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)

  const checkForUpdates = async () => {
    setChecking(true)
    try {
      // Try to check for updates (requires updater endpoint configured)
      const update = await check()
      if (update) {
        setUpdateInfo({
          available: true,
          version: update.version,
          notes: update.body || 'New version available'
        })
      } else {
        setUpdateInfo({ available: false })
      }
    } catch (error) {
      // Updater endpoint not configured - this is expected in development
      console.log('Update check skipped (no endpoint configured):', error)
      setUpdateInfo({ 
        available: false,
        error: 'Update server not configured'
      })
    } finally {
      setChecking(false)
    }
  }

  const installUpdate = async () => {
    if (!updateInfo?.version) return
    
    try {
      setUpdateInfo(prev => prev ? { ...prev, downloading: true } : null)
      const update = await check()
      if (update) {
        await update.downloadAndInstall()
        await relaunch()
      }
    } catch (error) {
      console.error('Update failed:', error)
      setUpdateInfo(prev => prev ? { 
        ...prev, 
        downloading: false,
        error: 'Update failed. Please try again later.' 
      } : null)
    }
  }

  return {
    updateInfo,
    checking,
    checkForUpdates,
    installUpdate
  }
}

// Standalone update check button component
export function UpdateButton() {
  const { updateInfo, checking, checkForUpdates, installUpdate } = UpdateChecker()
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={checkForUpdates}
        disabled={checking}
        className="px-3 py-1 text-sm bg-primary/10 hover:bg-primary/20 rounded transition-colors"
        title="Check for updates"
      >
        {checking ? 'Checking...' : 'Check Updates'}
      </button>
      
      {updateInfo?.available && !updateInfo.downloading && (
        <button
          onClick={installUpdate}
          className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
        >
          Update to v{updateInfo.version}
        </button>
      )}
      
      {updateInfo?.error && (
        <span className="text-xs text-muted-foreground">
          {updateInfo.error}
        </span>
      )}
    </div>
  )
}
