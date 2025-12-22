import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!')
    console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'set' : 'MISSING')
    console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'set' : 'MISSING')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    // Disable realtime to prevent WebSocket errors on Safari iOS
    // Safari blocks WebSockets in certain security contexts (PWA, private browsing)
    realtime: {
        params: {
            eventsPerSecond: 0
        }
    },
    global: {
        headers: {
            'X-Client-Info': 'workout-tracker'
        }
    }
})

// Disable realtime channels completely
supabase.realtime.disconnect()

