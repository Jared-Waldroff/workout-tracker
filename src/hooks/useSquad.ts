import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export interface SquadMember {
    user_id: string; // The OTHER person's ID (profile owner)
    display_name: string;
    avatar_url: string;
    username: string;
    relationship_id: string; // ID of the squad_members row
    status: 'accepted' | 'pending';
    direction: 'incoming' | 'outgoing' | 'confirmed';
}

export function useSquad() {
    const { user } = useAuth();
    const [squad, setSquad] = useState<SquadMember[]>([]);
    const [requests, setRequests] = useState<SquadMember[]>([]); // Incoming requests to me
    const [sentRequests, setSentRequests] = useState<SquadMember[]>([]); // Outgoing requests
    const [loading, setLoading] = useState(true);

    const loadSquad = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            // 1. Fetch relationships (raw IDs)
            const { data: relationships, error: relError } = await supabase
                .from('squad_members')
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

            const confirmed: SquadMember[] = [];
            const incoming: SquadMember[] = [];
            const outgoing: SquadMember[] = [];

            relationships?.forEach((row: any) => {
                const isRequester = row.requester_id === user.id;
                // Identifying the 'other' person
                const otherId = isRequester ? row.receiver_id : row.requester_id;
                const profile = profileMap.get(otherId);

                // If profile missing (or self?), skip
                if (!profile) return;

                const member: SquadMember = {
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

            setSquad(confirmed);
            setRequests(incoming);
            setSentRequests(outgoing);
        } catch (err) {
            console.error('Error loading squad:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Add (Send Request)
    const addSquadMember = async (targetUserId: string) => {
        if (!user) return { error: 'Not authenticated' };
        try {
            const { error } = await supabase
                .from('squad_members')
                .insert({
                    requester_id: user.id,
                    receiver_id: targetUserId,
                    status: 'pending'
                });

            if (error) throw error;
            await loadSquad();
            return { error: null };
        } catch (err: any) {
            console.error('Error adding squad member:', err);
            return { error: err.message };
        }
    };

    // Accept Request
    const acceptSquadRequest = async (relationshipId: string) => {
        try {
            const { error } = await supabase
                .from('squad_members')
                .update({ status: 'accepted' })
                .eq('id', relationshipId);

            if (error) throw error;
            await loadSquad();
            return { error: null };
        } catch (err: any) {
            console.error('Error accepting request:', err);
            return { error: err.message };
        }
    };

    // Reject / Cancel / Remove
    const removeSquadMember = async (relationshipId: string) => {
        try {
            const { error } = await supabase
                .from('squad_members')
                .delete()
                .eq('id', relationshipId);

            if (error) throw error;
            await loadSquad();
            return { error: null };
        } catch (err: any) {
            console.error('Error removing squad member:', err);
            return { error: err.message };
        }
    };

    // Search Users (New Squad)
    const searchUsers = async (query: string) => {
        if (!query || query.length < 3) return [];
        try {
            const { data, error } = await supabase
                .rpc('search_new_squad', { search_term: query });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error searching users:', err);
            return [];
        }
    };

    useEffect(() => {
        loadSquad();
    }, [loadSquad]);

    return {
        squad,
        requests,
        sentRequests,
        loading,
        loadSquad,
        addSquadMember,
        acceptSquadRequest,
        removeSquadMember,
        searchUsers
    };
}
