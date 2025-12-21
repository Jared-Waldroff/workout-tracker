import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlassCard from './GlassCard'
import './CrossFitWorkoutCard.css'

export default function CrossFitWorkoutCard({
    workout,
    onDelete,
    onShuffle,
    isCompleted = false
}) {
    const navigate = useNavigate()
    const [showActions, setShowActions] = useState(false)

    if (!workout) return null

    const handleCardClick = () => {
        if (!showActions) {
            navigate('/cf-workout', { state: { workout } })
        }
    }

    const handleMenuClick = (e) => {
        e.stopPropagation()
        setShowActions(!showActions)
    }

    const handleActionClick = (e, action) => {
        e.stopPropagation()
        action()
    }

    return (
        <GlassCard className={`cf-workout-card ${isCompleted ? 'completed' : ''}`} onClick={handleCardClick}>
            {isCompleted && (
                <div className="cf-completed-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Completed
                </div>
            )}
            <div className="cf-header">
                <div className="cf-badge">
                    <span className="cf-logo">CF</span>
                    <span className="cf-year">{workout.year}</span>
                </div>
                <div className="cf-title-section">
                    <h3 className="cf-name">{workout.name}</h3>
                    <span className="cf-subtitle">{workout.subtitle}</span>
                </div>
                <button
                    className="btn btn-ghost btn-icon cf-menu-btn"
                    onClick={handleMenuClick}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                    </svg>
                </button>
            </div>

            {showActions && (
                <div className="cf-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary" onClick={(e) => handleActionClick(e, onShuffle)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="16 3 21 3 21 8" />
                            <line x1="4" y1="20" x2="21" y2="3" />
                            <polyline points="21 16 21 21 16 21" />
                            <line x1="15" y1="15" x2="21" y2="21" />
                            <line x1="4" y1="4" x2="9" y2="9" />
                        </svg>
                        Different WOD
                    </button>
                    <button className="btn btn-secondary delete-btn" onClick={(e) => handleActionClick(e, onDelete)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Remove
                    </button>
                </div>
            )}

            <div className="cf-format">
                <span className="format-label">Format:</span>
                <span className="format-value">{workout.format}</span>
            </div>

            <div className="cf-description">
                {workout.description.split('\n').map((line, i) => (
                    <p key={i} className={line.startsWith('  ') ? 'indented' : ''}>
                        {line || '\u00A0'}
                    </p>
                ))}
            </div>

            <div className="cf-weights">
                <div className="weight-item">
                    <span className="weight-label">Rx ♂</span>
                    <span className="weight-value">{workout.rxWeights.male}</span>
                </div>
                <div className="weight-item">
                    <span className="weight-label">Rx ♀</span>
                    <span className="weight-value">{workout.rxWeights.female}</span>
                </div>
            </div>
        </GlassCard>
    )
}

