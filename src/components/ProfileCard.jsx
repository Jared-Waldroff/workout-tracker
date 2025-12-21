import { useState, useRef } from 'react'
import { useAthleteProfile } from '../hooks/useAthleteProfile'
import { BADGE_DEFINITIONS, getManualBadges, getBadgesByCategory } from '../data/badges'
import GlassCard from './GlassCard'
import './ProfileCard.css'

export default function ProfileCard({ onEdit }) {
    const { profile } = useAthleteProfile()

    const displayName = profile.display_name || 'Hybrid Athlete'
    const bio = profile.bio || 'Training to be better every day'
    const avatarUrl = profile.avatar_url
    const badges = profile.badges || []

    // Get initials for avatar fallback
    const getInitials = (name) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    return (
        <GlassCard className="profile-card">
            <div className="profile-header">
                <div className="profile-avatar" onClick={onEdit}>
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="avatar-image" />
                    ) : (
                        <div className="avatar-initials">
                            {getInitials(displayName)}
                        </div>
                    )}
                    <div className="avatar-edit-overlay">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </div>
                </div>

                <div className="profile-info">
                    <h2 className="profile-name">{displayName}</h2>
                    <p className="profile-bio">{bio}</p>
                </div>

                <button className="btn btn-ghost btn-icon edit-profile-btn" onClick={onEdit}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
            </div>

            {badges.length > 0 && (
                <div className="profile-badges">
                    <h4 className="badges-title">Achievements</h4>
                    <div className="badges-grid">
                        {badges.map(badge => {
                            const def = BADGE_DEFINITIONS[badge.id]
                            if (!def) return null
                            return (
                                <div key={badge.id} className="badge-item" title={def.description}>
                                    <span className="badge-emoji">{def.emoji}</span>
                                    <span className="badge-name">{def.name}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {badges.length === 0 && (
                <div className="no-badges">
                    <p>No achievements yet. Complete races and hit milestones to earn badges!</p>
                </div>
            )}
        </GlassCard>
    )
}
