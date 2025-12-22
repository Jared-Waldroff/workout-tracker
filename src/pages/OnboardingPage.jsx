import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import './OnboardingPage.css'

export default function OnboardingPage() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [username, setUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const validateUsername = (value) => {
        if (!value) return 'Username is required'
        if (value.length < 3) return 'Username must be at least 3 characters'
        if (value.length > 20) return 'Username must be 20 characters or less'
        if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores'
        return ''
    }

    const handleUsernameChange = (e) => {
        const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
        setUsername(value)
        setError('')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        const validationError = validateUsername(username)
        if (validationError) {
            setError(validationError)
            return
        }

        setLoading(true)
        setError('')

        try {
            // Check if username is available
            const { data: existingUser } = await supabase
                .from('athlete_profiles')
                .select('username')
                .eq('username', username)
                .single()

            if (existingUser) {
                setError('Username already taken')
                setLoading(false)
                return
            }

            // Update or insert profile with username
            const { error: updateError } = await supabase
                .from('athlete_profiles')
                .upsert({
                    user_id: user.id,
                    username: username
                }, { onConflict: 'user_id' })

            if (updateError) throw updateError

            // Success - redirect to home
            navigate('/', { replace: true })
        } catch (err) {
            setError(err.message || 'Failed to save username')
            setLoading(false)
        }
    }

    return (
        <div className="onboarding-page">
            <div className="onboarding-container glass animate-scaleIn">
                <div className="onboarding-header">
                    <div className="onboarding-emoji">👋</div>
                    <h1>Welcome to Hybrid!</h1>
                    <p>Choose a username for your profile</p>
                </div>

                <form onSubmit={handleSubmit} className="onboarding-form">
                    <div className="input-group">
                        <label className="input-label">Username</label>
                        <div className="username-input-wrapper">
                            <span className="username-prefix">@</span>
                            <input
                                type="text"
                                className="input"
                                placeholder="your_username"
                                value={username}
                                onChange={handleUsernameChange}
                                required
                                maxLength={20}
                                autoFocus
                            />
                        </div>
                        <span className="username-hint">
                            Others can find you by @{username || 'username'}
                        </span>
                    </div>

                    {error && (
                        <p className="onboarding-error">{error}</p>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg w-full"
                        disabled={loading || !username}
                    >
                        {loading ? (
                            <span className="spinner" />
                        ) : (
                            'Continue'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
