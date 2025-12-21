import { useMemo } from 'react'
import './YearView.css'

export default function YearView({ workouts, year, onDayClick }) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Create workout map by date
    const workoutsByDate = useMemo(() => {
        const map = {}
        workouts?.forEach(w => {
            if (!map[w.scheduled_date]) {
                map[w.scheduled_date] = []
            }
            map[w.scheduled_date].push(w)
        })
        return map
    }, [workouts])

    // Generate all days for the year
    const yearData = useMemo(() => {
        const months = []

        for (let month = 0; month < 12; month++) {
            const firstDay = new Date(year, month, 1)
            const lastDay = new Date(year, month + 1, 0)
            const daysInMonth = lastDay.getDate()
            const startPadding = firstDay.getDay()

            const days = []

            // Padding for alignment
            for (let i = 0; i < startPadding; i++) {
                days.push(null)
            }

            // Days of month
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day)
                const dateKey = formatDateKey(date)
                const dayWorkouts = workoutsByDate[dateKey] || []

                days.push({
                    date,
                    dateKey,
                    day,
                    workouts: dayWorkouts,
                    hasWorkout: dayWorkouts.length > 0,
                    isCompleted: dayWorkouts.some(w => w.is_completed),
                    color: dayWorkouts[0]?.color || null
                })
            }

            months.push({
                name: monthNames[month],
                days
            })
        }

        return months
    }, [year, workoutsByDate])

    // Calculate year stats
    const yearStats = useMemo(() => {
        let workoutDays = 0
        let completedDays = 0
        let totalWorkouts = 0

        Object.values(workoutsByDate).forEach(dayWorkouts => {
            const date = new Date(dayWorkouts[0]?.scheduled_date)
            if (date.getFullYear() === year) {
                workoutDays++
                totalWorkouts += dayWorkouts.length
                if (dayWorkouts.some(w => w.is_completed)) {
                    completedDays++
                }
            }
        })

        return { workoutDays, completedDays, totalWorkouts }
    }, [workoutsByDate, year])

    const formatDateKey = (date) => {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    }

    const isToday = (date) => {
        const today = new Date()
        return date?.toDateString() === today.toDateString()
    }

    const getIntensityClass = (dayData) => {
        if (!dayData?.hasWorkout) return ''
        const count = dayData.workouts.length
        if (count >= 3) return 'intensity-high'
        if (count >= 2) return 'intensity-medium'
        return 'intensity-low'
    }

    return (
        <div className="year-view">
            {/* Year Stats Header */}
            <div className="year-stats">
                <div className="year-stat">
                    <span className="stat-value">{yearStats.workoutDays}</span>
                    <span className="stat-label">Workout Days</span>
                </div>
                <div className="year-stat">
                    <span className="stat-value">{yearStats.completedDays}</span>
                    <span className="stat-label">Completed</span>
                </div>
                <div className="year-stat">
                    <span className="stat-value">{yearStats.totalWorkouts}</span>
                    <span className="stat-label">Total Sessions</span>
                </div>
            </div>

            {/* Month Grid */}
            <div className="year-months">
                {yearData.map((month, monthIndex) => (
                    <div key={monthIndex} className="year-month">
                        <div className="month-label">{month.name}</div>
                        <div className="month-grid">
                            {month.days.map((dayData, dayIndex) => (
                                <div
                                    key={dayIndex}
                                    className={`year-day ${!dayData ? 'empty' : ''
                                        } ${dayData?.hasWorkout ? 'has-workout' : ''
                                        } ${dayData?.isCompleted ? 'completed' : ''
                                        } ${isToday(dayData?.date) ? 'today' : ''
                                        } ${getIntensityClass(dayData)
                                        }`}
                                    style={dayData?.color ? { '--workout-color': dayData.color } : {}}
                                    onClick={() => dayData && onDayClick?.(dayData.date)}
                                    title={dayData ? `${month.name} ${dayData.day}${dayData.hasWorkout ? ` - ${dayData.workouts.length} workout(s)` : ''}` : ''}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="year-legend">
                <span className="legend-text">Less</span>
                <div className="legend-boxes">
                    <div className="legend-box empty" />
                    <div className="legend-box intensity-low" />
                    <div className="legend-box intensity-medium" />
                    <div className="legend-box intensity-high" />
                </div>
                <span className="legend-text">More</span>
            </div>
        </div>
    )
}
