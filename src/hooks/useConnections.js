import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useConnections() {
    const { user } = useAuth()
    const [followers, setFollowers] = useState([])
    const [following, setFollowing] = useState([])
    const [pendingRequests, setPendingRequests] = useState([])
    const [loading, setLoading] = useState(true)

    // Fetch all connections
    const fetchConnections = useCallback(async () => {
        if (!user) {
            setFollowers([])
            setFollowing([])
            setPendingRequests([])
            setLoading(false)
            return
        }

        try {
            // Get people following me
            const { data: followersData } = await supabase
                .from('connections')
                .select(`
                    *,
                    follower:follower_id(
                        id,
                        email,
                        athlete_profiles(display_name, avatar_url, bio)
                    )
                `)
                .eq('following_id', user.id)
                .eq('status', 'accepted')

            // Get people I'm following
            const { data: followingData } = await supabase
                .from('connections')
                .select(`
                    *,
                    following:following_id(
                        id,
                        email,
                        athlete_profiles(display_name, avatar_url, bio, is_private)
                    )
                `)
                .eq('follower_id', user.id)
                .eq('status', 'accepted')

            // Get pending requests (people wanting to follow me)
            const { data: pendingData } = await supabase
                .from('connections')
                .select(`
                    *,
                    follower:follower_id(
                        id,
                        email,
                        athlete_profiles(display_name, avatar_url, bio)
                    )
                `)
                .eq('following_id', user.id)
                .eq('status', 'pending')

            setFollowers(followersData || [])
            setFollowing(followingData || [])
            setPendingRequests(pendingData || [])
        } catch (err) {
            console.error('Error fetching connections:', err)
        } finally {
            setLoading(false)
        }
    }, [user])

    // Search for users by username
    const searchUsers = useCallback(async (username) => {
        if (!username || username.length < 2) return []

        try {
            const { data, error } = await supabase
                .rpc('search_users_by_username', { search_username: username })

            if (error) throw error
            return data || []
        } catch (err) {
            console.error('Error searching users:', err)
            return []
        }
    }, [])

    // Follow a user (or request if private)
    const followUser = useCallback(async (targetUserId) => {
        if (!user || targetUserId === user.id) return { error: 'Invalid user' }

        try {
            // Check if target is private
            const { data: targetProfile } = await supabase
                .from('athlete_profiles')
                .select('is_private')
                .eq('user_id', targetUserId)
                .single()

            const status = targetProfile?.is_private ? 'pending' : 'accepted'

            const { data, error } = await supabase
                .from('connections')
                .insert({
                    follower_id: user.id,
                    following_id: targetUserId,
                    status
                })
                .select()
                .single()

            if (error) throw error

            // Create notification for target user
            const notifType = status === 'pending' ? 'follow_request' : 'new_follower'
            await supabase.from('notifications').insert({
                user_id: targetUserId,
                type: notifType,
                title: status === 'pending' ? 'New Squad Request' : 'New Squad Member',
                message: `Someone wants to join your Squad!`,
                data: { follower_id: user.id }
            })

            await fetchConnections()
            return { data, status, error: null }
        } catch (err) {
            console.error('Error following user:', err)
            return { data: null, error: err.message }
        }
    }, [user, fetchConnections])

    // Unfollow a user
    const unfollowUser = useCallback(async (targetUserId) => {
        if (!user) return { error: 'Not authenticated' }

        try {
            const { error } = await supabase
                .from('connections')
                .delete()
                .eq('follower_id', user.id)
                .eq('following_id', targetUserId)

            if (error) throw error

            await fetchConnections()
            return { error: null }
        } catch (err) {
            console.error('Error unfollowing user:', err)
            return { error: err.message }
        }
    }, [user, fetchConnections])

    // Accept a follow request
    const acceptRequest = useCallback(async (connectionId, followerId) => {
        if (!user) return { error: 'Not authenticated' }

        try {
            const { error } = await supabase
                .from('connections')
                .update({ status: 'accepted' })
                .eq('id', connectionId)

            if (error) throw error

            // Notify the follower
            await supabase.from('notifications').insert({
                user_id: followerId,
                type: 'follow_accepted',
                title: 'Request Accepted!',
                message: 'You\'re now part of their Squad!',
                data: { following_id: user.id }
            })

            await fetchConnections()
            return { error: null }
        } catch (err) {
            console.error('Error accepting request:', err)
            return { error: err.message }
        }
    }, [user, fetchConnections])

    // Reject a follow request
    const rejectRequest = useCallback(async (connectionId) => {
        if (!user) return { error: 'Not authenticated' }

        try {
            const { error } = await supabase
                .from('connections')
                .delete()
                .eq('id', connectionId)

            if (error) throw error

            await fetchConnections()
            return { error: null }
        } catch (err) {
            console.error('Error rejecting request:', err)
            return { error: err.message }
        }
    }, [user, fetchConnections])

    // Remove a follower
    const removeFollower = useCallback(async (connectionId) => {
        if (!user) return { error: 'Not authenticated' }

        try {
            const { error } = await supabase
                .from('connections')
                .delete()
                .eq('id', connectionId)

            if (error) throw error

            await fetchConnections()
            return { error: null }
        } catch (err) {
            console.error('Error removing follower:', err)
            return { error: err.message }
        }
    }, [user, fetchConnections])

    // Check if following a specific user
    const isFollowing = useCallback((userId) => {
        return following.some(f => f.following_id === userId)
    }, [following])

    // Check if request is pending
    const isPending = useCallback(async (userId) => {
        if (!user) return false

        const { data } = await supabase
            .from('connections')
            .select('status')
            .eq('follower_id', user.id)
            .eq('following_id', userId)
            .single()

        return data?.status === 'pending'
    }, [user])

    // Load on mount
    useEffect(() => {
        fetchConnections()
    }, [fetchConnections])

    return {
        followers,
        following,
        pendingRequests,
        squadCount: following.length,
        followerCount: followers.length,
        loading,
        fetchConnections,
        searchUsers,
        followUser,
        unfollowUser,
        acceptRequest,
        rejectRequest,
        removeFollower,
        isFollowing,
        isPending
    }
}
