import { createClient } from '@supabase/supabase-js'

// Use variáveis de ambiente (.env) para maior segurança
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
