import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAthleteProfile } from '../hooks/useAthleteProfile'
import { checkWorkoutForBadges, BADGE_DEFINITIONS } from '../data/badges'
import ExerciseSection from '../components/ExerciseSection'
import ConfirmDialog from '../components/ConfirmDialog'
import Footer from '../components/Footer'
import './ActiveWorkoutPage.css'

export default function ActiveWorkoutPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { addBadge, hasBadge } = useAthleteProfile()
    const [workout, setWorkout] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
    const [showIncompleteWarning, setShowIncompleteWarning] = useState(false)
    const [newBadge, setNewBadge] = useState(null)

    // Load workout directly from supabase to avoid hook dependency issues
    useEffect(() => {
        const loadWorkout = async () => {
            if (!id) {
                setLoading(false)
                return
            }

            setLoading(true)

            try {
                const { data, error } = await supabase
                    .from('workouts')
                    .select(`
                        *,
                        workout_exercises (
                            id,
                            order_index,
                            exercise:exercises (
                                id,
                                name,
                                muscle_group
                            ),
                            sets (
                                id,
                                weight,
                                reps,
                                is_completed,
                                completed_at,
                                created_at
                            )
                        )
                    `)
                    .eq('id', id)
                    .single()

                if (error) {
                    console.error('Error loading workout:', error)
                    setWorkout(null)
                } else if (data) {
                    // Sort exercises and sets
                    data.workout_exercises?.sort((a, b) => a.order_index - b.order_index)
                    data.workout_exercises?.forEach(we => {
                        we.sets?.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                    })
                    setWorkout(data)
                }
            } catch (err) {
                console.error('Exception loading workout:', err)
                setWorkout(null)
            }

            setLoading(false)
        }

        loadWorkout()
    }, [id])

    // Calculate set completion stats
    const getAllSets = () => {
        if (!workout?.workout_exercises) return []
        return workout.workout_exercises.flatMap(we => we.sets || [])
    }

    const allSets = getAllSets()
    const completedSets = allSets.filter(s => s.is_completed)
    const totalSets = allSets.length
    const allSetsComplete = totalSets > 0 && completedSets.length === totalSets

    const handleCompleteWorkout = async () => {
        const newStatus = !workout.is_completed

        // Update locally immediately
        setWorkout(prev => ({ ...prev, is_completed: newStatus }))
        setShowCompleteConfirm(false)

        // Update in database
        await supabase
            .from('workouts')
            .update({ is_completed: newStatus })
            .eq('id', workout.id)

        // Check for race badges if completing workout
        if (newStatus) {
            const earnedBadges = checkWorkoutForBadges({ ...workout, is_completed: true })
            for (const badgeId of earnedBadges) {
                if (!hasBadge(badgeId)) {
                    await addBadge(badgeId)
                    setNewBadge(BADGE_DEFINITIONS[badgeId])
                    break // Show one badge at a time
                }
            }
        }
    }

    const handleCompleteClick = () => {
        if (workout.is_completed) {
            // Allow marking incomplete anytime
            setShowCompleteConfirm(true)
        } else if (!allSetsComplete) {
            // Show popup if trying to complete without all sets done
            setShowIncompleteWarning(true)
        } else {
            setShowCompleteConfirm(true)
        }
    }

    const handleDeleteWorkout = async () => {
        await supabase
            .from('workouts')
            .delete()
            .eq('id', workout.id)
        navigate('/')
    }

    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00')
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        })
    }

    if (loading) {
        return (
            <div className="active-workout-page">
                <div className="loading-container">
                    <div className="spinner" />
                    <p>Loading workout...</p>
                </div>
            </div>
        )
    }

    if (!workout) {
        return (
            <div className="active-workout-page">
                <div className="error-container">
                    <p>Workout not found</p>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>
                        Go Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="active-workout-page">
            <header className="workout-header glass safe-top">
                <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <div className="workout-header-info">
                    <h1 className="workout-title">{workout.name}</h1>
                    <span className="workout-date">{formatDate(workout.scheduled_date)}</span>
                </div>
                <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => setShowDeleteConfirm(true)}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>
            </header>

            <main className="workout-content">
                <div
                    className="workout-color-bar"
                    style={{ background: workout.color }}
                />

                {workout.is_completed && (
                    <div className="workout-completed-banner">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span>Workout Completed!</span>
                    </div>
                )}

                <div className="exercises-list">
                    {workout.workout_exercises?.map(we => (
                        <ExerciseSection
                            key={we.id}
                            workoutExercise={we}
                        />
                    ))}
                </div>

                {workout.workout_exercises?.length === 0 && (
                    <div className="empty-exercises glass-subtle">
                        <p>No exercises in this workout</p>
                    </div>
                )}

                <button
                    className={`btn btn-lg w-full complete-btn ${workout.is_completed ? 'completed' : ''} ${!workout.is_completed && !allSetsComplete ? 'disabled' : ''}`}
                    onClick={handleCompleteClick}
                >
                    {workout.is_completed ? (
                        <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                            </svg>
                            Mark as Incomplete
                        </>
                    ) : (
                        <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {allSetsComplete
                                ? 'Complete Workout'
                                : `Complete Sets (${completedSets.length}/${totalSets})`
                            }
                        </>
                    )}
                </button>
            </main>

            <Footer />

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Workout"
                message="Are you sure you want to delete this workout? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
                onConfirm={handleDeleteWorkout}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            <ConfirmDialog
                isOpen={showCompleteConfirm}
                title={workout.is_completed ? "Mark Incomplete" : "Complete Workout"}
                message={workout.is_completed
                    ? "Mark this workout as incomplete?"
                    : "Mark this workout as completed?"}
                confirmText={workout.is_completed ? "Mark Incomplete" : "Complete"}
                onConfirm={handleCompleteWorkout}
                onCancel={() => setShowCompleteConfirm(false)}
            />

            <ConfirmDialog
                isOpen={showIncompleteWarning}
                title="Incomplete Sets"
                message={`Complete all sets first! You've finished ${completedSets.length} of ${totalSets} sets.`}
                confirmText="Got it"
                onConfirm={() => setShowIncompleteWarning(false)}
                onCancel={() => setShowIncompleteWarning(false)}
            />

            {/* Badge Earned Celebration */}
            {newBadge && (
                <div className="badge-earned-overlay" onClick={() => setNewBadge(null)}>
                    <div className="badge-earned-modal">
                        <div className="badge-earned-emoji">{newBadge.emoji}</div>
                        <h2>Achievement Unlocked!</h2>
                        <h3>{newBadge.name}</h3>
                        <p>{newBadge.description}</p>
                        <button className="btn btn-primary" onClick={() => setNewBadge(null)}>
                            Awesome!
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
