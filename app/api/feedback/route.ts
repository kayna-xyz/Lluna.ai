import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

type FeedbackBody = {
  feedback?: string
  clinicName?: string | null
  clinicEmail?: string | null
  clinicPhone?: string | null
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as FeedbackBody & Record<string, unknown>
  const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : ''
  if (!feedback) {
    return Response.json({ error: 'feedback required' }, { status: 400 })
  }

  const payload = {
    feedback,
    clinicName: body.clinicName ?? null,
    clinicEmail: body.clinicEmail ?? null,
    clinicPhone: body.clinicPhone ?? null,
    submittedAt: new Date().toISOString(),
  }

  const supabase = getServiceSupabase()
  if (supabase) {
    const tenant = await resolveClinicForRequest(supabase, req, body)
    if (tenant.ok) {
      const { error } = await supabase.from('consultant_events').insert({
        clinic_id: tenant.clinic.id,
        event_type: 'clinic_feedback_submitted',
        target_screen: 'activities',
        payload,
      })
      if (error) {
        console.error('feedback event save error:', error)
      }
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const toEmail = process.env.FEEDBACK_TO_EMAIL
  const fromEmail = process.env.FEEDBACK_FROM_EMAIL || 'onboarding@resend.dev'
  let emailed = false

  if (resendApiKey && toEmail) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: 'New Lluna clinic feedback',
          text: [
            `Clinic: ${payload.clinicName || 'N/A'}`,
            `Email: ${payload.clinicEmail || 'N/A'}`,
            `Phone: ${payload.clinicPhone || 'N/A'}`,
            '',
            payload.feedback,
          ].join('\n'),
        }),
      })
      emailed = res.ok
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('feedback email send failed:', text)
      }
    } catch (e) {
      console.error('feedback email request failed:', e)
    }
  }

  return Response.json({
    ok: true,
    emailed,
    emailConfigured: Boolean(resendApiKey && toEmail),
  })
}

