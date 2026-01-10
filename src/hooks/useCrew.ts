import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export interface CrewMember {
    user_id: string; // The OTHER person's ID (profile owner) - also acts as unique key
    display_name: string;
    avatar_url: string;
    username: string;
    relationship_id: string; // ID of the crew_members row
    status: 'accepted' | 'pending';
    direction: 'incoming' | 'outgoing' | 'confirmed';
}

export function useCrew() {
    const { user } = useAuth();
    const [crew, setCrew] = useState<CrewMember[]>([]);
    const [requests, setRequests] = useState<CrewMember[]>([]); // Incoming requests to me
    const [sentRequests, setSentRequests] = useState<CrewMember[]>([]); // Outgoing requests
    const [loading, setLoading] = useState(true);

    const loadCrew = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            // 1. Fetch relationships (raw IDs)
            const { data: relationships, error: relError } = await supabase
                .from('crew_members')
                .select('*')
                .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

            if (relError) throw relError;

            // 2. Collect all user IDs to fetch profiles for
            const userIds = new Set<string>();
            relationships?.forEach((row: any) => {
                if (row.requester_id !== user.id) userIds.add(row.requester_id);
                if (row.receiver_id !== user.id) userIds.add(row.receiver_id);
            });

            // 3. Fetch profiles
            const { data: profiles, error: profileError } = await supabase
                .from('athlete_profiles')
                .select('user_id, display_name, avatar_url, username')
                .in('user_id', Array.from(userIds));

            if (profileError) throw profileError;

            // Map profiles for easy lookup
            const profileMap = new Map();
            profiles?.forEach(p => profileMap.set(p.user_id, p));

            const confirmed: CrewMember[] = [];
            const incoming: CrewMember[] = [];
            const outgoing: CrewMember[] = [];

            relationships?.forEach((row: any) => {
                const isRequester = row.requester_id === user.id;
                // Identifying the 'other' person
                const otherId = isRequester ? row.receiver_id : row.requester_id;
                const profile = profileMap.get(otherId);

                // If profile missing (or self?), skip
                if (!profile) return;

                const member: CrewMember = {
                    user_id: profile.user_id,
                    display_name: profile.display_name,
                    avatar_url: profile.avatar_url,
                    username: profile.username,
                    relationship_id: row.id,
                    status: row.status,
                    direction: 'confirmed'
                };

                if (row.status === 'accepted') {
                    member.direction = 'confirmed';
                    confirmed.push(member);
                } else if (row.status === 'pending') {
                    if (isRequester) {
                        member.direction = 'outgoing';
                        outgoing.push(member);
                    } else {
                        member.direction = 'incoming';
                        incoming.push(member);
                    }
                }
            });

            setCrew(confirmed);
            setRequests(incoming);
            setSentRequests(outgoing);
        } catch (err) {
            console.error('Error loading crew:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Add (Send Request)
    const addCrewMember = async (targetUserId: string) => {
        if (!user) return { error: 'Not authenticated' };
        try {
            const { error } = await supabase
                .from('crew_members')
                .insert({
                    requester_id: user.id,
                    receiver_id: targetUserId,
                    status: 'pending'
                });

            if (error) throw error;
            await loadCrew();
            return { error: null };
        } catch (err: any) {
            console.error('Error adding crew member:', err);
            return { error: err.message };
        }
    };

    // Accept Request
    const acceptCrewRequest = async (relationshipId: string) => {
        try {
            const { error } = await supabase
                .from('crew_members')
                .update({ status: 'accepted' })
                .eq('id', relationshipId);

            if (error) throw error;
            await loadCrew();
            return { error: null };
        } catch (err: any) {
            console.error('Error accepting request:', err);
            return { error: err.message };
        }
    };

    // Reject / Cancel / Remove
    const removeCrewMember = async (relationshipId: string) => {
        try {
            const { error } = await supabase
                .from('crew_members')
                .delete()
                .eq('id', relationshipId);

            if (error) throw error;
            await loadCrew();
            return { error: null };
        } catch (err: any) {
            console.error('Error removing crew member:', err);
            return { error: err.message };
        }
    };

    // Search Users (New Crew)
    const searchUsers = async (query: string) => {
        if (!query || query.length < 3) return [];
        try {
            const { data, error } = await supabase
                .rpc('search_new_crew', { search_term: query });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error searching users:', err);
            return [];
        }
    };

    useEffect(() => {
        loadCrew();
    }, [loadCrew]);

    return {
        crew,
        requests,
        sentRequests,
        loading,
        loadCrew,
        addCrewMember,
        acceptCrewRequest,
        removeCrewMember,
        searchUsers
    };
}
