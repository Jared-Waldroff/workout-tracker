import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useConnections } from '../hooks/useConnections'
import { useAthleteProfile } from '../hooks/useAthleteProfile'
import Header from '../components/Header'
import Footer from '../components/Footer'
import GlassCard from '../components/GlassCard'
import './SquadPage.css'

export default function SquadPage() {
    const navigate = useNavigate()
    const {
        followers,
        following,
        pendingRequests,
        loading,
        searchUsers,
        followUser,
        acceptRequest,
        rejectRequest,
        isFollowing
    } = useConnections()
    const { profile } = useAthleteProfile()

    const [activeTab, setActiveTab] = useState('squad') // 'squad', 'followers', 'requests'
    const [showAddModal, setShowAddModal] = useState(false)
    const [inviteTab, setInviteTab] = useState('qr') // 'qr', 'search', 'link'
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [inviteLink, setInviteLink] = useState('')

    // Generate invite link
    useEffect(() => {
        if (profile?.invite_code) {
            const baseUrl = window.location.origin
            setInviteLink(`${baseUrl}/join/${profile.invite_code}`)
        }
    }, [profile?.invite_code])

    // Handle search
    const handleSearch = async (query) => {
        setSearchQuery(query)
        if (query.length < 3) {
            setSearchResults([])
            return
        }

        setSearching(true)
        const results = await searchUsers(query)
        setSearchResults(results)
        setSearching(false)
    }

    // Handle follow
    const handleFollow = async (userId) => {
        const result = await followUser(userId)
        if (!result.error) {
            // Remove from search results
            setSearchResults(prev => prev.filter(u => u.user_id !== userId))
        }
    }

    // Copy invite link
    const copyInviteLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink)
            alert('Invite link copied!')
        } catch (err) {
            // Fallback for iOS
            const textArea = document.createElement('textarea')
            textArea.value = inviteLink
            document.body.appendChild(textArea)
            textArea.select()
            document.execCommand('copy')
            document.body.removeChild(textArea)
            alert('Invite link copied!')
        }
    }

    // Share invite link (if Web Share API available)
    const shareInviteLink = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join my Squad on Hybrid',
                    text: 'Train with me! Join my Squad on the Hybrid app.',
                    url: inviteLink
                })
            } catch (err) {
                console.log('Share cancelled')
            }
        } else {
            copyInviteLink()
        }
    }

    const getInitials = (name) => {
        if (!name) return '?'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    return (
        <div className="squad-page">
            <Header />

            <main className="squad-content">
                <div className="squad-header-section">
                    <h2>Your Squad</h2>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowAddModal(true)}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            <line x1="20" y1="8" x2="20" y2="14" />
                            <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                        Add to Squad
                    </button>
                </div>

                {/* Tabs */}
                <div className="squad-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'squad' ? 'active' : ''}`}
                        onClick={() => setActiveTab('squad')}
                    >
                        Squad ({following.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'followers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('followers')}
                    >
                        Followers ({followers.length})
                    </button>
                    {pendingRequests.length > 0 && (
                        <button
                            className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            Requests ({pendingRequests.length})
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="loading-container">
                        <div className="spinner" />
                        <p>Loading Squad...</p>
                    </div>
                ) : (
                    <>
                        {/* Squad (people I follow) */}
                        {activeTab === 'squad' && (
                            <div className="squad-list">
                                {following.length === 0 ? (
                                    <GlassCard className="empty-squad">
                                        <div className="empty-icon">👥</div>
                                        <h3>No Squad Members Yet</h3>
                                        <p>Add athletes to your Squad to see their workouts and compete together!</p>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => setShowAddModal(true)}
                                        >
                                            Find Athletes
                                        </button>
                                    </GlassCard>
                                ) : (
                                    following.map(connection => {
                                        const user = connection.following
                                        const profile = user?.athlete_profiles?.[0]
                                        return (
                                            <div
                                                key={connection.id}
                                                className="squad-member"
                                                onClick={() => navigate(`/athlete/${user.id}`)}
                                            >
                                                <div className="member-avatar">
                                                    {profile?.avatar_url ? (
                                                        <img src={profile.avatar_url} alt="" />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {getInitials(profile?.display_name || user?.email)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="member-info">
                                                    <h4>{profile?.display_name || user?.email?.split('@')[0]}</h4>
                                                    {profile?.bio && <p>{profile.bio}</p>}
                                                </div>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="9 18 15 12 9 6" />
                                                </svg>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        )}

                        {/* Followers */}
                        {activeTab === 'followers' && (
                            <div className="squad-list">
                                {followers.length === 0 ? (
                                    <GlassCard className="empty-squad">
                                        <div className="empty-icon">🏃</div>
                                        <h3>No Followers Yet</h3>
                                        <p>Share your invite link to grow your Squad!</p>
                                        <button
                                            className="btn btn-primary"
                                            onClick={shareInviteLink}
                                        >
                                            Share Invite
                                        </button>
                                    </GlassCard>
                                ) : (
                                    followers.map(connection => {
                                        const user = connection.follower
                                        const profile = user?.athlete_profiles?.[0]
                                        return (
                                            <div
                                                key={connection.id}
                                                className="squad-member"
                                                onClick={() => navigate(`/athlete/${user.id}`)}
                                            >
                                                <div className="member-avatar">
                                                    {profile?.avatar_url ? (
                                                        <img src={profile.avatar_url} alt="" />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {getInitials(profile?.display_name || user?.email)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="member-info">
                                                    <h4>{profile?.display_name || user?.email?.split('@')[0]}</h4>
                                                    {profile?.bio && <p>{profile.bio}</p>}
                                                </div>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="9 18 15 12 9 6" />
                                                </svg>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        )}

                        {/* Pending Requests */}
                        {activeTab === 'requests' && (
                            <div className="squad-list">
                                {pendingRequests.map(connection => {
                                    const user = connection.follower
                                    const profile = user?.athlete_profiles?.[0]
                                    return (
                                        <div key={connection.id} className="squad-member request">
                                            <div className="member-avatar">
                                                {profile?.avatar_url ? (
                                                    <img src={profile.avatar_url} alt="" />
                                                ) : (
                                                    <div className="avatar-placeholder">
                                                        {getInitials(profile?.display_name || user?.email)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="member-info">
                                                <h4>{profile?.display_name || user?.email?.split('@')[0]}</h4>
                                                <p>Wants to join your Squad</p>
                                            </div>
                                            <div className="request-actions">
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => acceptRequest(connection.id, user.id)}
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => rejectRequest(connection.id)}
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}
            </main>

            <Footer />

            {/* Add to Squad Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="add-squad-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add to Squad</h2>
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => setShowAddModal(false)}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Invite Method Tabs */}
                        <div className="invite-tabs">
                            <button
                                className={`invite-tab ${inviteTab === 'qr' ? 'active' : ''}`}
                                onClick={() => setInviteTab('qr')}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="7" />
                                    <rect x="14" y="3" width="7" height="7" />
                                    <rect x="3" y="14" width="7" height="7" />
                                    <rect x="14" y="14" width="3" height="3" />
                                </svg>
                                QR Code
                            </button>
                            <button
                                className={`invite-tab ${inviteTab === 'search' ? 'active' : ''}`}
                                onClick={() => setInviteTab('search')}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                Search
                            </button>
                            <button
                                className={`invite-tab ${inviteTab === 'link' ? 'active' : ''}`}
                                onClick={() => setInviteTab('link')}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                                Link
                            </button>
                        </div>

                        <div className="modal-content">
                            {/* QR Code Tab */}
                            {inviteTab === 'qr' && (
                                <div className="qr-section">
                                    <div className="qr-code-container">
                                        <QRCodeSVG
                                            value={inviteLink}
                                            size={180}
                                            level="H"
                                            includeMargin={true}
                                            bgColor="#ffffff"
                                            fgColor="#1a1a2e"
                                        />
                                    </div>
                                    <p className="qr-instructions">
                                        Have them scan this QR code to join your Squad
                                    </p>
                                    <button
                                        className="btn btn-primary w-full"
                                        onClick={shareInviteLink}
                                    >
                                        Share Invite
                                    </button>
                                </div>
                            )}

                            {/* Search Tab */}
                            {inviteTab === 'search' && (
                                <div className="search-section">
                                    <label>Search by Username</label>
                                    <input
                                        type="text"
                                        placeholder="@username"
                                        value={searchQuery}
                                        onChange={(e) => handleSearch(e.target.value)}
                                    />

                                    {searching && (
                                        <div className="search-loading">
                                            <div className="spinner-small" />
                                            Searching...
                                        </div>
                                    )}

                                    {searchResults.length > 0 && (
                                        <div className="search-results">
                                            {searchResults.map(user => (
                                                <div key={user.user_id} className="search-result">
                                                    <div className="result-avatar">
                                                        {user.avatar_url ? (
                                                            <img src={user.avatar_url} alt="" />
                                                        ) : (
                                                            <div className="avatar-placeholder">
                                                                {getInitials(user.display_name || user.username)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="result-info">
                                                        <h4>{user.display_name || user.username}</h4>
                                                        <p>@{user.username}</p>
                                                    </div>
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => handleFollow(user.user_id)}
                                                    >
                                                        {user.is_private ? 'Request' : 'Add'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Link Tab */}
                            {inviteTab === 'link' && (
                                <div className="invite-section">
                                    <label>Share Your Invite Link</label>
                                    <div className="invite-link-box">
                                        <input
                                            type="text"
                                            value={inviteLink}
                                            readOnly
                                        />
                                        <button className="btn btn-secondary" onClick={copyInviteLink}>
                                            Copy
                                        </button>
                                    </div>
                                    <button
                                        className="btn btn-primary w-full"
                                        onClick={shareInviteLink}
                                    >
                                        Share Invite
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
