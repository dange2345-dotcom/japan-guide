import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from './config'

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        // «Планер» живёт на том же адресе (github.io) и в том же проекте Supabase — свой ключ хранения,
        // чтобы вход и выход здесь не задевали сессию «Планера».
        storageKey: 'jp-auth',
        persistSession: true,
        autoRefreshToken: true,
        // Вход только по паролю: ссылки из писем на iOS открываются в Safari, а не в приложении.
        detectSessionInUrl: false,
      },
    })
  : null
