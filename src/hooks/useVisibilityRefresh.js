import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Hook that handles app visibility changes and reconnects Supabase.
 * This fixes the issue where the app gets stuck loading after phone locks.
 * 
 * @param {Function} onRefresh - Callback to run when app becomes visible
 * @param {boolean} enabled - Whether the hook is active (default: true)
 */
export function useVisibilityRefresh(onRefresh, enabled = true) {
    const lastRefreshRef = useRef(Date.now())
    const isRefreshingRef = useRef(false)

    const handleVisibilityChange = useCallback(async () => {
        if (document.visibilityState !== 'visible') return
        if (!enabled) return
        if (isRefreshingRef.current) return

        // Debounce: only refresh if >2 seconds since last refresh
        const now = Date.now()
        if (now - lastRefreshRef.current < 2000) return

        lastRefreshRef.current = now
        isRefreshingRef.current = true

        console.log('App became visible - refreshing connection...')

        try {
            // First, refresh the Supabase session to ensure connection is alive
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()

            if (sessionError) {
                console.error('Session check error:', sessionError)
            }

            if (session) {
                // Force a session refresh to wake up the connection
                await supabase.auth.refreshSession()
                console.log('Session refreshed successfully')
            }

            // Small delay to let the connection stabilize
            await new Promise(resolve => setTimeout(resolve, 100))

            // Now trigger the data refresh with a timeout
            if (onRefresh) {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Refresh timed out')), 8000)
                })

                try {
                    await Promise.race([
                        onRefresh(),
                        timeoutPromise
                    ])
                    console.log('Data refresh completed')
                } catch (refreshError) {
                    console.error('Data refresh failed:', refreshError)
                    // Try once more after a short delay
                    await new Promise(resolve => setTimeout(resolve, 500))
                    try {
                        await onRefresh()
                        console.log('Retry refresh succeeded')
                    } catch (retryError) {
                        console.error('Retry also failed:', retryError)
                    }
                }
            }
        } catch (error) {
            console.error('Visibility refresh error:', error)
        } finally {
            isRefreshingRef.current = false
        }
    }, [onRefresh, enabled])

    useEffect(() => {
        if (!enabled) return

        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Also handle page focus for additional coverage
        window.addEventListener('focus', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleVisibilityChange)
        }
    }, [handleVisibilityChange, enabled])
}
