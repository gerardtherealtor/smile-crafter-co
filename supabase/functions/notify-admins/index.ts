// Sends a transactional email to every active admin user.
// Looks up admin emails server-side (using service role) so the client
// never needs to know who the admins are.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface Body {
  templateName: string
  templateData?: Record<string, unknown>
  idempotencyKey: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { templateName, templateData, idempotencyKey } = body
  if (!templateName || !idempotencyKey) {
    return new Response(JSON.stringify({ error: 'templateName and idempotencyKey are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Look up active admin emails
  const { data: admins, error: adminErr } = await supabase
    .from('user_roles')
    .select('user_id, profiles:profiles!inner(email, is_active)')
    .eq('role', 'admin')

  if (adminErr) {
    console.error('Failed to load admins', adminErr)
    return new Response(JSON.stringify({ error: 'Failed to load admins' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  type Row = { user_id: string; profiles: { email: string; is_active: boolean } | null }
  const recipients = ((admins ?? []) as unknown as Row[])
    .filter((r) => r.profiles?.is_active && r.profiles.email)
    .map((r) => r.profiles!.email.toLowerCase())

  const unique = Array.from(new Set(recipients))
  if (unique.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, note: 'No admin recipients' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const results: { email: string; ok: boolean; error?: string }[] = []
  for (const email of unique) {
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName,
        recipientEmail: email,
        idempotencyKey: `${idempotencyKey}::${email}`,
        templateData: templateData ?? {},
      },
    })
    results.push({ email, ok: !error, error: error?.message })
  }

  return new Response(JSON.stringify({ ok: true, sent: results.filter((r) => r.ok).length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
