import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useWorkouts } from '../hooks/useWorkouts'
import { useExercises } from '../hooks/useExercises'
import ExerciseSelector from '../components/ExerciseSelector'
import ExerciseForm from '../components/ExerciseForm'
import GlassCard from '../components/GlassCard'
import Footer from '../components/Footer'
import './CreateWorkoutPage.css'

const WORKOUT_COLORS = [
    { name: 'Navy', value: '#1e3a5f' },
    { name: 'Copper', value: '#c9a227' },
    { name: 'Teal', value: '#115e59' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#6366f1' }
]

export default function CreateWorkoutPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const initialDate = location.state?.date || new Date().toISOString().split('T')[0]

    const { createWorkout, workouts, getWorkoutById } = useWorkouts()
    const { exercises, createExercise } = useExercises()

    const [name, setName] = useState('')
    const [date, setDate] = useState(initialDate)
    const [color, setColor] = useState(WORKOUT_COLORS[0].value)
    const [selectedExerciseIds, setSelectedExerciseIds] = useState([])
    const [showExerciseForm, setShowExerciseForm] = useState(false)
    const [newExerciseName, setNewExerciseName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [visibleCount, setVisibleCount] = useState(10)
    const [copiedSets, setCopiedSets] = useState(null)

    // Sort workouts by date descending for the recent list
    const sortedWorkouts = [...workouts].sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date))
    const visibleWorkouts = sortedWorkouts.slice(0, visibleCount)

    const handleCopyWorkout = async (workout) => {
        setLoading(true)
        try {
            // Get full workout details including sets
            const { data, error } = await getWorkoutById(workout.id)
            if (error) throw new Error(error)

            if (data) {
                setName(data.name)
                setColor(data.color)

                if (data.workout_exercises) {
                    // Set selected exercises
                    const exerciseIds = data.workout_exercises
                        .map(we => we.exercise?.id)
                        .filter(Boolean)
                    setSelectedExerciseIds(exerciseIds)

                    // Store sets for copying
                    const setsMap = {}
                    data.workout_exercises.forEach(we => {
                        if (we.exercise_id && we.sets && we.sets.length > 0) {
                            setsMap[we.exercise_id] = we.sets
                        }
                    })
                    setCopiedSets(setsMap)
                }
            }
        } catch (err) {
            console.error('Error copying workout:', err)
            setError('Failed to copy workout details')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!name.trim()) {
            setError('Please enter a workout name')
            return
        }

        if (selectedExerciseIds.length === 0) {
            setError('Please select at least one exercise')
            return
        }

        setLoading(true)
        setError('')

        try {
            const { error: createError } = await createWorkout(
                { name: name.trim(), scheduled_date: date, color },
                selectedExerciseIds,
                copiedSets // Pass the copied sets map
            )

            if (createError) throw new Error(createError)

            navigate('/')
        } catch (err) {
            setError(err.message || 'Failed to create workout')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateExercise = (searchTerm) => {
        setNewExerciseName(searchTerm)
        setShowExerciseForm(true)
    }

    const handleSaveExercise = async (exerciseData) => {
        const { data, error } = await createExercise(exerciseData)
        if (data && !error) {
            setSelectedExerciseIds(prev => [...prev, data.id])
        }
    }

    return (
        <div className="create-workout-page">
            <header className="create-header glass safe-top">
                <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                </button>
                <h1 className="create-title">New Workout</h1>
                <div style={{ width: 40 }} />
            </header>

            <main className="create-content">
                <form onSubmit={handleSubmit}>
                    <GlassCard className="form-section">
                        <div className="input-group">
                            <label className="input-label">Workout Name</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="e.g., Push Day, Leg Day"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Date</label>
                            <input
                                type="date"
                                className="input"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Color</label>
                            <div className="color-options">
                                {WORKOUT_COLORS.map(c => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        className={`color-option ${color === c.value ? 'selected' : ''}`}
                                        style={{ background: c.value }}
                                        onClick={() => setColor(c.value)}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </div>
                    </GlassCard>

                    {/* Recent Workouts Section */}
                    {sortedWorkouts.length > 0 && (
                        <GlassCard className="form-section recent-workouts-section">
                            <h3 className="section-title">Copy Previous</h3>
                            <div className="recent-workouts-list">
                                {visibleWorkouts.map(workout => (
                                    <div key={workout.id} className="recent-workout-card" onClick={() => handleCopyWorkout(workout)}>
                                        <div className="recent-workout-header">
                                            <span className="recent-workout-name">{workout.name}</span>
                                            <span className="recent-workout-date">{new Date(workout.scheduled_date).toLocaleDateString()}</span>
                                        </div>
                                        <div
                                            className="workout-color-pip"
                                            style={{ background: workout.color }}
                                        />
                                        <div className="recent-workout-exercises">
                                            {workout.workout_exercises?.map(we => we.exercise?.name).join(', ')}
                                        </div>
                                        <div className="copy-overlay">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                            Copy
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {visibleCount < sortedWorkouts.length && (
                                <button
                                    type="button"
                                    className="btn btn-ghost w-full mt-sm"
                                    onClick={() => setVisibleCount(prev => prev + 10)}
                                >
                                    Load More
                                </button>
                            )}
                        </GlassCard>
                    )}

                    <GlassCard className="form-section">
                        <div className="section-header">
                            <h3 className="section-title">Select Exercises</h3>
                            <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleCreateExercise('')}
                                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                            >
                                + New Exercise
                            </button>
                        </div>
                        <ExerciseSelector
                            exercises={exercises}
                            selectedIds={selectedExerciseIds}
                            onSelectionChange={setSelectedExerciseIds}
                            onCreateNew={handleCreateExercise}
                        />
                    </GlassCard>

                    {error && (
                        <p className="form-error">{error}</p>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg w-full"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="spinner" />
                        ) : (
                            <>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Create Workout
                            </>
                        )}
                    </button>
                </form>
            </main>

            <ExerciseForm
                isOpen={showExerciseForm}
                exercise={newExerciseName ? { name: newExerciseName } : null}
                onSave={handleSaveExercise}
                onClose={() => {
                    setShowExerciseForm(false)
                    setNewExerciseName('')
                }}
            />

            <Footer />
        </div>
    )
}
