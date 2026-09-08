import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is required');
}

// Neither client ever subscribes to Realtime, but supabase-js constructs a
// RealtimeClient unconditionally, and on the Lambda Node 20 runtime (no
// native WebSocket — that's Node 22+) that constructor throws synchronously,
// crashing every cold start. Supplying `ws` as the transport is the fix
// supabase-js itself points to; it's never actually opened.
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: ws },
    })
  : null;

export const supabaseAnon = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '', {
  realtime: { transport: ws },
});
