import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  document.body.innerHTML = `<div style="font-family:sans-serif;padding:2rem;color:#b91c1c;background:#fef2f2;min-height:100vh">
    <h2>⚠️ Konfigurasie Fout</h2>
    <p>VITE_SUPABASE_URL is nie gestel nie. Gaan na Vercel → Environment Variables en stel dit in.</p>
    <code style="font-size:0.8rem">${supabaseUrl ?? '(leeg)'}</code>
  </div>`
  throw new Error('Missing VITE_SUPABASE_URL')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
