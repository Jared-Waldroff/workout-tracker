import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Image } from 'expo-image';

// Types
export interface SquadEvent {
    id: string;
    creator_id: string;
    name: string;
    event_type: string;
    description: string | null;
    event_date: string;
    cover_image_url: string | null;
    is_private: boolean;
    visibility: 'public' | 'squad' | 'invite_only';
    invite_code: string | null;
    template_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Joined data
    creator?: {
        display_name: string;
        avatar_url: string;
    };
    participant_count?: number;
    is_participating?: boolean;
}

export interface EventParticipant {
    id: string;
    event_id: string;
    user_id: string;
    notification_frequency: 'daily' | 'weekly' | 'biweekly' | 'none';
    joined_at: string;
    // Joined data
    profile?: {
        display_name: string;
        avatar_url: string;
    };
}

export interface TrainingWorkout {
    id: string;
    event_id: string;
    name: string;
    description: string | null;
    workout_type: 'distance' | 'time' | 'weight' | 'reps' | 'zone' | 'custom';
    target_value: number | null;
    target_unit: string | null;
    target_zone: 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5' | null;
    target_notes: string | null;
    days_before_event: number;
    is_required: boolean;
    order_index: number;
    color: string;
    created_at: string;
    // Computed
    scheduled_date?: string;
    is_completed?: boolean;
}

export interface EventTemplate {
    id: string;
    name: string;
    event_type: string;
    description: string | null;
    duration_weeks: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    training_plan: any[];
    is_featured: boolean;
}

export interface CreateEventInput {
    name: string;
    event_type: string;
    description?: string;
    event_date: string;
    cover_image_url?: string;
    is_private?: boolean;
    visibility?: 'public' | 'squad' | 'invite_only';
    invite_code?: string;
    template_id?: string;
}

export interface CreateTrainingWorkoutInput {
    name: string;
    description?: string;
    workout_type: 'distance' | 'time' | 'weight' | 'reps' | 'zone' | 'custom';
    target_value?: number;
    target_unit?: string;
    target_zone?: 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5';
    target_notes?: string;
    days_before_event: number;
    is_required?: boolean;
    order_index?: number;
    color?: string;
}

export function useSquadEvents() {
    const { user } = useAuth();
    const [events, setEvents] = useState<SquadEvent[]>([]);
    const [myEvents, setMyEvents] = useState<SquadEvent[]>([]);
    const [templates, setTemplates] = useState<EventTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load all accessible events
    const loadEvents = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            setError(null);

            // Get all public events + private events user is participating in
            const { data, error: fetchError } = await supabase
                .from('squad_events')
                .select(`
                    *,
                    participants:event_participants(count)
                `)
                .eq('is_active', true)
                .order('event_date', { ascending: true });

            if (fetchError) throw fetchError;

            // Check which events user is participating in
            const { data: participations } = await supabase
                .from('event_participants')
                .select('event_id')
                .eq('user_id', user.id);

            const participatingIds = new Set(participations?.map(p => p.event_id) || []);

            // Get creator profiles
            const creatorIds = [...new Set((data || []).map(e => e.creator_id))];
            const { data: profiles } = await supabase
                .from('athlete_profiles')
                .select('user_id, display_name, avatar_url')
                .in('user_id', creatorIds);

            const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

            const eventsWithMeta = (data || []).map(event => ({
                ...event,
                creator: profileMap.get(event.creator_id),
                participant_count: event.participants?.[0]?.count || 0,
                is_participating: participatingIds.has(event.id),
            }));

            setEvents(eventsWithMeta);
            setMyEvents(eventsWithMeta.filter(e => e.is_participating || e.creator_id === user.id));

            // Prefetch cover images to improved perceived performance
            const imagesToPrefetch = eventsWithMeta
                .map(e => e.cover_image_url)
                .filter(url => url !== null) as string[];

            if (imagesToPrefetch.length > 0) {
                Image.prefetch(imagesToPrefetch);
            }

        } catch (err: any) {
            console.error('Error loading events:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Load event templates
    const loadTemplates = useCallback(async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('event_templates')
                .select('*')
                .order('is_featured', { ascending: false });

            if (fetchError) throw fetchError;
            setTemplates(data || []);
        } catch (err: any) {
            console.error('Error loading templates:', err);
        }
    }, []);

    // Get single event by ID
    const getEventById = useCallback(async (eventId: string): Promise<SquadEvent | null> => {
        try {
            const { data, error: fetchError } = await supabase
                .from('squad_events')
                .select(`
                    *,
                    participants:event_participants(count)
                `)
                .eq('id', eventId)
                .single();

            if (fetchError) throw fetchError;

            // Get creator profile
            const { data: creatorProfile } = await supabase
                .from('athlete_profiles')
                .select('display_name, avatar_url')
                .eq('user_id', data.creator_id)
                .single();

            // Check if current user is participating
            const { data: participation } = await supabase
                .from('event_participants')
                .select('id')
                .eq('event_id', eventId)
                .eq('user_id', user?.id)
                .single();

            return {
                ...data,
                creator: creatorProfile,
                participant_count: data.participants?.[0]?.count || 0,
                is_participating: !!participation,
            };
        } catch (err: any) {
            console.error('Error getting event:', err);
            return null;
        }
    }, [user]);

    // Create new event
    const createEvent = useCallback(async (
        eventInput: CreateEventInput,
        trainingPlan?: CreateTrainingWorkoutInput[]
    ): Promise<{ event: SquadEvent | null; error: string | null }> => {
        if (!user) return { event: null, error: 'Not authenticated' };

        try {
            // Create the event
            const { data: eventData, error: eventError } = await supabase
                .from('squad_events')
                .insert({
                    creator_id: user.id,
                    ...eventInput,
                })
                .select()
                .single();

            if (eventError) throw eventError;

            // If training plan provided, create the workouts
            if (trainingPlan && trainingPlan.length > 0) {
                const workoutsToInsert = trainingPlan.map((workout, index) => ({
                    event_id: eventData.id,
                    ...workout,
                    order_index: workout.order_index ?? index,
                }));

                const { error: workoutsError } = await supabase
                    .from('event_training_workouts')
                    .insert(workoutsToInsert);

                if (workoutsError) throw workoutsError;
            }

            // Auto-join the creator as a participant
            await supabase
                .from('event_participants')
                .insert({
                    event_id: eventData.id,
                    user_id: user.id,
                    notification_frequency: 'weekly',
                });

            // Refresh events list
            await loadEvents();

            return { event: eventData, error: null };
        } catch (err: any) {
            console.error('Error creating event:', err);
            return { event: null, error: err.message };
        }
    }, [user, loadEvents]);

    // Create event from template
    const createEventFromTemplate = useCallback(async (
        templateId: string,
        eventName: string,
        eventDate: string,
        isPrivate: boolean = false
    ): Promise<{ event: SquadEvent | null; error: string | null }> => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return { event: null, error: 'Template not found' };

        const trainingPlan = template.training_plan.map((workout: any) => ({
            name: workout.name,
            description: workout.description,
            workout_type: workout.workout_type,
            target_value: workout.target_value,
            target_unit: workout.target_unit,
            target_zone: workout.target_zone,
            target_notes: workout.target_notes,
            days_before_event: workout.days_before_event,
            is_required: workout.is_required ?? true,
            color: workout.color || '#6366f1',
        }));

        return createEvent(
            {
                name: eventName,
                event_type: template.event_type,
                description: template.description || undefined,
                event_date: eventDate,
                is_private: isPrivate,
                template_id: templateId,
            },
            trainingPlan
        );
    }, [templates, createEvent]);

    // Join an event
    const joinEvent = useCallback(async (
        eventId: string,
        notificationFrequency: 'daily' | 'weekly' | 'biweekly' | 'none' = 'weekly'
    ): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { error: joinError } = await supabase
                .from('event_participants')
                .insert({
                    event_id: eventId,
                    user_id: user.id,
                    notification_frequency: notificationFrequency,
                });

            if (joinError) throw joinError;

            await loadEvents();
            return { error: null };
        } catch (err: any) {
            console.error('Error joining event:', err);
            return { error: err.message };
        }
    }, [user, loadEvents]);

    // Leave an event
    const leaveEvent = useCallback(async (eventId: string): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { error: leaveError } = await supabase
                .from('event_participants')
                .delete()
                .eq('event_id', eventId)
                .eq('user_id', user.id);

            if (leaveError) throw leaveError;

            await loadEvents();
            return { error: null };
        } catch (err: any) {
            console.error('Error leaving event:', err);
            return { error: err.message };
        }
    }, [user, loadEvents]);

    // Update event (creator only)
    const updateEvent = useCallback(async (
        eventId: string,
        updates: Partial<CreateEventInput>
    ): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { data, error: updateError, count } = await supabase
                .from('squad_events')
                .update(updates)
                .eq('id', eventId)
                .eq('creator_id', user.id)
                .select();

            if (updateError) throw updateError;

            if (!data || data.length === 0) {
                console.error('No rows updated - check RLS policies');
                return { error: 'Update failed - you may not have permission to edit this event' };
            }

            console.log('Event updated successfully:', data);
            await loadEvents();
            return { error: null };
        } catch (err: any) {
            console.error('Error updating event:', err);
            return { error: err.message };
        }
    }, [user, loadEvents]);

    // Delete event (creator only)
    const deleteEvent = useCallback(async (eventId: string): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { error: deleteError } = await supabase
                .from('squad_events')
                .delete()
                .eq('id', eventId)
                .eq('creator_id', user.id);

            if (deleteError) throw deleteError;

            await loadEvents();
            return { error: null };
        } catch (err: any) {
            console.error('Error deleting event:', err);
            return { error: err.message };
        }
    }, [user, loadEvents]);

    // Get event participants
    const getEventParticipants = useCallback(async (eventId: string): Promise<EventParticipant[]> => {
        try {
            const { data, error: fetchError } = await supabase
                .from('event_participants')
                .select('*')
                .eq('event_id', eventId);

            if (fetchError) throw fetchError;

            // Get profiles for all participants
            const userIds = (data || []).map(p => p.user_id);
            const { data: profiles } = await supabase
                .from('athlete_profiles')
                .select('user_id, display_name, avatar_url')
                .in('user_id', userIds);

            const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

            return (data || []).map(participant => ({
                ...participant,
                profile: profileMap.get(participant.user_id),
            }));
        } catch (err: any) {
            console.error('Error getting participants:', err);
            return [];
        }
    }, []);

    // Get training plan for an event
    const getTrainingPlan = useCallback(async (eventId: string): Promise<TrainingWorkout[]> => {
        try {
            // Get event date first
            const { data: eventData } = await supabase
                .from('squad_events')
                .select('event_date')
                .eq('id', eventId)
                .single();

            if (!eventData) return [];

            const eventDate = new Date(eventData.event_date);

            // Get training workouts
            const { data, error: fetchError } = await supabase
                .from('event_training_workouts')
                .select('*')
                .eq('event_id', eventId)
                .order('days_before_event', { ascending: false });

            if (fetchError) throw fetchError;

            // Get user's completions
            const { data: completions } = await supabase
                .from('event_workout_completions')
                .select('training_workout_id')
                .eq('user_id', user?.id);

            const completedIds = new Set(completions?.map(c => c.training_workout_id) || []);

            // Calculate scheduled date for each workout
            return (data || []).map(workout => {
                const scheduledDate = new Date(eventDate);
                scheduledDate.setDate(scheduledDate.getDate() - workout.days_before_event);

                return {
                    ...workout,
                    scheduled_date: scheduledDate.toISOString().split('T')[0],
                    is_completed: completedIds.has(workout.id),
                };
            });
        } catch (err: any) {
            console.error('Error getting training plan:', err);
            return [];
        }
    }, [user]);

    // Update notification preference
    const updateNotificationPreference = useCallback(async (
        eventId: string,
        frequency: 'daily' | 'weekly' | 'biweekly' | 'none'
    ): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { error: updateError } = await supabase
                .from('event_participants')
                .update({ notification_frequency: frequency })
                .eq('event_id', eventId)
                .eq('user_id', user.id);

            if (updateError) throw updateError;
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    }, [user]);

    const addTrainingWorkout = async (eventId: string, workout: CreateTrainingWorkoutInput) => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { data, error } = await supabase
                .from('event_training_workouts')
                .insert({
                    event_id: eventId,
                    ...workout
                })
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: err.message };
        }
    };

    const deleteTrainingWorkout = async (workoutId: string) => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { error } = await supabase
                .from('event_training_workouts')
                .delete()
                .eq('id', workoutId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    };

    // Load on mount
    useEffect(() => {
        if (user) {
            loadEvents();
            loadTemplates();
        }
    }, [user, loadEvents, loadTemplates]);

    return {
        events,
        myEvents,
        templates,
        loading,
        error,
        loadEvents,
        loadTemplates,
        getEventById,
        createEvent,
        createEventFromTemplate,
        joinEvent,
        leaveEvent,
        updateEvent,
        deleteEvent,
        getEventParticipants,
        getTrainingPlan,
        updateNotificationPreference,
        addTrainingWorkout,
        deleteTrainingWorkout,
    };
}

// Event type options with icons
export const EVENT_TYPES = [
    { id: 'marathon', name: 'Marathon', icon: 'navigation' },
    { id: 'half_marathon', name: 'Half Marathon', icon: 'navigation' },
    { id: '5k', name: '5K', icon: 'navigation' },
    { id: '10k', name: '10K', icon: 'navigation' },
    { id: 'hyrox', name: 'HYROX', icon: 'zap' },
    { id: 'crossfit', name: 'CrossFit', icon: 'activity' },
    { id: 'triathlon', name: 'Triathlon', icon: 'award' },
    { id: 'cycling', name: 'Cycling', icon: 'disc' },
    { id: 'swimming', name: 'Swimming', icon: 'droplet' },
    { id: 'powerlifting', name: 'Powerlifting', icon: 'trending-up' },
    { id: 'trail_running', name: 'Trail Running', icon: 'sunrise' },
    { id: 'obstacle_race', name: 'Obstacle Race', icon: 'flag' },
    { id: 'custom', name: 'Custom Event', icon: 'star' },
];

// Workout type options
export const WORKOUT_TYPES = [
    { id: 'distance', name: 'Distance', units: ['km', 'miles', 'm'] },
    { id: 'time', name: 'Time', units: ['minutes', 'hours'] },
    { id: 'weight', name: 'Weight', units: ['kg', 'lbs'] },
    { id: 'reps', name: 'Reps', units: ['reps'] },
    { id: 'zone', name: 'Heart Rate Zone', units: [] },
    { id: 'custom', name: 'Custom', units: [] },
];

// Zone options
export const ZONES = [
    { id: 'zone1', name: 'Zone 1 - Recovery', color: '#10b981' },
    { id: 'zone2', name: 'Zone 2 - Endurance', color: '#3b82f6' },
    { id: 'zone3', name: 'Zone 3 - Tempo', color: '#f97316' },
    { id: 'zone4', name: 'Zone 4 - Threshold', color: '#ef4444' },
    { id: 'zone5', name: 'Zone 5 - Max', color: '#dc2626' },
];
