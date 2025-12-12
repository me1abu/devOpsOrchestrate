'use client'

import { useState, useEffect } from 'react'
import { Play, AlertTriangle, CheckCircle, Clock, Zap, Activity, Github } from 'lucide-react'

// Types
interface Incident {
  id: string
  status: 'pending' | 'processing' | 'fixed' | 'failed' | 'needs_review'
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'database' | 'network' | 'memory' | 'disk' | 'auth' | 'application'
  summary: string
  description: string
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

// Components
function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-950 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Self-Healing DevOps Orchestrator</h1>
          <p className="text-gray-400">Autonomous incident detection and resolution</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-300">System Healthy</span>
          </div>
          <button className="btn-primary">
            Trigger Demo
          </button>
        </div>
      </div>
    </header>
  )
}

function SystemHealthBanner() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="font-medium">All Systems Operational</span>
          </div>
          <div className="text-sm text-gray-400">
            Last incident resolved: 2 hours ago
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>Auto-fix rate: 87%</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Avg response: 45s</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LiveLogStream() {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: '14:32:15',
      level: 'info',
      message: 'Kestra workflow initiated - incident analysis starting...',
      source: 'orchestrator'
    },
    {
      id: '2',
      timestamp: '14:32:16',
      level: 'info',
      message: 'AI analysis completed: CRITICAL database connection pool exhausted',
      source: 'kestra'
    },
    {
      id: '3',
      timestamp: '14:32:17',
      level: 'warn',
      message: 'Auto-fix workflow triggered for incident inc-12345',
      source: 'orchestrator'
    },
    {
      id: '4',
      timestamp: '14:32:20',
      level: 'info',
      message: 'Cline MCP server contacted - generating fix...',
      source: 'cline'
    },
    {
      id: '5',
      timestamp: '14:33:01',
      level: 'info',
      message: 'PR #47 created: Increase max_connections from 100 to 200',
      source: 'github'
    },
    {
      id: '6',
      timestamp: '14:33:05',
      level: 'info',
      message: 'CodeRabbit review: ✅ Approved (0 issues found)',
      source: 'coderabbit'
    }
  ])

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
      default: return '📝'
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Live Activity Stream</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-400">Live</span>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {logs.slice(-10).map((log) => (
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
        ))}
      </div>
    </div>
  )
}

function StatsCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
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
      case 'processing': return <Activity className="w-4 h-4 text-blue-400" />
      case 'pending': return <Clock className="w-4 h-4 text-yellow-400" />
      case 'failed': return <AlertTriangle className="w-4 h-4 text-red-400" />
      default: return <AlertTriangle className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getStatusIcon(incident.status)}
          <span className="text-sm font-medium text-white">{incident.summary}</span>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(incident.severity)}`}>
          {incident.severity.toUpperCase()}
        </span>
      </div>

      <div className="text-sm text-gray-400 mb-2">{incident.description}</div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{incident.category}</span>
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

function DemoTriggerPanel() {
  const [isTriggering, setIsTriggering] = useState(false)

  const triggerDemo = async () => {
    setIsTriggering(true)
    try {
      const response = await fetch('/api/trigger-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log: 'CRITICAL: Database connection pool exhausted - max_connections=100 exceeded',
          source: 'postgresql'
        })
      })

      if (response.ok) {
        console.log('Demo triggered successfully')
      }
    } catch (error) {
      console.error('Failed to trigger demo:', error)
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-medium mb-4">Demo Controls</h3>

      <div className="space-y-3">
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
          This will simulate a critical database incident
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([])

  // Mock incidents for demo
  useEffect(() => {
    setIncidents([
      {
        id: 'inc-12345',
        status: 'fixed',
        severity: 'critical',
        category: 'database',
        summary: 'Database connection pool exhausted',
        description: 'PostgreSQL connection pool reached max_connections=100, causing service degradation',
        pr_url: 'https://github.com/me1abu/self-healing-demo-target/pull/47',
        pr_number: 47,
        created_at: new Date(Date.now() - 120000).toISOString(),
        fixed_at: new Date().toISOString(),
      },
      {
        id: 'inc-12346',
        status: 'processing',
        severity: 'high',
        category: 'memory',
        summary: 'High memory usage detected',
        description: 'Container memory usage exceeded 90% threshold',
        created_at: new Date(Date.now() - 300000).toISOString(),
      }
    ])
  }, [])

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />

      <main className="container mx-auto p-6">
        <SystemHealthBanner />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Live Activity Feed */}
          <div className="lg:col-span-8">
            <div className="card">
              <LiveLogStream />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="lg:col-span-4 space-y-4">
            <StatsCard title="Incidents Today" value="3" />
            <StatsCard title="Auto-Fixed" value="3" subtitle="100%" />
            <StatsCard title="Avg Fix Time" value="42s" />
          </div>

          {/* Active Incidents */}
          <div className="lg:col-span-8">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Active Incidents</h3>
                <span className="text-sm text-gray-400">{incidents.length} total</span>
              </div>

              <div className="space-y-4">
                {incidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            </div>
          </div>

          {/* Demo Controls */}
          <div className="lg:col-span-4">
            <DemoTriggerPanel />
          </div>
        </div>
      </main>
    </div>
  )
}
