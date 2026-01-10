-- =============================================
-- CREW SYSTEM MIGRATION (Mutual Support)
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. DROP LEGACY TABLE (Followers/Following)
DROP TABLE IF EXISTS connections CASCADE;

-- 2. CREATE CREW MEMBERS TABLE (Bidirectional)
CREATE TABLE IF NOT EXISTS crew_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique relationship and no self-referencing
    UNIQUE(requester_id, receiver_id),
    CONSTRAINT no_self_crew CHECK (requester_id != receiver_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crew_requester ON crew_members(requester_id);
CREATE INDEX IF NOT EXISTS idx_crew_receiver ON crew_members(receiver_id);
CREATE INDEX IF NOT EXISTS idx_crew_status ON crew_members(status);

-- 3. ENABLE RLS
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;

-- Policy: View if you are involved
CREATE POLICY "View own crew memberships" ON crew_members
    FOR SELECT USING (
        auth.uid() = requester_id OR auth.uid() = receiver_id
    );

-- Policy: Request to add someone (Insert)
CREATE POLICY "Send crew request" ON crew_members
    FOR INSERT WITH CHECK (
        auth.uid() = requester_id
    );

-- Policy: Accept/Reject request (Update)
-- Only the receiver can update the status (e.g. to 'accepted')
CREATE POLICY "Manage received requests" ON crew_members
    FOR UPDATE USING (
        auth.uid() = receiver_id
    );

-- Policy: Leave crew or cancel request (Delete)
CREATE POLICY "Remove crew member" ON crew_members
    FOR DELETE USING (
        auth.uid() = requester_id OR auth.uid() = receiver_id
    );

-- 4. HELPER FUNCTION: Get my crew IDs
-- Returns a list of user IDs that are in my crew (accepted status)
CREATE OR REPLACE FUNCTION get_crew_ids(p_user_id UUID)
RETURNS TABLE (member_id UUID) AS $$
BEGIN
    RETURN QUERY
    -- ID of person I requested and they accepted
    SELECT receiver_id as member_id
    FROM crew_members
    WHERE requester_id = p_user_id AND status = 'accepted'
    
    UNION
    
    -- ID of person who requested me and I accepted
    SELECT requester_id as member_id
    FROM crew_members
    WHERE receiver_id = p_user_id AND status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNCTION: Search Users (Updated to exclude current crew)
-- This replaces the previous search function to be more smart
CREATE OR REPLACE FUNCTION search_new_crew(search_term TEXT)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ap.user_id,
        ap.username,
        ap.display_name,
        ap.avatar_url
    FROM athlete_profiles ap
    WHERE (
        ap.username ILIKE '%' || search_term || '%' OR
        ap.display_name ILIKE '%' || search_term || '%'
    )
    AND ap.user_id != auth.uid()
    -- Exclude existing crew or pending requests
    AND NOT EXISTS (
        SELECT 1 FROM crew_members cm
        WHERE (cm.requester_id = auth.uid() AND cm.receiver_id = ap.user_id)
           OR (cm.receiver_id = auth.uid() AND cm.requester_id = ap.user_id)
    )
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done!
