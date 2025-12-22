-- =============================================
-- Squad Social Features & Notifications
-- Run this in your Supabase SQL Editor
-- =============================================

-- Add privacy, invite code, and username to athlete profiles
ALTER TABLE athlete_profiles 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS invite_code UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index for invite codes and usernames
CREATE INDEX IF NOT EXISTS idx_athlete_profiles_invite_code ON athlete_profiles(invite_code);
CREATE INDEX IF NOT EXISTS idx_athlete_profiles_username ON athlete_profiles(username);

-- =============================================
-- Connections Table (Squad relationships)
-- =============================================
CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_connections_follower ON connections(follower_id);
CREATE INDEX IF NOT EXISTS idx_connections_following ON connections(following_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);

-- Enable RLS
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for re-running)
DROP POLICY IF EXISTS "Users can view their connections" ON connections;
DROP POLICY IF EXISTS "Users can create connections" ON connections;
DROP POLICY IF EXISTS "Users can update their connections" ON connections;
DROP POLICY IF EXISTS "Users can delete their connections" ON connections;

-- Users can see their own connections (as follower or following)
CREATE POLICY "Users can view their connections" ON connections
    FOR SELECT USING (
        follower_id = auth.uid() OR following_id = auth.uid()
    );

-- Users can create connections where they are the follower
CREATE POLICY "Users can create connections" ON connections
    FOR INSERT WITH CHECK (follower_id = auth.uid());

-- Users can update connections where they are involved
CREATE POLICY "Users can update their connections" ON connections
    FOR UPDATE USING (
        follower_id = auth.uid() OR following_id = auth.uid()
    );

-- Users can delete their own connections
CREATE POLICY "Users can delete their connections" ON connections
    FOR DELETE USING (
        follower_id = auth.uid() OR following_id = auth.uid()
    );

-- =============================================
-- Notifications Table
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for re-running)
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON notifications;

-- Users can only see their own notifications
CREATE POLICY "Users can view their notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

-- System can create notifications for any user (using service role)
-- For client-side, users can create notifications for others
CREATE POLICY "Users can create notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete their notifications" ON notifications
    FOR DELETE USING (user_id = auth.uid());

-- =============================================
-- Function to search users by username (for adding to Squad)
-- =============================================
CREATE OR REPLACE FUNCTION search_users_by_username(search_username TEXT)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_private BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ap.user_id,
        ap.username,
        ap.display_name,
        ap.avatar_url,
        ap.bio,
        COALESCE(ap.is_private, false) as is_private
    FROM athlete_profiles ap
    WHERE ap.username ILIKE '%' || search_username || '%'
    AND ap.user_id != auth.uid()
    AND ap.username IS NOT NULL
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Function to get user profile by invite code
-- =============================================
CREATE OR REPLACE FUNCTION get_user_by_invite_code(code UUID)
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_private BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ap.user_id,
        ap.display_name,
        ap.avatar_url,
        ap.bio,
        COALESCE(ap.is_private, false) as is_private
    FROM athlete_profiles ap
    WHERE ap.invite_code = code
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Enable realtime for notifications (if not already added)
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
END $$;

-- =============================================
-- Success! Squad social features are ready.
-- =============================================
