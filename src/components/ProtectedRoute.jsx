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
        const checkUsername = async () => {
            if (!user) {
                setCheckingUsername(false)
                return
            }

            // Skip check if already on onboarding page
            if (location.pathname === '/onboarding') {
                setCheckingUsername(false)
                setHasUsername(true) // Don't redirect from onboarding
                return
            }

            try {
                const { data } = await supabase
                    .from('athlete_profiles')
                    .select('username')
                    .eq('user_id', user.id)
                    .single()

                setHasUsername(!!data?.username)
            } catch (err) {
                // No profile yet means no username
                setHasUsername(false)
            }
            setCheckingUsername(false)
        }

        checkUsername()
    }, [user, location.pathname])

    if (loading || checkingUsername) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="spinner" />
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
