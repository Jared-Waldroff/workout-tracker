import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()
    const location = useLocation()
    const [checkingUsername, setCheckingUsername] = useState(true)
    const [hasUsername, setHasUsername] = useState(true)

    useEffect(() => {
        let isMounted = true

        const checkUsername = async () => {
            if (!user) {
                if (isMounted) setCheckingUsername(false)
                return
            }

            // Skip check if already on onboarding page
            if (location.pathname === '/onboarding') {
                if (isMounted) {
                    setCheckingUsername(false)
                    setHasUsername(true) // Don't redirect from onboarding
                }
                return
            }

            try {
                const { data, error } = await supabase
                    .from('athlete_profiles')
                    .select('username')
                    .eq('user_id', user.id)
                    .single()

                if (error) {
                    console.warn('Profile check error:', error.message)
                }

                if (isMounted) {
                    setHasUsername(!!data?.username)
                    setCheckingUsername(false)
                }
            } catch (err) {
                console.error('Profile check exception:', err)
                // No profile yet means no username
                if (isMounted) {
                    setHasUsername(false)
                    setCheckingUsername(false)
                }
            }
        }

        checkUsername()

        // Timeout fallback - if still checking after 5 seconds, assume profile issue
        const timeoutId = setTimeout(() => {
            if (isMounted && checkingUsername) {
                console.warn('Username check timed out - redirecting to onboarding')
                setHasUsername(false)
                setCheckingUsername(false)
            }
        }, 5000)

        return () => {
            isMounted = false
            clearTimeout(timeoutId)
        }
    }, [user, location.pathname])

    if (loading || checkingUsername) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-md">
                    <div className="spinner" />
                    <span className="text-secondary text-sm">Loading...</span>
                </div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    // Redirect to onboarding if user doesn't have a username
    if (!hasUsername && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />
    }

    return children
}

