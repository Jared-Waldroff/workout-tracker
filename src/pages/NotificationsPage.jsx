import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { useConnections } from '../hooks/useConnections'
import Header from '../components/Header'
import Footer from '../components/Footer'
import GlassCard from '../components/GlassCard'
import './NotificationsPage.css'

export default function NotificationsPage() {
    const navigate = useNavigate()
    const {
        notifications,
        loading,
        markAsRead,
        markAllRead,
        deleteNotification,
        clearAll
    } = useNotifications()
    const { acceptRequest, rejectRequest } = useConnections()

    const formatTime = (dateStr) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now - date
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'badge_earned':
                return '🏆'
            case 'new_follower':
                return '👤'
            case 'follow_request':
                return '🤝'
            case 'follow_accepted':
                return '✅'
            default:
                return '🔔'
        }
    }

    const handleNotificationClick = async (notification) => {
        if (!notification.is_read) {
            await markAsRead(notification.id)
        }

        // Navigate based on type
        if (notification.type === 'follow_request' || notification.type === 'new_follower') {
            navigate('/squad')
        } else if (notification.type === 'badge_earned') {
            navigate('/settings')
        }
    }

    const handleAcceptRequest = async (e, notification) => {
        e.stopPropagation()
        const connectionId = notification.data?.connection_id
        const followerId = notification.data?.follower_id
        if (connectionId && followerId) {
            await acceptRequest(connectionId, followerId)
            await deleteNotification(notification.id)
        }
    }

    const handleRejectRequest = async (e, notification) => {
        e.stopPropagation()
        const connectionId = notification.data?.connection_id
        if (connectionId) {
            await rejectRequest(connectionId)
            await deleteNotification(notification.id)
        }
    }

    return (
        <div className="notifications-page">
            <header className="page-header glass">
                <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1>Notifications</h1>
                {notifications.length > 0 && (
                    <button className="btn btn-ghost" onClick={markAllRead}>
                        Mark all read
                    </button>
                )}
            </header>

            <main className="notifications-content">
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner" />
                        <p>Loading notifications...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <GlassCard className="empty-notifications">
                        <div className="empty-icon">🔔</div>
                        <h3>No notifications yet</h3>
                        <p>When you earn badges or get Squad requests, they'll show up here!</p>
                    </GlassCard>
                ) : (
                    <div className="notifications-list">
                        {notifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="notification-icon">
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="notification-content">
                                    <h4>{notification.title}</h4>
                                    {notification.message && <p>{notification.message}</p>}
                                    <span className="notification-time">{formatTime(notification.created_at)}</span>
                                </div>

                                {notification.type === 'follow_request' && (
                                    <div className="notification-actions">
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={(e) => handleAcceptRequest(e, notification)}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={(e) => handleRejectRequest(e, notification)}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                )}

                                <button
                                    className="notification-delete"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        deleteNotification(notification.id)
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    )
}
