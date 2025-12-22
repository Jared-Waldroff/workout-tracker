import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useAthleteProfile } from '../hooks/useAthleteProfile'
import Header from '../components/Header'
import Footer from '../components/Footer'
import GlassCard from '../components/GlassCard'
import ColorPicker from '../components/ColorPicker'
import ConfirmDialog from '../components/ConfirmDialog'
import ProfileCard from '../components/ProfileCard'
import ProfileEditor from '../components/ProfileEditor'
import { useState } from 'react'
import './SettingsPage.css'

export default function SettingsPage() {
    const navigate = useNavigate()
    const { user, signOut } = useAuth()
    const { theme, colors, showCF, updateTheme, updateColors, updateShowCF } = useTheme()
    const { profile, updateProfile } = useAthleteProfile()
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [showProfileEditor, setShowProfileEditor] = useState(false)

    const handlePrivacyToggle = async (isPrivate) => {
        await updateProfile({ is_private: isPrivate })
    }

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <div className="settings-page">
            <Header />

            <main className="settings-content">
                {/* Profile Card */}
                <ProfileCard onEdit={() => setShowProfileEditor(true)} />

                <GlassCard className="settings-section">
                    <h3 className="section-title">Theme</h3>
                    <div className="theme-options">
                        <button
                            className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                            onClick={() => updateTheme('dark')}
                        >
                            <div className="theme-preview dark">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                            </div>
                            <span>Dark</span>
                        </button>
                        <button
                            className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                            onClick={() => updateTheme('light')}
                        >
                            <div className="theme-preview light">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="5" />
                                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                                </svg>
                            </div>
                            <span>Light</span>
                        </button>
                    </div>
                </GlassCard>

                <GlassCard className="settings-section">
                    <h3 className="section-title">App Colors</h3>
                    <ColorPicker
                        currentColors={colors}
                        onColorChange={updateColors}
                    />
                </GlassCard>

                <GlassCard className="settings-section">
                    <h3 className="section-title">Account</h3>
                    <div className="account-info">
                        <div className="account-row">
                            <span className="account-label">Email</span>
                            <span className="account-value">{user?.email}</span>
                        </div>
                    </div>
                    <button
                        className="btn btn-secondary w-full mt-md"
                        onClick={() => setShowLogoutConfirm(true)}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Sign Out
                    </button>
                </GlassCard>

                <GlassCard className="settings-section about-section">
                    <h3 className="section-title">About</h3>
                    <p className="about-text">
                        Hybrid is built for athletes who train both strength and cardio. Plan and track your complete fitness journey.
                    </p>
                    <p className="version">Version 1.0.0</p>
                </GlassCard>

                <GlassCard className="settings-section">
                    <div className="feature-row">
                        <div className="feature-info">
                            <span className="feature-label">Private Account</span>
                            <span className="feature-description">Only Squad members can see your workouts</span>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={profile?.is_private || false}
                                onChange={(e) => handlePrivacyToggle(e.target.checked)}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>

                    <div className="feature-row">
                        <div className="feature-info">
                            <span className="feature-label">CrossFit Button</span>
                            <span className="feature-description">Show the CF button on home page</span>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={showCF}
                                onChange={(e) => updateShowCF(e.target.checked)}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                </GlassCard>
            </main>

            <Footer />

            <ConfirmDialog
                isOpen={showLogoutConfirm}
                title="Sign Out"
                message="Are you sure you want to sign out?"
                confirmText="Sign Out"
                onConfirm={handleLogout}
                onCancel={() => setShowLogoutConfirm(false)}
            />

            <ProfileEditor
                isOpen={showProfileEditor}
                onClose={() => setShowProfileEditor(false)}
            />
        </div>
    )
}
