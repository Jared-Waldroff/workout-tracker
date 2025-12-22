import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { useAthleteProfile } from '../hooks/useAthleteProfile'
import './Header.css'

export default function Header() {
    const navigate = useNavigate()
    const { unreadCount } = useNotifications()
    const { profile } = useAthleteProfile()

    const getInitials = (name) => {
        if (!name) return 'H'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    return (
        <header className="header glass safe-top">
            <div className="header-content">
                <div className="header-left">
                    <button
                        className="btn btn-icon btn-ghost notification-btn"
                        onClick={() => navigate('/notifications')}
                        aria-label="Notifications"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        {unreadCount > 0 && (
                            <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>
                </div>

                <div className="header-center">
                    <div className="header-logo">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    <h1 className="header-title">Hybrid</h1>
                </div>

                <div className="header-right">
                    <button
                        className="profile-avatar-btn"
                        onClick={() => navigate('/settings')}
                        aria-label="Profile & Settings"
                    >
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="header-avatar" />
                        ) : (
                            <div className="header-avatar-placeholder">
                                {getInitials(profile?.display_name)}
                            </div>
                        )}
                    </button>
                </div>
            </div>
        </header>
    )
}
