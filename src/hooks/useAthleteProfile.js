import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const DEFAULT_PROFILE = {
    // Display fields
    display_name: null,
    bio: null,
    avatar_url: null,
    badges: [],

    // Training background
    fitness_level: 'intermediate',
    primary_goal: null,
    secondary_goals: [],
    injuries_limitations: null,
    equipment_access: 'full_gym',
    sleep_hours_avg: 7,
    sleep_quality: 'good',
    nutrition_approach: null,
    daily_calories_target: null,
    protein_target_grams: null,
    work_physical_demand: 'sedentary',
    work_hours_per_day: 8,
    stress_level: 'moderate',
    preferred_training_days: [],
    session_duration_minutes: 60,
    training_experience_years: null,
    strength_experience: 3,
    running_experience: 3,
    cycling_experience: 2,
    swimming_experience: 1,
    hyrox_experience: 1,
    crossfit_experience: 2,
    kettlebell_experience: 2,
    mobility_experience: 2,
    last_coach_summary: null,
    coach_notes: null
}

export function useAthleteProfile() {
    const { user } = useAuth()
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Load profile from database
    const loadProfile = useCallback(async () => {
        if (!user) {
            setProfile(null)
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { data, error: fetchError } = await supabase
                .from('athlete_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (fetchError && fetchError.code !== 'PGRST116') {
                // PGRST116 = no rows returned (profile doesn't exist yet)
                throw fetchError
            }

            setProfile(data || null)
        } catch (err) {
            console.error('Error loading athlete profile:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [user])

    // Create or update profile
    const saveProfile = useCallback(async (updates) => {
        if (!user) return { error: 'Not authenticated' }

        try {
            const profileData = {
                user_id: user.id,
                ...updates
            }

            const { data, error: saveError } = await supabase
                .from('athlete_profiles')
                .upsert(profileData, {
                    onConflict: 'user_id',
                    returning: 'representation'
                })
                .select()
                .single()

            if (saveError) throw saveError

            setProfile(data)
            return { data, error: null }
        } catch (err) {
            console.error('Error saving athlete profile:', err)
            return { data: null, error: err.message }
        }
    }, [user])

    // Update specific fields
    const updateProfile = useCallback(async (updates) => {
        const merged = { ...profile, ...updates }
        return saveProfile(merged)
    }, [profile, saveProfile])

    // Get profile summary for AI context
    const getProfileSummary = useCallback(() => {
        if (!profile) return null

        const lines = []

        // Training background
        if (profile.fitness_level) {
            lines.push(`Fitness Level: ${profile.fitness_level}`)
        }
        if (profile.primary_goal) {
            lines.push(`Primary Goal: ${profile.primary_goal}`)
        }
        if (profile.injuries_limitations) {
            lines.push(`Injuries/Limitations: ${profile.injuries_limitations}`)
        }
        if (profile.equipment_access) {
            lines.push(`Equipment: ${profile.equipment_access}`)
        }
        if (profile.training_experience_years) {
            lines.push(`Experience: ${profile.training_experience_years} years`)
        }

        // Lifestyle
        if (profile.sleep_hours_avg) {
            lines.push(`Sleep: ${profile.sleep_hours_avg} hours/night (${profile.sleep_quality || 'unknown'} quality)`)
        }
        if (profile.work_physical_demand) {
            lines.push(`Work Demand: ${profile.work_physical_demand}`)
        }
        if (profile.stress_level) {
            lines.push(`Stress Level: ${profile.stress_level}`)
        }

        // Training preferences
        if (profile.session_duration_minutes) {
            lines.push(`Session Duration: ${profile.session_duration_minutes} minutes`)
        }
        if (profile.preferred_training_days?.length > 0) {
            lines.push(`Preferred Days: ${profile.preferred_training_days.join(', ')}`)
        }

        // Experience levels
        const experiences = []
        if (profile.strength_experience >= 4) experiences.push('strength')
        if (profile.running_experience >= 4) experiences.push('running')
        if (profile.cycling_experience >= 4) experiences.push('cycling')
        if (profile.swimming_experience >= 4) experiences.push('swimming')
        if (profile.hyrox_experience >= 4) experiences.push('hyrox')
        if (profile.crossfit_experience >= 4) experiences.push('crossfit')
        if (experiences.length > 0) {
            lines.push(`Strong in: ${experiences.join(', ')}`)
        }

        return lines.length > 0 ? lines.join('\n') : null
    }, [profile])

    // Upload avatar image to Supabase Storage
    const uploadAvatar = useCallback(async (file) => {
        if (!user) return { error: 'Not authenticated' }

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}/avatar.${fileExt}`

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, {
                    upsert: true,
                    contentType: file.type
                })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName)

            // Add cache-buster to force refresh
            const avatarUrl = `${publicUrl}?t=${Date.now()}`

            // Update profile with new avatar URL
            await updateProfile({ avatar_url: avatarUrl })

            return { data: avatarUrl, error: null }
        } catch (err) {
            console.error('Error uploading avatar:', err)
            return { data: null, error: err.message }
        }
    }, [user, updateProfile])

    // Add a badge to profile
    const addBadge = useCallback(async (badgeId, metadata = {}) => {
        if (!profile) return { error: 'No profile' }

        const currentBadges = profile.badges || []

        // Check if badge already earned
        if (currentBadges.some(b => b.id === badgeId)) {
            return { error: 'Badge already earned' }
        }

        const newBadge = {
            id: badgeId,
            earned_at: new Date().toISOString(),
            ...metadata
        }

        const updatedBadges = [...currentBadges, newBadge]
        return updateProfile({ badges: updatedBadges })
    }, [profile, updateProfile])

    // Remove a badge from profile
    const removeBadge = useCallback(async (badgeId) => {
        if (!profile) return { error: 'No profile' }

        const updatedBadges = (profile.badges || []).filter(b => b.id !== badgeId)
        return updateProfile({ badges: updatedBadges })
    }, [profile, updateProfile])

    // Check if user has a specific badge
    const hasBadge = useCallback((badgeId) => {
        return (profile?.badges || []).some(b => b.id === badgeId)
    }, [profile])

    // Load on mount
    useEffect(() => {
        loadProfile()
    }, [loadProfile])

    return {
        profile: profile || DEFAULT_PROFILE,
        hasProfile: !!profile,
        loading,
        error,
        loadProfile,
        saveProfile,
        updateProfile,
        getProfileSummary,
        uploadAvatar,
        addBadge,
        removeBadge,
        hasBadge
    }
}
