import { createClient } from '@supabase/supabase-js'

// The URL and publishable key are designed to be public — security is enforced by the
// database's row-level rules (supabase/schema.sql), not by hiding these.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://susecnvepvwmqhziferf.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_BrmA2y4zsAablFTqNCWvPA_thOHgiGf'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
