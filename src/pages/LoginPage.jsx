import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './LoginPage.css'

export default function LoginPage() {
    const { user, signIn, signUp, resetPassword, signInWithGoogle } = useAuth()
    const [isLogin, setIsLogin] = useState(true)
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    if (user) {
        return <Navigate to="/" replace />
    }

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
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setMessage('')

        // Username and password validation for signup
        if (!isLogin) {
            const usernameError = validateUsername(username)
            if (usernameError) {
                setError(usernameError)
                return
            }
            if (password !== confirmPassword) {
                setError('Passwords do not match')
                return
            }
            if (password.length < 6) {
                setError('Password must be at least 6 characters')
                return
            }
        }

        setLoading(true)

        try {
            if (isLogin) {
                const { error: signInError } = await signIn(email, password)
                if (signInError) throw signInError
            } else {
                const { error: signUpError } = await signUp(email, password, username)
                if (signUpError) throw signUpError
                setMessage('Check your email to confirm your account!')
            }
        } catch (err) {
            setError(err.message || 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Please enter your email address')
            return
        }

        setLoading(true)
        setError('')

        try {
            const { error: resetError } = await resetPassword(email)
            if (resetError) throw resetError
            setMessage('Password reset email sent!')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignIn = async () => {
        setLoading(true)
        setError('')
        try {
            const { error } = await signInWithGoogle()
            if (error) throw error
        } catch (err) {
            setError(err.message || 'Failed to sign in with Google')
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-container glass animate-scaleIn">
                <div className="login-header">
                    <div className="login-logo">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {/* Dumbbell bar */}
                            <path d="M4 12h16" />
                            {/* Left weight */}
                            <rect x="2" y="9" width="4" height="6" rx="1" />
                            {/* Right weight */}
                            <rect x="18" y="9" width="4" height="6" rx="1" />
                            {/* Motion lines representing cardio/movement */}
                            <path d="M8 6l2 2M16 6l-2 2" strokeLinecap="round" />
                            <path d="M8 18l2-2M16 18l-2-2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <h1 className="login-title">Hybrid</h1>
                    <p className="login-subtitle">
                        {isLogin ? 'Welcome back!' : 'Create your account'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <label className="input-label">Email</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    {!isLogin && (
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
                                />
                            </div>
                        </div>
                    )}

                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <input
                            type="password"
                            className="input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete={isLogin ? "current-password" : "new-password"}
                            minLength={6}
                        />
                    </div>

                    {!isLogin && (
                        <div className="input-group">
                            <label className="input-label">Confirm Password</label>
                            <input
                                type="password"
                                className="input"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                                minLength={6}
                            />
                        </div>
                    )}

                    {error && (
                        <p className="login-error">{error}</p>
                    )}

                    {message && (
                        <p className="login-success">{message}</p>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg w-full"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="spinner" />
                        ) : (
                            isLogin ? 'Sign In' : 'Create Account'
                        )}
                    </button>

                    {isLogin && (
                        <button
                            type="button"
                            className="btn btn-ghost w-full"
                            onClick={handleForgotPassword}
                            disabled={loading}
                        >
                            Forgot password?
                        </button>
                    )}

                    <div className="login-divider">
                        <span>or</span>
                    </div>

                    <button
                        type="button"
                        className="btn btn-google w-full"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>
                </form>

                <div className="login-footer">
                    <p>
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button
                            type="button"
                            className="login-toggle"
                            onClick={() => {
                                setIsLogin(!isLogin)
                                setError('')
                                setMessage('')
                                setConfirmPassword('')
                                setUsername('')
                            }}
                        >
                            {isLogin ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )
}
