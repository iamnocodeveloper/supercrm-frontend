import { supabase } from '@/integrations/supabase/client';

// Routes former direct calls to internal webhooks through the private backend.
// The actual endpoints and credentials live server-side; the browser only
// knows an action name. Returns a fetch-like Response so existing call sites
// keep their response handling unchanged.
export async function proxiedFetch(action: string, init: RequestInit = {}): Promise<Response> {
  let payload: unknown;
  if (typeof init.body === 'string' && init.body.length > 0) {
    try {
      payload = JSON.parse(init.body);
    } catch {
      payload = init.body;
    }
  }

  const { data, error } = await supabase.functions.invoke('n8n-proxy', {
    body: { action, payload },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = typeof data === 'string' ? data : JSON.stringify(data ?? null);
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
