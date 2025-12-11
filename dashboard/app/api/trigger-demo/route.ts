import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // In a real implementation, this would call the MCP server
    // For demo purposes, we'll simulate calling Kestra webhook

    const kestraWebhookUrl = process.env.NEXT_PUBLIC_KESTRA_URL || 'http://localhost:8080'
    const webhookUrl = `${kestraWebhookUrl}/api/v1/webhooks/incident-webhook`

    const demoIncident = {
      log: body.log || 'CRITICAL: Database connection pool exhausted - max_connections=100 exceeded',
      source: body.source || 'postgresql',
      timestamp: new Date().toISOString(),
      demo: true
    }

    // Call Kestra webhook to trigger the workflow
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(demoIncident),
    })

    if (!response.ok) {
      throw new Error(`Kestra webhook call failed: ${response.status}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Demo incident triggered successfully',
      incident: demoIncident
    })

  } catch (error) {
    console.error('Demo trigger error:', error)

    // Fallback: return success anyway for demo purposes
    return NextResponse.json({
      success: true,
      message: 'Demo incident simulated (Kestra not available)',
      note: 'This is a fallback response for demo purposes when Kestra is not running'
    })
  }
}
