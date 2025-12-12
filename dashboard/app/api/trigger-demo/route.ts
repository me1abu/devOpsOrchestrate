import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Trigger Kestra workflow webhook to start the full orchestration process
    // This ensures AI analysis, routing, and proper incident management
    const kestraUrl = process.env.NEXT_PUBLIC_KESTRA_URL || 'http://localhost:8080'
    const webhookUrl = `${kestraUrl}/api/v1/webhooks/incident-webhook`

    const demoIncident = {
      log_source: 'dashboard-demo',
      raw_log: body.log || 'CRITICAL: Database connection pool exhausted - max_connections=100 exceeded'
    }

    // Call Kestra webhook to trigger the main orchestrator workflow
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(demoIncident),
    })

    // Check if response is successful
    const isSuccess = response.ok

    let responseData
    try {
      responseData = await response.json()
    } catch (parseError) {
      console.warn('Could not parse Kestra response as JSON:', parseError)
      responseData = { error: 'Failed to parse response' }
    }

    // Always return success for demo purposes, but log the actual result
    console.log('Kestra webhook response:', {
      status: response.status,
      success: isSuccess,
      data: responseData
    })

    return NextResponse.json({
      success: true,
      message: isSuccess
        ? 'Demo incident triggered via Kestra orchestration successfully'
        : 'Demo incident simulated (Kestra workflow may not be running)',
      incident: demoIncident,
      kestra_response: {
        status: response.status,
        success: isSuccess,
        data: responseData
      },
      note: isSuccess
        ? 'Full AI analysis and routing workflow triggered'
        : 'This is a fallback response - check Kestra status'
    })

  } catch (error) {
    console.error('Demo trigger error:', error)

    // Fallback: return success anyway for demo purposes
    const demoIncident = {
      log_source: 'dashboard-demo',
      raw_log: body.log || 'CRITICAL: Database connection pool exhausted - max_connections=100 exceeded',
      fallback: true
    }

    return NextResponse.json({
      success: true,
      message: 'Demo incident simulated (Kestra connection failed)',
      note: 'This is a fallback response for demo purposes when Kestra is not accessible. Check docker-compose status.',
      incident: demoIncident,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
