import { NextRequest, NextResponse } from 'next/server'

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

// In-memory storage for demo (use Redis/database in production)
const incidents = new Map<string, Incident>()
const notifications: any[] = []

export async function POST(request: NextRequest) {
  try {
    const webhookData = await request.json()

    console.log('Received Kestra webhook:', webhookData)

    // Process different webhook event types
    switch (webhookData.type) {
      case 'incident_processed': {
        // Update incident with Kestra processing results
        const incident: Incident = {
          id: webhookData.incident_id || `inc-${Date.now()}`,
          status: webhookData.status === 'auto-fix-triggered' ? 'processing' : 'pending',
          severity: webhookData.severity || 'medium',
          category: 'application',
          summary: webhookData.summary || 'Incident processed',
          description: `Automated processing complete. Check logs for details.`,
          created_at: new Date().toISOString(),
        }

        incidents.set(incident.id, incident)
        console.log('Updated incident status:', incident)
        break
      }

      case 'fix_completed': {
        // Update incident with fix results
        const existingIncident = incidents.get(webhookData.incident_id)
        if (existingIncident) {
          existingIncident.status = webhookData.success ? 'fixed' : 'failed'
          existingIncident.pr_url = webhookData.pr_url
          existingIncident.fixed_at = new Date().toISOString()
          incidents.set(webhookData.incident_id, existingIncident)
          console.log('Updated fix status:', existingIncident)
        }
        break
      }

      case 'orchestration_error': {
        // Handle orchestration errors
        const incident: Incident = {
          id: `error-${Date.now()}`,
          status: 'failed',
          severity: 'high',
          category: 'application',
          summary: 'Orchestration Error',
          description: `Kestra workflow failed: ${webhookData.error_message}`,
          created_at: new Date().toISOString(),
        }

        incidents.set(incident.id, incident)
        console.error('Orchestration error received:', webhookData)
        break
      }

      default:
        console.log('Unknown webhook event type:', webhookData.type)
    }

    // Store notification for real-time updates
    notifications.push({
      ...webhookData,
      timestamp: new Date().toISOString(),
    })

    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.shift()
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      processed_type: webhookData.type
    })

  } catch (error) {
    console.error('Kestra webhook error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'incidents') {
      return NextResponse.json(Array.from(incidents.values()))
    }

    if (type === 'notifications') {
      return NextResponse.json(notifications.slice(-20)) // Last 20 notifications
    }

    // Default: get all data
    return NextResponse.json({
      incidents: Array.from(incidents.values()),
      notifications: notifications.slice(-10),
      total_incidents: incidents.size,
      total_notifications: notifications.length
    })

  } catch (error) {
    console.error('Webhook GET error:', error)
    return NextResponse.json({
      error: 'Failed to fetch webhook data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
