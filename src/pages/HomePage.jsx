import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useWorkouts } from '../hooks/useWorkouts'
import { useTheme } from '../context/ThemeContext'
import { getRandomCrossFitWorkout } from '../data/crossfitWorkouts'
import Header from '../components/Header'
import Footer from '../components/Footer'
import WorkoutCard from '../components/WorkoutCard'
import CrossFitWorkoutCard from '../components/CrossFitWorkoutCard'
import './HomePage.css'

// Generate array of dates around a center date
function generateDateRange(centerDate, daysBefore = 14, daysAfter = 14) {
    const dates = []
    const center = new Date(centerDate)
    center.setHours(0, 0, 0, 0)

    for (let i = -daysBefore; i <= daysAfter; i++) {
        const d = new Date(center)
        d.setDate(d.getDate() + i)
        dates.push(d)
    }
    return dates
}

function formatDateKey(date) {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function getTodayKey() {
    return formatDateKey(new Date())
}

function formatDisplayDate(date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)

    const diffTime = compareDate.getTime() - today.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === -1) return 'Yesterday'
    if (diffDays === 1) return 'Tomorrow'

    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    })
}

function isPastDate(date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate.getTime() < today.getTime()
}

// Day Section Component
function DaySection({
    date,
    workouts,
    crossfitWorkout,
    onCreateWorkout,
    onAddCF,
    onDeleteCF,
    onShuffleCF,
    onRefresh,
    isPast,
    showCFButton
}) {
    const dateKey = formatDateKey(date)
    const hasContent = workouts.length > 0 || crossfitWorkout

    return (
        <div className={`day-section ${isPast ? 'past-day' : ''}`} data-date={dateKey}>
            <div className="day-header">
                <div className="day-header-left">
                    <span className="day-title">{formatDisplayDate(date)}</span>
                    <span className="day-date-full">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                </div>
                <div className="day-header-actions">
                    {showCFButton && (
                        <button
                            className="btn btn-cf-inline btn-sm"
                            onClick={onAddCF}
                            title="Add random CrossFit workout"
                        >
                            CF
                        </button>
                    )}
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={onCreateWorkout}
                    >
                        + Add Workout
                    </button>
                    {isPast && <span className="past-badge">Past</span>}
                </div>
            </div>

            <div className="day-content">
                {hasContent ? (
                    <div className="day-workouts">
                        {crossfitWorkout && (
                            <CrossFitWorkoutCard
                                workout={crossfitWorkout}
                                onDelete={onDeleteCF}
                                onShuffle={onShuffleCF}
                            />
                        )}
                        {workouts.map(workout => (
                            <WorkoutCard key={workout.id} workout={workout} onDelete={onRefresh} />
                        ))}
                    </div>
                ) : (
                    <div className="empty-day-inline">
                        <div className="empty-day-content">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <span>Rest Day</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function HomePage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { workouts, loading, fetchWorkouts } = useWorkouts()
    const { showCF } = useTheme()
    const [dates, setDates] = useState(() => generateDateRange(new Date(), 14, 14))
    const [crossfitWorkouts, setCrossfitWorkouts] = useState({})
    const [activeDate, setActiveDate] = useState(getTodayKey())
    const scrollContainerRef = useRef(null)
    const loadingMoreRef = useRef(false)
    const initialScrollDone = useRef(false)
    const shouldScrollToToday = useRef(!location.state?.date)

    // Load CrossFit workouts from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('crossfitWorkouts')
        if (saved) {
            setCrossfitWorkouts(JSON.parse(saved))
        }
    }, [])

    // Scroll to today when page loads
    useEffect(() => {
        if (!loading && shouldScrollToToday.current) {
            const todayKey = getTodayKey()
            setTimeout(() => {
                const element = document.querySelector(`[data-date="${todayKey}"]`)
                if (element) {
                    element.scrollIntoView({ behavior: 'auto', block: 'start' })
                }
            }, 100)
        }
    }, [loading])

    // Handle date from calendar navigation
    useEffect(() => {
        if (location.state?.date) {
            const targetDateStr = location.state.date
            const targetDate = new Date(targetDateStr + 'T00:00:00')
            setDates(generateDateRange(targetDate, 14, 14))
            setActiveDate(targetDateStr)
            navigate(location.pathname, { replace: true, state: {} })

            // Scroll to the target date after render
            setTimeout(() => {
                const element = document.querySelector(`[data-date="${targetDateStr}"]`)
                if (element) {
                    element.scrollIntoView({ behavior: 'auto', block: 'start' })
                }
            }, 150)
        }
    }, [location.state, navigate, location.pathname])

    // Setup intersection observer for tracking active date
    useEffect(() => {
        if (loading) return

        const observer = new IntersectionObserver(
            (entries) => {
                // Find the section whose header is at or just below the sticky position
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const dateKey = entry.target.getAttribute('data-date')
                        if (dateKey) {
                            setActiveDate(dateKey)
                        }
                    }
                })
            },
            {
                root: null, // Use viewport since document scrolls
                rootMargin: '-75px 0px -85% 0px', // Trigger when section reaches sticky header area
                threshold: 0
            }
        )

        // Observe all day sections
        const sections = document.querySelectorAll('.day-section')
        sections.forEach(section => observer.observe(section))

        return () => observer.disconnect()
    }, [dates, loading])

    // Infinite scroll - load more dates
    const loadMoreDates = useCallback((direction) => {
        if (loadingMoreRef.current) return
        loadingMoreRef.current = true

        setDates(prevDates => {
            const newDates = [...prevDates]

            if (direction === 'past') {
                const firstDate = new Date(prevDates[0])
                for (let i = 14; i >= 1; i--) {
                    const d = new Date(firstDate)
                    d.setDate(d.getDate() - i)
                    newDates.unshift(d)
                }
            } else {
                const lastDate = new Date(prevDates[prevDates.length - 1])
                for (let i = 1; i <= 14; i++) {
                    const d = new Date(lastDate)
                    d.setDate(d.getDate() + i)
                    newDates.push(d)
                }
            }

            return newDates
        })

        setTimeout(() => {
            loadingMoreRef.current = false
        }, 300)
    }, [])

    // Handle scroll for infinite loading
    const handleScroll = useCallback((e) => {
        const container = e.target
        const scrollTop = container.scrollTop
        const scrollHeight = container.scrollHeight
        const clientHeight = container.clientHeight

        // Load more past dates when near top
        if (scrollTop < 300) {
            loadMoreDates('past')
        }

        // Load more future dates when near bottom
        if (scrollHeight - scrollTop - clientHeight < 300) {
            loadMoreDates('future')
        }
    }, [loadMoreDates])

    // Save CrossFit workouts to localStorage
    const saveCrossfitWorkouts = (workoutsData) => {
        setCrossfitWorkouts(workoutsData)
        localStorage.setItem('crossfitWorkouts', JSON.stringify(workoutsData))
    }

    const getWorkoutsForDate = (date) => {
        const dateStr = formatDateKey(date)
        return workouts.filter(w => w.scheduled_date === dateStr)
    }

    const removeCrossFitWorkout = (dateKey) => {
        const newWorkouts = { ...crossfitWorkouts }
        delete newWorkouts[dateKey]
        saveCrossfitWorkouts(newWorkouts)
    }

    const shuffleCrossFitWorkout = (dateKey) => {
        const workout = getRandomCrossFitWorkout()
        const newWorkouts = {
            ...crossfitWorkouts,
            [dateKey]: workout
        }
        saveCrossfitWorkouts(newWorkouts)
    }

    const handleCreateWorkout = () => {
        navigate('/create-workout', { state: { date: activeDate } })
    }

    // Scroll to today
    const scrollToToday = () => {
        const todayKey = getTodayKey()

        // Check if today is in current dates array
        const todayInDates = dates.some(d => formatDateKey(d) === todayKey)

        if (!todayInDates) {
            setDates(generateDateRange(new Date(), 14, 14))
        }

        setActiveDate(todayKey)

        setTimeout(() => {
            const element = document.querySelector(`[data-date="${todayKey}"]`)
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }, 100)
    }

    // Get display text for active date
    const getActiveDateDisplay = () => {
        try {
            const date = new Date(activeDate + 'T00:00:00')
            return formatDisplayDate(date)
        } catch {
            return 'Today'
        }
    }

    const isNotToday = activeDate !== getTodayKey()

    return (
        <div className="home-page">
            <Header />

            <main
                className="home-content infinite-scroll"
                ref={scrollContainerRef}
            >
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner" />
                        <p>Loading workouts...</p>
                    </div>
                ) : (
                    <div className="days-container">
                        <button
                            className="load-more-btn"
                            onClick={() => loadMoreDates('past')}
                        >
                            Load Earlier Days
                        </button>

                        {dates.map((date, index) => {
                            const dateKey = formatDateKey(date)
                            return (
                                <DaySection
                                    key={dateKey}
                                    date={date}
                                    workouts={getWorkoutsForDate(date)}
                                    crossfitWorkout={crossfitWorkouts[dateKey]}
                                    onCreateWorkout={() => navigate('/create-workout', { state: { date: dateKey } })}
                                    onAddCF={() => shuffleCrossFitWorkout(dateKey)}
                                    onDeleteCF={() => removeCrossFitWorkout(dateKey)}
                                    onShuffleCF={() => shuffleCrossFitWorkout(dateKey)}
                                    onRefresh={fetchWorkouts}
                                    isPast={isPastDate(date)}
                                    showCFButton={showCF}
                                />
                            )
                        })}

                        <button
                            className="load-more-btn"
                            onClick={() => loadMoreDates('future')}
                        >
                            Load More Days
                        </button>
                    </div>
                )}
            </main>

            {/* Floating "Back to Today" button */}
            {isNotToday && !loading && (
                <button
                    className="back-to-today-btn"
                    onClick={scrollToToday}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Today
                </button>
            )}

            <Footer />
        </div>
    )
}
