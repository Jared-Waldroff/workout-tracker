import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Get initial session with timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
            console.warn('Auth session check timed out - proceeding without session')
            setUser(null)
            setLoading(false)
        }, 5000)

        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                clearTimeout(timeoutId)
                console.log('Session check complete:', session ? 'logged in' : 'no session')
                setUser(session?.user ?? null)
                setLoading(false)
            })
            .catch((error) => {
                clearTimeout(timeoutId)
                console.error('Failed to get session:', error)
                setUser(null)
                setLoading(false)
            })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('Auth state changed:', event, session?.user?.email)
                setUser(session?.user ?? null)

                // Create user preferences if new sign up - wrapped in try/catch
                if (event === 'SIGNED_IN' && session?.user) {
                    try {
                        const { data: existingPrefs } = await supabase
                            .from('user_preferences')
                            .select('id')
                            .eq('user_id', session.user.id)
                            .single()

                        if (!existingPrefs) {
                            await supabase.from('user_preferences').insert({
                                user_id: session.user.id,
                                theme: 'dark',
                                accent_color: '#1e3a5f',
                                secondary_color: '#c9a227'
                            })
                        }
                    } catch (err) {
                        // Don't let preference creation errors break auth flow
                        console.warn('Could not create user preferences:', err.message)
                    }
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    const signUp = async (email, password, username) => {
        // First check if username is available
        const { data: existingUser } = await supabase
            .from('athlete_profiles')
            .select('username')
            .eq('username', username.toLowerCase())
            .single()

        if (existingUser) {
            return { data: null, error: { message: 'Username already taken' } }
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password
        })

        if (error) return { data, error }

        // Create athlete profile with username
        if (data?.user) {
            const { error: profileError } = await supabase
                .from('athlete_profiles')
                .upsert({
                    user_id: data.user.id,
                    username: username.toLowerCase()
                }, { onConflict: 'user_id' })

            if (profileError) {
                console.error('Error creating profile:', profileError)
            }
        }

        return { data, error }
    }

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        return { data, error }
    }

    const signOut = async () => {
        const { error } = await supabase.auth.signOut()
        return { error }
    }

    const resetPassword = async (email) => {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email)
        return { data, error }
    }

    const signInWithGoogle = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/`
            }
        })
        return { data, error }
    }

    const value = {
        user,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        signInWithGoogle
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
