'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, AlertTriangle, CheckCircle, Clock, Zap, Activity, Github, RefreshCw } from 'lucide-react'

// Types
interface Incident {
  id: string
  status: 'pending' | 'processing' | 'fixed' | 'failed' | 'needs_review'
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'database' | 'network' | 'memory' | 'disk' | 'auth' | 'application'
  summary: string
  description?: string
  suggested_fix?: string
  affected_file?: string
  pr_url?: string
  pr_number?: number
  created_at: string
  fixed_at?: string
}

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
  source: string
}

interface Stats {
  incidentsToday: number
  autoFixed: number
  avgFixTime: number
  autoFixRate: number
}

// Configuration
const MCP_SERVER_URL = process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3001'

// Components
function Header({ systemStatus, onRefresh }: { systemStatus: string; onRefresh: () => void }) {
  return (
    <header className="border-b border-gray-800 bg-gray-950 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Self-Healing DevOps Orchestrator</h1>
          <p className="text-gray-400">Autonomous incident detection and resolution</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              systemStatus === 'healthy' ? 'bg-green-500' :
              systemStatus === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-300">
              {systemStatus === 'healthy' ? 'System Healthy' :
               systemStatus === 'degraded' ? 'System Degraded' : 'System Critical'}
            </span>
          </div>
          <button onClick={onRefresh} className="btn-secondary p-2" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

function SystemHealthBanner({ stats, lastIncidentTime }: { stats: Stats; lastIncidentTime: string | null }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="font-medium">All Systems Operational</span>
          </div>
          <div className="text-sm text-gray-400">
            {lastIncidentTime
              ? `Last incident resolved: ${lastIncidentTime}`
              : 'No recent incidents'}
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>Auto-fix rate: {stats.autoFixRate}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Avg response: {stats.avgFixTime}s</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LiveLogStream({ logs, isConnected }: { logs: LogEntry[]; isConnected: boolean }) {
  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400'
      case 'warn': return 'text-yellow-400'
      case 'info': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'kestra': return '🔄'
      case 'cline': return '🤖'
      case 'github': return '🐙'
      case 'coderabbit': return '🐰'
      case 'mcp-server': return '🔌'
      case 'monitor': return '👁️'
      default: return '📝'
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Live Activity Stream</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-400">{isConnected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No activity yet. Trigger a demo incident or wait for real incidents.
          </div>
        ) : (
          logs.slice(-15).map((log) => (
            <div key={log.id} className="flex items-start space-x-3 p-2 rounded bg-gray-800/50">
              <span className="text-xs mt-0.5">{getSourceIcon(log.source)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono ${getLogColor(log.level)}`}>
                    {log.timestamp}
                  </span>
                  <span className="text-xs text-gray-500 uppercase">{log.source}</span>
                </div>
                <p className="text-sm text-gray-300 mt-1">{log.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StatsCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400">{title}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  )
}

function IncidentCard({ incident }: { incident: Incident }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-900/20 border-red-800'
      case 'high': return 'text-yellow-400 bg-yellow-900/20 border-yellow-800'
      case 'medium': return 'text-blue-400 bg-blue-900/20 border-blue-800'
      case 'low': return 'text-gray-400 bg-gray-900/20 border-gray-800'
      default: return 'text-gray-400 bg-gray-900/20 border-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fixed': return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'processing': return <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
      case 'pending': return <Clock className="w-4 h-4 text-yellow-400" />
      case 'failed': return <AlertTriangle className="w-4 h-4 text-red-400" />
      default: return <AlertTriangle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'fixed': return 'Fixed'
      case 'processing': return 'Processing...'
      case 'pending': return 'Pending'
      case 'failed': return 'Failed'
      case 'needs_review': return 'Needs Review'
      default: return status
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getStatusIcon(incident.status)}
          <span className="text-sm font-medium text-white">{incident.summary}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">{getStatusText(incident.status)}</span>
          <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(incident.severity)}`}>
            {incident.severity.toUpperCase()}
          </span>
        </div>
      </div>

      {incident.description && (
        <div className="text-sm text-gray-400 mb-2">{incident.description}</div>
      )}

      {incident.suggested_fix && (
        <div className="text-sm text-green-400 mb-2">
          <span className="text-gray-500">Suggested fix:</span> {incident.suggested_fix}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-2">
          <span className="capitalize">{incident.category}</span>
          {incident.affected_file && (
            <>
              <span>•</span>
              <span className="font-mono">{incident.affected_file}</span>
            </>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span>{new Date(incident.created_at).toLocaleTimeString()}</span>
          {incident.pr_url && (
            <a
              href={incident.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-blue-400 hover:text-blue-300"
            >
              <Github className="w-3 h-3" />
              <span>PR #{incident.pr_number}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function DemoTriggerPanel({ onTrigger }: { onTrigger: (scenario: string) => void }) {
  const [isTriggering, setIsTriggering] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState('database_connection_pool')

  const scenarios = [
    { id: 'database_connection_pool', name: 'Database Connection Pool Exhausted', severity: 'critical' },
    { id: 'memory_exhaustion', name: 'Memory Exhaustion', severity: 'critical' },
    { id: 'disk_space', name: 'Disk Space Warning', severity: 'high' },
    { id: 'auth_failures', name: 'Authentication Failures', severity: 'high' },
    { id: 'network_timeout', name: 'Network Timeout', severity: 'medium' },
    { id: 'ssl_certificate', name: 'SSL Certificate Expiring', severity: 'medium' },
  ]

  const triggerDemo = async () => {
    setIsTriggering(true)
    try {
      await onTrigger(selectedScenario)
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-medium mb-4">Demo Controls</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Select Scenario</label>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.severity})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={triggerDemo}
          disabled={isTriggering}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTriggering ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Triggering Incident...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Trigger Demo Incident</span>
            </div>
          )}
        </button>

        <div className="text-xs text-gray-400 text-center">
          This will send a simulated incident to the orchestration pipeline
        </div>
      </div>
    </div>
  )
}

function ConnectionStatus({ isConnected, error }: { isConnected: boolean; error: string | null }) {
  if (isConnected) return null

  return (
    <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
      <div className="flex items-center space-x-2 text-red-400">
        <AlertTriangle className="w-5 h-5" />
        <span className="font-medium">Connection Issue</span>
      </div>
      <p className="text-sm text-red-300 mt-1">
        {error || `Unable to connect to MCP server at ${MCP_SERVER_URL}. Make sure it's running.`}
      </p>
    </div>
  )
}

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<Stats>({
    incidentsToday: 0,
    autoFixed: 0,
    avgFixTime: 0,
    autoFixRate: 0
  })
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'degraded' | 'critical'>('healthy')

  // Add log entry
  const addLog = useCallback((level: 'info' | 'warn' | 'error', message: string, source: string) => {
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      source
    }
    setLogs(prev => [...prev.slice(-50), newLog])
  }, [])

  // Fetch incidents from MCP server
  const fetchIncidents = useCallback(async () => {
    try {
      console.log('Attempting to fetch incidents from:', MCP_SERVER_URL)
      const response = await fetch(`${MCP_SERVER_URL}/incidents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY || ''
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setIncidents(data.incidents || [])
      setIsConnected(true)
      setConnectionError(null)

      // Calculate stats
      const today = new Date().toDateString()
      const todayIncidents = (data.incidents || []).filter(
        (i: Incident) => new Date(i.created_at).toDateString() === today
      )
      const fixed = todayIncidents.filter((i: Incident) => i.status === 'fixed')

      setStats({
        incidentsToday: todayIncidents.length,
        autoFixed: fixed.length,
        avgFixTime: fixed.length > 0 ? 42 : 0, // TODO: Calculate from actual data
        autoFixRate: todayIncidents.length > 0
          ? Math.round((fixed.length / todayIncidents.length) * 100)
          : 100
      })

      // Update system status based on incidents
      const criticalActive = (data.incidents || []).some(
        (i: Incident) => i.severity === 'critical' && i.status !== 'fixed'
      )
      const highActive = (data.incidents || []).some(
        (i: Incident) => i.severity === 'high' && i.status !== 'fixed'
      )

      if (criticalActive) {
        setSystemStatus('critical')
      } else if (highActive) {
        setSystemStatus('degraded')
      } else {
        setSystemStatus('healthy')
      }

    } catch (error) {
      console.error('Failed to fetch incidents:', error)
      setIsConnected(false)
      setConnectionError(error instanceof Error ? error.message : 'Unknown error')
    }
  }, [])

  // Connect to SSE for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null

    const connectSSE = () => {
      try {
        eventSource = new EventSource(`${MCP_SERVER_URL}/events`)

        eventSource.onopen = () => {
          setIsConnected(true)
          setConnectionError(null)
          addLog('info', 'Connected to real-time event stream', 'dashboard')
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            if (data.type === 'incident_created') {
              setIncidents(prev => [data.incident, ...prev])
              addLog('warn', `New incident: ${data.incident.summary}`, 'mcp-server')
            } else if (data.type === 'incident_updated') {
              setIncidents(prev =>
                prev.map(i => i.id === data.incident.id ? data.incident : i)
              )
              addLog('info', `Incident ${data.incident.id} updated: ${data.incident.status}`, 'mcp-server')
            } else if (data.type === 'log') {
              addLog(data.level || 'info', data.message, data.source || 'system')
            }
          } catch (e) {
            console.error('Failed to parse SSE message:', e)
          }
        }

        eventSource.onerror = () => {
          setIsConnected(false)
          eventSource?.close()
          // Reconnect after 5 seconds
          setTimeout(connectSSE, 5000)
        }
      } catch (error) {
        console.error('Failed to connect SSE:', error)
        setIsConnected(false)
      }
    }

    // Initial fetch
    fetchIncidents()

    // Try SSE connection
    connectSSE()

    // Fallback polling if SSE fails
    const pollInterval = setInterval(fetchIncidents, 10000)

    return () => {
      eventSource?.close()
      clearInterval(pollInterval)
    }
  }, [fetchIncidents, addLog])

  // Trigger demo incident
  const handleTriggerDemo = async (scenario: string) => {
    addLog('info', `Triggering demo scenario: ${scenario}`, 'dashboard')

    try {
      // Try Kestra webhook first
      const kestraResponse = await fetch('/api/trigger-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      })

      if (kestraResponse.ok) {
        addLog('info', 'Demo incident sent to Kestra orchestrator', 'dashboard')
      } else {
        // Fallback: Create incident directly in MCP server
        const mcpResponse = await fetch(`${MCP_SERVER_URL}/incidents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.NEXT_PUBLIC_API_KEY || ''
          },
          body: JSON.stringify({
            severity: scenario.includes('critical') ? 'critical' : 'high',
            category: scenario.includes('database') ? 'database' :
                     scenario.includes('memory') ? 'memory' :
                     scenario.includes('disk') ? 'disk' :
                     scenario.includes('auth') ? 'auth' :
                     scenario.includes('network') ? 'network' : 'application',
            summary: `Demo: ${scenario.replace(/_/g, ' ')}`,
            description: `This is a demo incident triggered from the dashboard`,
            suggested_fix: 'Check the relevant configuration and apply the suggested changes',
            source: 'demo-dashboard'
          })
        })

        if (mcpResponse.ok) {
          addLog('info', 'Demo incident created directly in MCP server', 'dashboard')
          fetchIncidents()
        } else {
          throw new Error('Both Kestra and MCP server requests failed')
        }
      }
    } catch (error) {
      addLog('error', `Failed to trigger demo: ${error}`, 'dashboard')
    }
  }

  const lastFixedIncident = incidents.find(i => i.status === 'fixed' && i.fixed_at)
  const lastIncidentTime = lastFixedIncident
    ? getRelativeTime(new Date(lastFixedIncident.fixed_at!))
    : null

  return (
    <div className="min-h-screen bg-gray-950">
      <Header systemStatus={systemStatus} onRefresh={fetchIncidents} />

      <main className="container mx-auto p-6">
        <ConnectionStatus isConnected={isConnected} error={connectionError} />
        <SystemHealthBanner stats={stats} lastIncidentTime={lastIncidentTime} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Live Activity Feed */}
          <div className="lg:col-span-8">
            <div className="card">
              <LiveLogStream logs={logs} isConnected={isConnected} />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="lg:col-span-4 space-y-4">
            <StatsCard title="Incidents Today" value={stats.incidentsToday} />
            <StatsCard
              title="Auto-Fixed"
              value={stats.autoFixed}
              subtitle={`${stats.autoFixRate}%`}
            />
            <StatsCard title="Avg Fix Time" value={`${stats.avgFixTime}s`} />
          </div>

          {/* Active Incidents */}
          <div className="lg:col-span-8">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Incidents</h3>
                <span className="text-sm text-gray-400">{incidents.length} total</span>
              </div>

              <div className="space-y-4">
                {incidents.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No incidents recorded. System is healthy!
                  </div>
                ) : (
                  incidents.slice(0, 10).map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Demo Controls */}
          <div className="lg:col-span-4">
            <DemoTriggerPanel onTrigger={handleTriggerDemo} />
          </div>
        </div>
      </main>
    </div>
  )
}

// Helper function for relative time
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}
