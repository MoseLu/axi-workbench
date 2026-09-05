/**
 * System Monitor Component
 * Displays performance metrics and error logs
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'

interface Metrics {
  timestamp: string
  cpu_percent: number
  memory_mb: number
  memory_percent: number
  active_sessions: number
  total_requests: number
  avg_response_time_ms: number
}

interface ErrorRecord {
  timestamp: string
  error_type: string
  message: string
  stack_trace?: string
  session_id?: string
}

interface SystemMonitorProps {
  onClose?: () => void
}

export function SystemMonitor({ onClose }: SystemMonitorProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [errors, setErrors] = useState<ErrorRecord[]>([])
  const [uptime, setUptime] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<'metrics' | 'errors'>('metrics')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [metricsData, errorsData, uptimeData] = await Promise.all([
        api.getMetrics(),
        api.getErrors(20),
        api.getUptime(),
      ])
      setMetrics(metricsData)
      setErrors(errorsData.errors)
      setUptime(uptimeData.uptime_seconds)
    } catch (err) {
      console.error('Failed to fetch system data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours}h ${minutes}m ${secs}s`
  }

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-gray-100">System Monitor</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            Uptime: {formatUptime(uptime)}
          </span>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'metrics'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Metrics
        </button>
        <button
          onClick={() => setActiveTab('errors')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'errors'
              ? 'text-red-400 border-b-2 border-red-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Errors {errors.length > 0 && `(${errors.length})`}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'metrics' && metrics && (
          <div className="grid grid-cols-2 gap-4">
            {/* CPU */}
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">CPU Usage</div>
              <div className="text-2xl font-bold text-blue-400">
                {metrics.cpu_percent.toFixed(1)}%
              </div>
              <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${Math.min(metrics.cpu_percent, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory */}
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Memory Usage</div>
              <div className="text-2xl font-bold text-green-400">
                {metrics.memory_mb.toFixed(1)} MB
              </div>
              <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${Math.min(metrics.memory_percent, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {metrics.memory_percent.toFixed(1)}% of available
              </div>
            </div>

            {/* Sessions */}
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Active Sessions</div>
              <div className="text-2xl font-bold text-purple-400">
                {metrics.active_sessions}
              </div>
            </div>

            {/* Requests */}
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Total Requests</div>
              <div className="text-2xl font-bold text-yellow-400">
                {metrics.total_requests}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Avg: {metrics.avg_response_time_ms.toFixed(0)}ms
              </div>
            </div>
          </div>
        )}

        {activeTab === 'errors' && (
          <div className="space-y-2">
            {errors.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No errors recorded
              </div>
            ) : (
              errors.map((error, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-400">
                      {error.error_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(error.timestamp)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300 mb-2">
                    {error.message}
                  </div>
                  {error.session_id && (
                    <div className="text-xs text-gray-500">
                      Session: {error.session_id}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SystemMonitor
