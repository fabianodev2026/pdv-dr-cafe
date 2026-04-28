import { createClient } from '@supabase/supabase-js'

// Use as chaves 'anon' e a 'URL' do seu projeto
const supabaseUrl = 'https://ydgiskcczqvihzrunejd.supabase.co'
const supabaseAnonKey = 'sb_publishable_6CiaWnKO5H9yUjjapr5gtw_mbt9cqrq'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
