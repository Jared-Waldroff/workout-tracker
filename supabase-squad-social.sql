-- =============================================
-- SQUAD SYSTEM MIGRATION (Renamed from Crew)
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. DROP CREW TABLE (Cleanup if exists) & LEGACY CONNECTIONS
DROP TABLE IF EXISTS crew_members CASCADE;
DROP TABLE IF EXISTS connections CASCADE;

-- 2. CREATE SQUAD MEMBERS TABLE (Bidirectional)
CREATE TABLE IF NOT EXISTS squad_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique relationship and no self-referencing
    UNIQUE(requester_id, receiver_id),
    CONSTRAINT no_self_squad CHECK (requester_id != receiver_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_squad_requester ON squad_members(requester_id);
CREATE INDEX IF NOT EXISTS idx_squad_receiver ON squad_members(receiver_id);
CREATE INDEX IF NOT EXISTS idx_squad_status ON squad_members(status);

-- 3. ENABLE RLS
ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;

-- Policy: View if you are involved
CREATE POLICY "View own squad memberships" ON squad_members
    FOR SELECT USING (
        auth.uid() = requester_id OR auth.uid() = receiver_id
    );

-- Policy: Request to add someone (Insert)
CREATE POLICY "Send squad request" ON squad_members
    FOR INSERT WITH CHECK (
        auth.uid() = requester_id
    );

-- Policy: Accept/Reject request (Update)
-- Only the receiver can update the status (e.g. to 'accepted')
CREATE POLICY "Manage received squad requests" ON squad_members
    FOR UPDATE USING (
        auth.uid() = receiver_id
    );

-- Policy: Leave squad or cancel request (Delete)
CREATE POLICY "Remove squad member" ON squad_members
    FOR DELETE USING (
        auth.uid() = requester_id OR auth.uid() = receiver_id
    );

-- 4. HELPER FUNCTION: Get my squad IDs
-- Returns a list of user IDs that are in my squad (accepted status)
CREATE OR REPLACE FUNCTION get_squad_ids(p_user_id UUID)
RETURNS TABLE (member_id UUID) AS $$
BEGIN
    RETURN QUERY
    -- ID of person I requested and they accepted
    SELECT receiver_id as member_id
    FROM squad_members
    WHERE requester_id = p_user_id AND status = 'accepted'
    
    UNION
    
    -- ID of person who requested me and I accepted
    SELECT requester_id as member_id
    FROM squad_members
    WHERE receiver_id = p_user_id AND status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNCTION: Search Users (Updated to exclude current squad)
CREATE OR REPLACE FUNCTION search_new_squad(search_term TEXT)
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
    -- Exclude existing squad or pending requests
    AND NOT EXISTS (
        SELECT 1 FROM squad_members sm
        WHERE (sm.requester_id = auth.uid() AND sm.receiver_id = ap.user_id)
           OR (sm.receiver_id = auth.uid() AND sm.requester_id = ap.user_id)
    )
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
