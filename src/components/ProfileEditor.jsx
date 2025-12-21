import { useState, useRef, useEffect } from 'react'
import { useAthleteProfile } from '../hooks/useAthleteProfile'
import { BADGE_DEFINITIONS, getManualBadges, getBadgesByCategory } from '../data/badges'
import './ProfileEditor.css'

export default function ProfileEditor({ isOpen, onClose }) {
    const {
        profile,
        updateProfile,
        uploadAvatar,
        addBadge,
        removeBadge,
        hasBadge
    } = useAthleteProfile()

    const [displayName, setDisplayName] = useState('')
    const [bio, setBio] = useState('')
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('profile') // 'profile' or 'badges'
    const fileInputRef = useRef(null)

    // Load current values when opened
    useEffect(() => {
        if (isOpen) {
            setDisplayName(profile.display_name || '')
            setBio(profile.bio || '')
        }
    }, [isOpen, profile])

    if (!isOpen) return null

    const handleAvatarClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be less than 5MB')
            return
        }

        setUploading(true)
        const { error } = await uploadAvatar(file)
        setUploading(false)

        if (error) {
            alert('Failed to upload: ' + error)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        await updateProfile({
            display_name: displayName.trim() || null,
            bio: bio.trim() || null
        })
        setSaving(false)
        onClose()
    }

    const handleToggleBadge = async (badgeId) => {
        if (hasBadge(badgeId)) {
            await removeBadge(badgeId)
        } else {
            await addBadge(badgeId)
        }
    }

    const getInitials = (name) => {
        if (!name) return 'HA'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    const manualBadges = getManualBadges()
    const badgesByCategory = getBadgesByCategory()

    return (
        <div className="profile-editor-overlay" onClick={onClose}>
            <div className="profile-editor-modal" onClick={e => e.stopPropagation()}>
                <div className="editor-header">
                    <h2>Edit Profile</h2>
                    <button className="btn btn-ghost btn-icon close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="editor-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        Profile
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'badges' ? 'active' : ''}`}
                        onClick={() => setActiveTab('badges')}
                    >
                        Badges
                    </button>
                </div>

                <div className="editor-content">
                    {activeTab === 'profile' && (
                        <div className="profile-tab">
                            <div className="avatar-section">
                                <div className="avatar-edit" onClick={handleAvatarClick}>
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Avatar" className="avatar-preview" />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {getInitials(displayName)}
                                        </div>
                                    )}
                                    <div className="avatar-overlay">
                                        {uploading ? (
                                            <div className="spinner-small" />
                                        ) : (
                                            <>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                    <circle cx="12" cy="13" r="4" />
                                                </svg>
                                                <span>Change Photo</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="displayName">Display Name</label>
                                <input
                                    id="displayName"
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    placeholder="Your name"
                                    maxLength={50}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="bio">Bio</label>
                                <textarea
                                    id="bio"
                                    value={bio}
                                    onChange={e => setBio(e.target.value)}
                                    placeholder="Tell us about yourself and your training..."
                                    rows={3}
                                    maxLength={200}
                                />
                                <span className="char-count">{bio.length}/200</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'badges' && (
                        <div className="badges-tab">
                            <p className="badges-intro">
                                Add badges for achievements the app can't detect automatically.
                                Race completions are auto-awarded when you complete workouts with race names!
                            </p>

                            <div className="badges-section">
                                <h4>Your Badges</h4>
                                <div className="current-badges">
                                    {(profile.badges || []).length > 0 ? (
                                        (profile.badges || []).map(badge => {
                                            const def = BADGE_DEFINITIONS[badge.id]
                                            if (!def) return null
                                            return (
                                                <div key={badge.id} className="badge-earned">
                                                    <span className="badge-emoji">{def.emoji}</span>
                                                    <span className="badge-info">
                                                        <span className="badge-name">{def.name}</span>
                                                        <span className="badge-date">
                                                            {new Date(badge.earned_at).toLocaleDateString()}
                                                        </span>
                                                    </span>
                                                    <button
                                                        className="badge-remove"
                                                        onClick={() => removeBadge(badge.id)}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <p className="no-badges-text">No badges earned yet</p>
                                    )}
                                </div>
                            </div>

                            <div className="badges-section">
                                <h4>Add Achievements</h4>
                                <div className="available-badges">
                                    {manualBadges.map(badge => (
                                        <button
                                            key={badge.id}
                                            className={`badge-add-btn ${hasBadge(badge.id) ? 'earned' : ''}`}
                                            onClick={() => handleToggleBadge(badge.id)}
                                            disabled={hasBadge(badge.id)}
                                        >
                                            <span className="badge-emoji">{badge.emoji}</span>
                                            <span className="badge-details">
                                                <span className="badge-name">{badge.name}</span>
                                                <span className="badge-desc">{badge.description}</span>
                                            </span>
                                            {hasBadge(badge.id) ? (
                                                <span className="badge-check">✓</span>
                                            ) : (
                                                <span className="badge-plus">+</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {activeTab === 'profile' && (
                    <div className="editor-footer">
                        <button className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
