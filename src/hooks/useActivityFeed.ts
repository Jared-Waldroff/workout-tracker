import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// Types
export interface FeedPost {
    id: string;
    user_id: string;
    event_id: string | null;

    completion_id: string | null;
    workout_id: string | null;
    caption: string | null;
    photo_urls: string[];
    lfg_count: number;
    comment_count: number;
    created_at: string;
    updated_at: string;
    // Joined data
    user?: {
        display_name: string;
        avatar_url: string;
    };
    event?: {
        name: string;
        event_type: string;
    };
    completion?: {
        actual_value: number | null;
        actual_unit: string | null;
        actual_zone: string | null;
        duration_seconds: number | null;
        feeling: string | null;
        training_workout?: {
            name: string;
            workout_type: string;
            target_value: number | null;
            target_unit: string | null;
            description: string | null;
            color: string | null;
            target_zone: string | null;
        };
    };
    // Linked Workout (Regular)
    workout?: {
        id: string;
        name: string;
        color: string;
        is_completed?: boolean;
        workout_exercises?: Array<{
            id: string;
            order_index: number;
            exercise?: {
                name: string;
            };
            sets?: Array<{
                id: string;
                weight: number;
                reps: number;
                is_completed: boolean;
            }>;
        }>;
    };
    has_lfg?: boolean; // Whether current user has LFG'd this post
}

export interface FeedComment {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    created_at: string;
    // Joined data
    user?: {
        display_name: string;
        avatar_url: string;
    };
}

export interface CreatePostInput {
    event_id?: string | null;
    completion_id?: string;
    workout_id?: string | null;
    caption?: string;
    photo_urls?: string[];
}

export function useActivityFeed() {
    const { user } = useAuth();
    const [feed, setFeed] = useState<FeedPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load activity feed
    const loadFeed = useCallback(async (eventId?: string, limit: number = 50) => {
        if (!user) return;

        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('activity_feed')
                .select(`
                    *,
                    event:squad_events(name, event_type),
                    completion:event_workout_completions(
                        actual_value,
                        actual_unit,
                        actual_zone,
                        duration_seconds,
                        feeling,
                        training_workout:event_training_workouts(
                            name,
                            workout_type,
                            target_value,
                            target_unit,
                            description,
                            color,
                            target_zone
                        )

                    ),
                    workout:workouts(
                        id,
                        name,
                        color,
                        is_completed,
                        workout_exercises(
                            id,
                            order_index,
                            exercise:exercises(name),
                            sets(id, weight, reps, is_completed)
                        )
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (eventId) {
                query = query.eq('event_id', eventId);
            } else {
                // If no eventId, only show posts from my Squad (and myself)
                // Filter by users in my squad (accepted status)
                const { data: squadIds } = await supabase.rpc('get_squad_ids', { p_user_id: user.id });
                const allowedIds = [user.id, ...(squadIds?.map((c: any) => c.member_id) || [])];

                query = query.in('user_id', allowedIds);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            // Get user profiles separately
            const userIds = [...new Set((data || []).map(p => p.user_id))];
            const { data: profiles } = await supabase
                .from('athlete_profiles')
                .select('user_id, display_name, avatar_url')
                .in('user_id', userIds);

            const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

            // Check which posts current user has LFG'd
            const postIds = (data || []).map(p => p.id);
            const { data: reactions } = await supabase
                .from('feed_reactions')
                .select('post_id')
                .eq('user_id', user.id)
                .in('post_id', postIds);

            const lfgPostIds = new Set(reactions?.map(r => r.post_id) || []);

            const postsWithLfg = (data || []).map(post => {
                if (post.workout && post.workout.workout_exercises) {
                    post.workout.workout_exercises.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
                }
                return {
                    ...post,
                    user: profileMap.get(post.user_id),
                    has_lfg: lfgPostIds.has(post.id),
                };
            });

            if (postsWithLfg.length > 0) {
                // Debug log removed
            }

            setFeed(postsWithLfg);
        } catch (err: any) {
            console.error('Error loading feed:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Create a new post
    // Create a new post
    const createPost = useCallback(async (
        input: CreatePostInput
    ): Promise<{ post: FeedPost | null; error: string | null }> => {
        if (!user) return { post: null, error: 'Not authenticated' };

        try {
            const { data, error: insertError } = await supabase
                .from('activity_feed')
                .insert({
                    user_id: user.id,
                    event_id: input.event_id || null, // Allow null for general posts
                    completion_id: input.completion_id || null,
                    workout_id: input.workout_id || null,
                    caption: input.caption || null,
                    photo_urls: input.photo_urls || [],
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // Refresh feed
            await loadFeed(input.event_id || undefined);

            return { post: data, error: null };
        } catch (err: any) {
            console.error('Error creating post:', err);
            return { post: null, error: err.message };
        }
    }, [user, loadFeed]);

    // Delete a post
    const deletePost = useCallback(async (postId: string): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { error: deleteError } = await supabase
                .from('activity_feed')
                .delete()
                .eq('id', postId)
                .eq('user_id', user.id);

            if (deleteError) throw deleteError;

            setFeed(prev => prev.filter(p => p.id !== postId));
            return { error: null };
        } catch (err: any) {
            console.error('Error deleting post:', err);
            return { error: err.message };
        }
    }, [user]);

    // Toggle LFG reaction
    const toggleLfg = useCallback(async (postId: string): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not authenticated' };

        try {
            // Check if already LFG'd
            const post = feed.find(p => p.id === postId);

            if (post?.has_lfg) {
                // Remove LFG
                const { error: deleteError } = await supabase
                    .from('feed_reactions')
                    .delete()
                    .eq('post_id', postId)
                    .eq('user_id', user.id)
                    .eq('reaction_type', 'lfg');

                if (deleteError) throw deleteError;

                setFeed(prev => prev.map(p =>
                    p.id === postId
                        ? { ...p, has_lfg: false, lfg_count: Math.max(0, p.lfg_count - 1) }
                        : p
                ));
            } else {
                // Add LFG
                const { error: insertError } = await supabase
                    .from('feed_reactions')
                    .insert({
                        post_id: postId,
                        user_id: user.id,
                        reaction_type: 'lfg',
                    });

                if (insertError) throw insertError;

                setFeed(prev => prev.map(p =>
                    p.id === postId
                        ? { ...p, has_lfg: true, lfg_count: p.lfg_count + 1 }
                        : p
                ));
            }

            return { error: null };
        } catch (err: any) {
            console.error('Error toggling LFG:', err);
            return { error: err.message };
        }
    }, [user, feed]);

    // Get comments for a post
    const getComments = useCallback(async (postId: string): Promise<FeedComment[]> => {
        try {
            const { data, error: fetchError } = await supabase
                .from('feed_comments')
                .select('*')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;

            // Get user profiles
            const userIds = (data || []).map(c => c.user_id);
            const { data: profiles } = await supabase
                .from('athlete_profiles')
                .select('user_id, display_name, avatar_url')
                .in('user_id', userIds);

            const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

            return (data || []).map(comment => ({
                ...comment,
                user: profileMap.get(comment.user_id),
            }));
        } catch (err: any) {
            console.error('Error getting comments:', err);
            return [];
        }
    }, []);

    // Add a comment
    const addComment = useCallback(async (
        postId: string,
        content: string
    ): Promise<{ comment: FeedComment | null; error: string | null }> => {
        if (!user) return { comment: null, error: 'Not authenticated' };

        try {
            const { data, error: insertError } = await supabase
                .from('feed_comments')
                .insert({
                    post_id: postId,
                    user_id: user.id,
                    content,
                })
                .select('*')
                .single();

            if (insertError) throw insertError;

            // Get user profile
            const { data: profile } = await supabase
                .from('athlete_profiles')
                .select('display_name, avatar_url')
                .eq('user_id', user.id)
                .single();

            const commentWithUser = { ...data, user: profile };

            // Update comment count in local state
            setFeed(prev => prev.map(p =>
                p.id === postId
                    ? { ...p, comment_count: p.comment_count + 1 }
                    : p
            ));

            return { comment: commentWithUser, error: null };
        } catch (err: any) {
            console.error('Error adding comment:', err);
            return { comment: null, error: err.message };
        }
    }, [user]);

    // Delete a comment
    const deleteComment = useCallback(async (
        commentId: string,
        postId: string
    ): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { error: deleteError } = await supabase
                .from('feed_comments')
                .delete()
                .eq('id', commentId)
                .eq('user_id', user.id);

            if (deleteError) throw deleteError;

            // Update comment count in local state
            setFeed(prev => prev.map(p =>
                p.id === postId
                    ? { ...p, comment_count: Math.max(0, p.comment_count - 1) }
                    : p
            ));

            return { error: null };
        } catch (err: any) {
            console.error('Error deleting comment:', err);
            return { error: err.message };
        }
    }, [user]);

    // Get users who LFG'd a post
    const getLfgUsers = useCallback(async (postId: string): Promise<{ display_name: string; avatar_url: string }[]> => {
        try {
            const { data, error: fetchError } = await supabase
                .from('feed_reactions')
                .select('user_id')
                .eq('post_id', postId)
                .eq('reaction_type', 'lfg');

            if (fetchError) throw fetchError;

            // Get user profiles
            const userIds = (data || []).map(r => r.user_id);
            const { data: profiles } = await supabase
                .from('athlete_profiles')
                .select('display_name, avatar_url')
                .in('user_id', userIds);

            return profiles || [];
        } catch (err: any) {
            console.error('Error getting LFG users:', err);
            return [];
        }
    }, []);

    // Subscribe to realtime feed updates
    useEffect(() => {
        if (!user) return;

        const subscription = supabase
            .channel('activity_feed_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_feed',
                },
                (payload) => {
                    // Refresh feed when new post is added
                    loadFeed();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user, loadFeed]);

    return {
        feed,
        loading,
        error,
        loadFeed,
        createPost,
        deletePost,
        toggleLfg,
        getComments,
        addComment,
        deleteComment,
        getLfgUsers,
    };
}

// Upload photos to Supabase Storage
export async function uploadFeedPhotos(
    userId: string,
    photos: { uri: string; type?: string }[]
): Promise<{ urls: string[]; error: string | null }> {
    try {
        const urls: string[] = [];

        for (const photo of photos) {
            const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;

            const formData = new FormData();
            formData.append('files', {
                uri: photo.uri,
                name: fileName,
                type: photo.type || 'image/jpeg',
            } as any);

            const { data, error: uploadError } = await supabase.storage
                .from('activity-photos')
                .upload(fileName, formData, {
                    contentType: photo.type || 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('activity-photos')
                .getPublicUrl(fileName);

            urls.push(publicUrl);
        }

        return { urls, error: null };
    } catch (err: any) {
        console.error('Error uploading photos:', err);
        return { urls: [], error: err.message };
    }
}

// Format duration for display
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}
