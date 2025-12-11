import { NextRequest, NextResponse } from 'next/server'

// In-memory store for demo purposes
// In production, use a proper database or WebSocket connection
let activeIncidents: any[] = []

export async function POST(request: NextRequest) {
  try {
    const notification = await request.json()

    console.log('Received notification:', notification)

    // Store the incident if it's an incident update
    if (notification.type === 'incident_created' || notification.type === 'incident_updated') {
      const existingIndex = activeIncidents.findIndex(inc => inc.id === notification.incident.id)
      if (existingIndex >= 0) {
        activeIncidents[existingIndex] = notification.incident
      } else {
        activeIncidents.unshift(notification.incident)
      }

      // Keep only last 50 incidents
      activeIncidents = activeIncidents.slice(0, 50)
    }

    return NextResponse.json({
      success: true,
      message: 'Notification processed'
    })

  } catch (error) {
    console.error('Notification error:', error)
    return NextResponse.json(
      { error: 'Failed to process notification' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return current active incidents for the dashboard
  return NextResponse.json({
    incidents: activeIncidents,
    count: activeIncidents.length
  })
}
