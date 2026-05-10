import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type EmailJob = {
  id: number
  to_email: string
  subject: string
  text_body: string
  html_body: string
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'Dr. Cafe <noreply@dr-cafe.com.br>'

const supabase = createClient(supabaseUrl, serviceRoleKey)

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

Deno.serve(async () => {
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return jsonResponse(
      {
        ok: false,
        error: 'Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e RESEND_API_KEY.',
      },
      500,
    )
  }

  const { data: jobs, error } = await supabase
    .from('app_email_outbox')
    .select('id,to_email,subject,text_body,html_body')
    .eq('status', 'pendente')
    .order('created_at', { ascending: true })
    .limit(10)

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500)
  }

  const results = []

  for (const job of (jobs ?? []) as EmailJob[]) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${resendApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [job.to_email],
          subject: job.subject,
          html: job.html_body,
          text: job.text_body,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.message ?? `Erro Resend HTTP ${response.status}`)
      }

      await supabase
        .from('app_email_outbox')
        .update({
          status: 'enviado',
          sent_at: new Date().toISOString(),
          provider_message_id: payload?.id ?? null,
          error_message: null,
        })
        .eq('id', job.id)

      results.push({ id: job.id, status: 'enviado' })
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Erro desconhecido'
      await supabase
        .from('app_email_outbox')
        .update({
          status: 'erro',
          error_message: message,
        })
        .eq('id', job.id)

      results.push({ id: job.id, status: 'erro', error: message })
    }
  }

  return jsonResponse({ ok: true, processed: results.length, results })
})
