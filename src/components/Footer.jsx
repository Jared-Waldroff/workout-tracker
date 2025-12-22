import { NavLink } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
    return (
        <footer className="footer glass safe-bottom">
            <nav className="footer-nav">
                <NavLink to="/" className={({ isActive }) => `footer-link ${isActive ? 'active' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span>Home</span>
                </NavLink>

                <NavLink to="/calendar" className={({ isActive }) => `footer-link ${isActive ? 'active' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Calendar</span>
                </NavLink>

                <NavLink to="/exercises" className={({ isActive }) => `footer-link ${isActive ? 'active' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M2 6.5a2.5 2.5 0 0 1 2.5-2.5h0a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5h0A2.5 2.5 0 0 1 2 17.5v-11zM17 6.5a2.5 2.5 0 0 1 2.5-2.5h0a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5h0a2.5 2.5 0 0 1-2.5-2.5v-11z" />
                    </svg>
                    <span>Exercises</span>
                </NavLink>

                <NavLink to="/goals" className={({ isActive }) => `footer-link ${isActive ? 'active' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>Coach</span>
                </NavLink>

                <NavLink to="/squad" className={({ isActive }) => `footer-link ${isActive ? 'active' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>Squad</span>
                </NavLink>
            </nav>
        </footer>
    )
}
