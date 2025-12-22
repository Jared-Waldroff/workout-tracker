import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useNotifications() {
    const { user } = useAuth()
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)

    // Calculate unread count
    const unreadCount = notifications.filter(n => !n.is_read).length

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        if (!user) {
            setNotifications([])
            setLoading(false)
            return
        }

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            setNotifications(data || [])
        } catch (err) {
            console.error('Error fetching notifications:', err)
        } finally {
            setLoading(false)
        }
    }, [user])

    // Create a notification
    const createNotification = useCallback(async ({ type, title, message, data = {} }) => {
        if (!user) return { error: 'Not authenticated' }

        try {
            const { data: notification, error } = await supabase
                .from('notifications')
                .insert({
                    user_id: user.id,
                    type,
                    title,
                    message,
                    data
                })
                .select()
                .single()

            if (error) throw error

            // Add to local state
            setNotifications(prev => [notification, ...prev])
            return { data: notification, error: null }
        } catch (err) {
            console.error('Error creating notification:', err)
            return { data: null, error: err.message }
        }
    }, [user])

    // Mark notification as read
    const markAsRead = useCallback(async (notificationId) => {
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId)

            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            )
        } catch (err) {
            console.error('Error marking notification as read:', err)
        }
    }, [])

    // Mark all as read
    const markAllRead = useCallback(async () => {
        if (!user) return

        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false)

            setNotifications(prev =>
                prev.map(n => ({ ...n, is_read: true }))
            )
        } catch (err) {
            console.error('Error marking all notifications as read:', err)
        }
    }, [user])

    // Delete a notification
    const deleteNotification = useCallback(async (notificationId) => {
        try {
            await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId)

            setNotifications(prev => prev.filter(n => n.id !== notificationId))
        } catch (err) {
            console.error('Error deleting notification:', err)
        }
    }, [])

    // Clear all notifications
    const clearAll = useCallback(async () => {
        if (!user) return

        try {
            await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id)

            setNotifications([])
        } catch (err) {
            console.error('Error clearing notifications:', err)
        }
    }, [user])

    // Load on mount
    useEffect(() => {
        fetchNotifications()
    }, [fetchNotifications])

    // Subscribe to realtime notifications
    useEffect(() => {
        if (!user) return

        const channel = supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    setNotifications(prev => [payload.new, ...prev])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user])

    return {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        createNotification,
        markAsRead,
        markAllRead,
        deleteNotification,
        clearAll
    }
}
