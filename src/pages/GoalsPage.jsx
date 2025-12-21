import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoalChat } from '../hooks/useGoalChat'
import { useWorkouts } from '../hooks/useWorkouts'
import { useExercises } from '../hooks/useExercises'
import { useAthleteProfile } from '../hooks/useAthleteProfile'
import Header from '../components/Header'
import Footer from '../components/Footer'
import GlassCard from '../components/GlassCard'
import ConfirmDialog from '../components/ConfirmDialog'
import './GoalsPage.css'

export default function GoalsPage() {
    const navigate = useNavigate()
    const {
        messages,
        isLoading,
        error,
        workoutPlan,
        pendingCommands,
        sendMessage,
        retryLastMessage,
        startNewChat,
        getInitialGreeting,
        updateContext,
        clearPlan,
        clearCommands
    } = useGoalChat()

    const { workouts, createWorkout, deleteWorkout, fetchWorkouts } = useWorkouts()
    const { exercises } = useExercises()
    const { profile, updateProfile } = useAthleteProfile()

    const [inputValue, setInputValue] = useState('')
    const [isAddingWorkouts, setIsAddingWorkouts] = useState(false)
    const [addSuccess, setAddSuccess] = useState(false)
    const [showSchedule, setShowSchedule] = useState(false)
    const [confirmAction, setConfirmAction] = useState(null)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)
    const contextUpdatedRef = useRef(false)

    // Update AI context when workouts or profile change
    useEffect(() => {
        if (workouts && profile) {
            updateContext(workouts, profile)
            contextUpdatedRef.current = true
        }
    }, [workouts, profile, updateContext])

    // Get initial greeting when context is ready
    useEffect(() => {
        if (contextUpdatedRef.current && messages.length === 0) {
            getInitialGreeting()
        }
    }, [contextUpdatedRef.current, messages.length]) // eslint-disable-line

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isLoading])

    // Focus input after loading
    useEffect(() => {
        if (!isLoading) {
            inputRef.current?.focus()
        }
    }, [isLoading])

    // Process pending commands from AI
    useEffect(() => {
        if (pendingCommands.length > 0) {
            processPendingCommands()
        }
    }, [pendingCommands]) // eslint-disable-line

    const processPendingCommands = async () => {
        for (const command of pendingCommands) {
            switch (command.action) {
                case 'ADD_WORKOUT':
                    // Queue for confirmation or auto-add
                    setConfirmAction({
                        type: 'add',
                        data: command.workout,
                        message: `Add "${command.workout.name}" on ${command.workout.day_of_week}?`
                    })
                    break

                case 'DELETE_WORKOUT':
                    setConfirmAction({
                        type: 'delete',
                        data: command,
                        message: `Delete workout? Reason: ${command.reason || 'Coach recommendation'}`
                    })
                    break

                case 'UPDATE_PROFILE':
                    // Auto-update profile with lifestyle info
                    await updateProfile(command.updates)
                    break

                case 'CREATE_PLAN':
                    // Handled by workoutPlan state
                    break

                default:
                    console.log('Unknown command:', command)
            }
        }
        clearCommands()
    }

    const handleConfirmAction = async () => {
        if (!confirmAction) return

        if (confirmAction.type === 'add') {
            await handleAddSingleWorkout(confirmAction.data)
        } else if (confirmAction.type === 'delete') {
            await deleteWorkout(confirmAction.data.workout_id)
            await fetchWorkouts()
        }

        setConfirmAction(null)
    }

    const handleAddSingleWorkout = async (workout) => {
        const exerciseIds = workout.exercises
            ?.map(ex => findExerciseId(ex.name))
            .filter(id => id !== null) || []

        if (exerciseIds.length === 0) {
            // Create workout with just name/date
            await createWorkout({
                name: workout.name,
                scheduled_date: workout.scheduled_date || getNextDayDate(workout.day_of_week),
                color: workout.color || '#10b981'
            }, [], {})
        } else {
            const customSets = {}
            workout.exercises.forEach(ex => {
                const exerciseId = findExerciseId(ex.name)
                if (exerciseId) {
                    const numSets = ex.sets || 1
                    customSets[exerciseId] = Array(numSets).fill({
                        weight: 0,
                        reps: parseInt(ex.reps) || 0
                    })
                }
            })

            await createWorkout({
                name: workout.name,
                scheduled_date: workout.scheduled_date || getNextDayDate(workout.day_of_week),
                color: workout.color || '#10b981'
            }, exerciseIds, customSets)
        }

        await fetchWorkouts()
    }

    const getNextDayDate = (dayName) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const today = new Date()
        const targetDay = days.indexOf(dayName)
        if (targetDay === -1) return today.toISOString().split('T')[0]

        const currentDay = today.getDay()
        let daysUntil = targetDay - currentDay
        if (daysUntil <= 0) daysUntil += 7

        const targetDate = new Date(today)
        targetDate.setDate(today.getDate() + daysUntil)
        return targetDate.toISOString().split('T')[0]
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (inputValue.trim() && !isLoading) {
            sendMessage(inputValue)
            setInputValue('')
        }
    }

    const findExerciseId = (exerciseName) => {
        let exercise = exercises.find(e =>
            e.name.toLowerCase() === exerciseName.toLowerCase()
        )
        if (!exercise) {
            exercise = exercises.find(e =>
                e.name.toLowerCase().includes(exerciseName.toLowerCase()) ||
                exerciseName.toLowerCase().includes(e.name.toLowerCase())
            )
        }
        return exercise?.id || null
    }

    const handleAddToCalendar = async () => {
        if (!workoutPlan || isAddingWorkouts) return

        setIsAddingWorkouts(true)

        try {
            const today = new Date()
            const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            const weeksToSchedule = workoutPlan.weeks || 4

            for (let week = 0; week < weeksToSchedule; week++) {
                for (const workout of workoutPlan.workouts) {
                    const targetDayIndex = daysOfWeek.indexOf(workout.day_of_week)
                    if (targetDayIndex === -1) continue

                    const workoutDate = new Date(today)
                    const currentDayIndex = workoutDate.getDay()
                    let daysUntilTarget = targetDayIndex - currentDayIndex
                    if (daysUntilTarget <= 0) daysUntilTarget += 7

                    workoutDate.setDate(workoutDate.getDate() + daysUntilTarget + (week * 7))
                    const scheduledDate = workoutDate.toISOString().split('T')[0]

                    const exerciseIds = workout.exercises
                        .map(ex => findExerciseId(ex.name))
                        .filter(id => id !== null)

                    const customSets = {}
                    workout.exercises.forEach(ex => {
                        const exerciseId = findExerciseId(ex.name)
                        if (exerciseId) {
                            const numSets = ex.sets || 3
                            customSets[exerciseId] = Array(numSets).fill({
                                weight: 0,
                                reps: parseInt(ex.reps) || 10
                            })
                        }
                    })

                    if (exerciseIds.length > 0) {
                        await createWorkout({
                            name: workout.name,
                            scheduled_date: scheduledDate,
                            color: workout.color || '#1e3a5f'
                        }, exerciseIds, customSets)
                    }
                }
            }

            setAddSuccess(true)
            clearPlan()
            await fetchWorkouts()

            setTimeout(() => {
                navigate('/')
            }, 2000)

        } catch (err) {
            console.error('Error adding workouts:', err)
        } finally {
            setIsAddingWorkouts(false)
        }
    }

    const handleNewChat = () => {
        startNewChat()
        setAddSuccess(false)
        contextUpdatedRef.current = false
        // Re-trigger context update
        if (workouts && profile) {
            updateContext(workouts, profile)
            contextUpdatedRef.current = true
        }
        setTimeout(() => getInitialGreeting(), 100)
    }

    const upcomingWorkouts = workouts?.slice(0, 7) || []

    return (
        <div className="goals-page">
            <Header />

            <main className="goals-content">
                <div className="chat-container">
                    {/* Schedule Toggle */}
                    <button
                        className="btn btn-ghost schedule-toggle"
                        onClick={() => setShowSchedule(!showSchedule)}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {showSchedule ? 'Hide Schedule' : 'Show Schedule'} ({upcomingWorkouts.length})
                    </button>

                    {/* Schedule Panel */}
                    {showSchedule && upcomingWorkouts.length > 0 && (
                        <GlassCard className="schedule-panel">
                            <h4>Upcoming Workouts</h4>
                            <div className="schedule-list">
                                {upcomingWorkouts.map(w => (
                                    <div key={w.id} className="schedule-item" style={{ borderLeftColor: w.color }}>
                                        <span className="schedule-date">{w.scheduled_date}</span>
                                        <span className="schedule-name">{w.name}</span>
                                        {w.is_completed && <span className="schedule-done">✓</span>}
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    )}

                    {/* Chat Messages */}
                    <div className="messages-container">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`message ${message.role === 'user' ? 'user-message' : 'ai-message'}`}
                            >
                                {message.role === 'assistant' && (
                                    <div className="message-avatar">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </div>
                                )}
                                <div className="message-content">
                                    {message.content.split('\n').map((line, i) => (
                                        <p key={i}>{line || <br />}</p>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="message ai-message">
                                <div className="message-avatar">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                                <div className="message-content">
                                    <div className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="error-message">
                                <p>⚠️ {error}</p>
                                <div className="error-actions">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => {
                                            const lastUserMsg = messages.filter(m => m.role === 'user').pop()
                                            if (lastUserMsg) {
                                                retryLastMessage(lastUserMsg.content)
                                            } else {
                                                startNewChat()
                                                setTimeout(() => getInitialGreeting(), 100)
                                            }
                                        }}
                                    >
                                        Retry
                                    </button>
                                    <button className="btn btn-secondary" onClick={handleNewChat}>
                                        Start Fresh
                                    </button>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Workout Plan Preview */}
                    {workoutPlan && !addSuccess && (
                        <GlassCard className="plan-preview">
                            <h3>{workoutPlan.plan_name || 'Your Workout Plan'}</h3>
                            <p className="plan-summary">{workoutPlan.summary}</p>

                            <div className="plan-workouts">
                                {workoutPlan.workouts.map((workout, index) => (
                                    <div key={index} className="plan-workout-item" style={{ borderLeftColor: workout.color }}>
                                        <div className="plan-workout-header">
                                            <span className="plan-workout-name">{workout.name}</span>
                                            <span className="plan-workout-day">{workout.day_of_week}</span>
                                        </div>
                                        <div className="plan-exercises">
                                            {workout.exercises.slice(0, 4).map((ex, i) => (
                                                <span key={i} className="plan-exercise-tag">
                                                    {ex.name}
                                                </span>
                                            ))}
                                            {workout.exercises.length > 4 && (
                                                <span className="plan-exercise-tag more">
                                                    +{workout.exercises.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="plan-actions">
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={handleAddToCalendar}
                                    disabled={isAddingWorkouts}
                                >
                                    {isAddingWorkouts ? (
                                        <>
                                            <span className="spinner"></span>
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                <line x1="16" y1="2" x2="16" y2="6" />
                                                <line x1="8" y1="2" x2="8" y2="6" />
                                                <line x1="3" y1="10" x2="21" y2="10" />
                                                <line x1="12" y1="14" x2="12" y2="18" />
                                                <line x1="10" y1="16" x2="14" y2="16" />
                                            </svg>
                                            Add {workoutPlan.weeks || 4} Weeks to Calendar
                                        </>
                                    )}
                                </button>
                            </div>
                        </GlassCard>
                    )}

                    {/* Success message */}
                    {addSuccess && (
                        <GlassCard className="success-message">
                            <div className="success-icon">✓</div>
                            <h3>Workouts Added!</h3>
                            <p>Your workout plan has been scheduled. Redirecting to home...</p>
                        </GlassCard>
                    )}

                    {/* Input Area */}
                    <form onSubmit={handleSubmit} className="chat-input-form">
                        <div className="chat-input-container">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Ask your coach..."
                                className="chat-input"
                                disabled={isLoading || addSuccess}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary send-button"
                                disabled={!inputValue.trim() || isLoading || addSuccess}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        </div>

                        {messages.length > 0 && (
                            <button
                                type="button"
                                className="btn btn-ghost new-chat-button"
                                onClick={handleNewChat}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                                New Conversation
                            </button>
                        )}
                    </form>
                </div>
            </main>

            <Footer />

            {/* Confirmation Dialog for AI Actions */}
            <ConfirmDialog
                isOpen={!!confirmAction}
                title={confirmAction?.type === 'add' ? 'Add Workout' : 'Delete Workout'}
                message={confirmAction?.message || ''}
                confirmText={confirmAction?.type === 'add' ? 'Add' : 'Delete'}
                variant={confirmAction?.type === 'delete' ? 'danger' : 'default'}
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    )
}
