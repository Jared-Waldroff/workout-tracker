import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useConnections } from '../hooks/useConnections'
import { BADGE_DEFINITIONS } from '../data/badges'
import Header from '../components/Header'
import Footer from '../components/Footer'
import GlassCard from '../components/GlassCard'
import ConfirmDialog from '../components/ConfirmDialog'
import './AthleteProfilePage.css'

export default function AthleteProfilePage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { followUser, unfollowUser, isFollowing } = useConnections()

    const [athlete, setAthlete] = useState(null)
    const [profile, setProfile] = useState(null)
    const [workouts, setWorkouts] = useState([])
    const [loading, setLoading] = useState(true)
    const [following, setFollowing] = useState(false)
    const [canViewWorkouts, setCanViewWorkouts] = useState(false)
    const [pendingRequest, setPendingRequest] = useState(false)
    const [showCopyDialog, setShowCopyDialog] = useState(false)
    const [selectedWorkout, setSelectedWorkout] = useState(null)

    // Load athlete profile
    useEffect(() => {
        const loadAthlete = async () => {
            if (!id) return

            setLoading(true)

            try {
                // Get user and profile
                const { data: profileData } = await supabase
                    .from('athlete_profiles')
                    .select('*')
                    .eq('user_id', id)
                    .single()

                setProfile(profileData)

                // Check if we're following them
                const isAlreadyFollowing = isFollowing(id)
                setFollowing(isAlreadyFollowing)

                // Check if we can view their workouts
                const canView = !profileData?.is_private || isAlreadyFollowing || id === user?.id
                setCanViewWorkouts(canView)

                // Check pending request
                const { data: connectionData } = await supabase
                    .from('connections')
                    .select('status')
                    .eq('follower_id', user?.id)
                    .eq('following_id', id)
                    .single()

                if (connectionData?.status === 'pending') {
                    setPendingRequest(true)
                }

                // Load workouts if allowed
                if (canView) {
                    const thirtyDaysAgo = new Date()
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

                    const { data: workoutData } = await supabase
                        .from('workouts')
                        .select(`
                            *,
                            workout_exercises (
                                id,
                                exercise:exercises (
                                    id,
                                    name,
                                    muscle_group
                                )
                            )
                        `)
                        .eq('user_id', id)
                        .gte('scheduled_date', thirtyDaysAgo.toISOString().split('T')[0])
                        .order('scheduled_date', { ascending: false })
                        .limit(20)

                    setWorkouts(workoutData || [])
                }
            } catch (err) {
                console.error('Error loading athlete:', err)
            } finally {
                setLoading(false)
            }
        }

        loadAthlete()
    }, [id, user, isFollowing])

    const handleFollow = async () => {
        const result = await followUser(id)
        if (!result.error) {
            if (result.status === 'pending') {
                setPendingRequest(true)
            } else {
                setFollowing(true)
                setCanViewWorkouts(true)
            }
        }
    }

    const handleUnfollow = async () => {
        const result = await unfollowUser(id)
        if (!result.error) {
            setFollowing(false)
            if (profile?.is_private) {
                setCanViewWorkouts(false)
            }
        }
    }

    const handleCopyWorkout = (workout) => {
        setSelectedWorkout(workout)
        setShowCopyDialog(true)
    }

    const copyExercisesOnly = async () => {
        if (!selectedWorkout) return

        // Navigate to create workout with exercises pre-selected
        const exerciseIds = selectedWorkout.workout_exercises.map(we => we.exercise.id)
        navigate('/create-workout', {
            state: {
                prefillExercises: exerciseIds,
                fromAthlete: profile?.display_name || 'Squad Member'
            }
        })
        setShowCopyDialog(false)
    }

    const copyFullWorkout = async () => {
        if (!selectedWorkout) return

        // Create new workout with same name and exercises
        const today = new Date().toISOString().split('T')[0]

        try {
            const { data: newWorkout, error: workoutError } = await supabase
                .from('workouts')
                .insert({
                    user_id: user.id,
                    name: `${selectedWorkout.name} (from ${profile?.display_name || 'Squad'})`,
                    scheduled_date: today,
                    color: selectedWorkout.color
                })
                .select()
                .single()

            if (workoutError) throw workoutError

            // Copy exercises
            const exercisesToAdd = selectedWorkout.workout_exercises.map((we, idx) => ({
                workout_id: newWorkout.id,
                exercise_id: we.exercise.id,
                order_index: idx
            }))

            await supabase.from('workout_exercises').insert(exercisesToAdd)

            navigate(`/workout/${newWorkout.id}`)
        } catch (err) {
            console.error('Error copying workout:', err)
            alert('Failed to copy workout')
        }

        setShowCopyDialog(false)
    }

    const getInitials = (name) => {
        if (!name) return '?'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    const formatDate = (dateStr) => {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        })
    }

    if (loading) {
        return (
            <div className="athlete-profile-page">
                <Header />
                <div className="loading-container">
                    <div className="spinner" />
                    <p>Loading profile...</p>
                </div>
                <Footer />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="athlete-profile-page">
                <Header />
                <div className="error-container">
                    <p>Athlete not found</p>
                    <button className="btn btn-primary" onClick={() => navigate('/squad')}>
                        Back to Squad
                    </button>
                </div>
                <Footer />
            </div>
        )
    }

    return (
        <div className="athlete-profile-page">
            <header className="page-header glass">
                <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1>{profile.display_name || 'Athlete'}</h1>
                <div style={{ width: 40 }} />
            </header>

            <main className="athlete-content">
                {/* Profile Card */}
                <GlassCard className="athlete-card">
                    <div className="athlete-header">
                        <div className="athlete-avatar">
                            {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="" />
                            ) : (
                                <div className="avatar-placeholder">
                                    {getInitials(profile.display_name)}
                                </div>
                            )}
                        </div>
                        <div className="athlete-info">
                            <h2>{profile.display_name || 'Hybrid Athlete'}</h2>
                            {profile.bio && <p className="athlete-bio">{profile.bio}</p>}
                        </div>
                    </div>

                    {/* Badges */}
                    {profile.badges?.length > 0 && (
                        <div className="athlete-badges">
                            {profile.badges.map(badge => {
                                const def = BADGE_DEFINITIONS[badge.id]
                                if (!def) return null
                                return (
                                    <div key={badge.id} className="badge-item" title={def.description}>
                                        <span className="badge-emoji">{def.emoji}</span>
                                        <span className="badge-name">{def.name}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Follow Button */}
                    {id !== user?.id && (
                        <div className="follow-section">
                            {following ? (
                                <button className="btn btn-secondary w-full" onClick={handleUnfollow}>
                                    In Your Squad ✓
                                </button>
                            ) : pendingRequest ? (
                                <button className="btn btn-secondary w-full" disabled>
                                    Request Pending...
                                </button>
                            ) : (
                                <button className="btn btn-primary w-full" onClick={handleFollow}>
                                    {profile.is_private ? 'Request to Join Squad' : 'Add to Squad'}
                                </button>
                            )}
                        </div>
                    )}
                </GlassCard>

                {/* Workouts */}
                {canViewWorkouts ? (
                    <div className="athlete-workouts">
                        <h3>Recent Workouts</h3>
                        {workouts.length === 0 ? (
                            <GlassCard className="no-workouts">
                                <p>No recent workouts</p>
                            </GlassCard>
                        ) : (
                            <div className="workouts-list">
                                {workouts.map(workout => (
                                    <GlassCard key={workout.id} className="workout-card">
                                        <div className="workout-header">
                                            <div
                                                className="workout-color"
                                                style={{ background: workout.color || '#1e3a5f' }}
                                            />
                                            <div className="workout-info">
                                                <h4>{workout.name}</h4>
                                                <span>{formatDate(workout.scheduled_date)}</span>
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-icon copy-btn"
                                                onClick={() => handleCopyWorkout(workout)}
                                                title="Copy workout"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="workout-exercises">
                                            {workout.workout_exercises?.slice(0, 4).map(we => (
                                                <span key={we.id} className="exercise-tag">
                                                    {we.exercise.name}
                                                </span>
                                            ))}
                                            {workout.workout_exercises?.length > 4 && (
                                                <span className="exercise-more">
                                                    +{workout.workout_exercises.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <GlassCard className="private-notice">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <h4>Private Account</h4>
                        <p>This athlete's workouts are private. Send a request to join their Squad to see their training.</p>
                    </GlassCard>
                )}
            </main>

            <Footer />

            {/* Copy Workout Dialog */}
            {showCopyDialog && selectedWorkout && (
                <div className="modal-overlay" onClick={() => setShowCopyDialog(false)}>
                    <div className="copy-modal" onClick={e => e.stopPropagation()}>
                        <h3>Copy Workout</h3>
                        <p>How would you like to copy "{selectedWorkout.name}"?</p>

                        <div className="copy-options">
                            <button className="copy-option" onClick={copyExercisesOnly}>
                                <div className="option-icon">📋</div>
                                <div className="option-info">
                                    <h4>Exercises Only</h4>
                                    <p>Add these exercises to a new workout</p>
                                </div>
                            </button>

                            <button className="copy-option" onClick={copyFullWorkout}>
                                <div className="option-icon">📦</div>
                                <div className="option-info">
                                    <h4>Full Workout</h4>
                                    <p>Copy workout name, color, and all exercises</p>
                                </div>
                            </button>
                        </div>

                        <button
                            className="btn btn-secondary w-full"
                            onClick={() => setShowCopyDialog(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
