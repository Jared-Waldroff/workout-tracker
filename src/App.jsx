import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import { supabase } from './lib/supabaseClient'

// Pages
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import ExercisesPage from './pages/ExercisesPage'
import GoalsPage from './pages/GoalsPage'
import SettingsPage from './pages/SettingsPage'
import CreateWorkoutPage from './pages/CreateWorkoutPage'
import ActiveWorkoutPage from './pages/ActiveWorkoutPage'
import ExerciseDetailPage from './pages/ExerciseDetailPage'
import CrossFitWorkoutPage from './pages/CrossFitWorkoutPage'
import SquadPage from './pages/SquadPage'
import NotificationsPage from './pages/NotificationsPage'
import AthleteProfilePage from './pages/AthleteProfilePage'


function AppContent() {
  // Session refresh is now handled by useVisibilityRefresh in data hooks

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingPage />
        </ProtectedRoute>
      } />

      <Route path="/" element={
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      } />

      <Route path="/calendar" element={
        <ProtectedRoute>
          <CalendarPage />
        </ProtectedRoute>
      } />

      <Route path="/exercises" element={
        <ProtectedRoute>
          <ExercisesPage />
        </ProtectedRoute>
      } />

      <Route path="/goals" element={
        <ProtectedRoute>
          <GoalsPage />
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      } />

      <Route path="/squad" element={
        <ProtectedRoute>
          <SquadPage />
        </ProtectedRoute>
      } />

      <Route path="/notifications" element={
        <ProtectedRoute>
          <NotificationsPage />
        </ProtectedRoute>
      } />

      <Route path="/athlete/:id" element={
        <ProtectedRoute>
          <AthleteProfilePage />
        </ProtectedRoute>
      } />

      <Route path="/create-workout" element={
        <ProtectedRoute>
          <CreateWorkoutPage />
        </ProtectedRoute>
      } />

      <Route path="/workout/:id" element={
        <ProtectedRoute>
          <ActiveWorkoutPage />
        </ProtectedRoute>
      } />

      <Route path="/exercise/:id" element={
        <ProtectedRoute>
          <ExerciseDetailPage />
        </ProtectedRoute>
      } />

      <Route path="/cf-workout" element={
        <ProtectedRoute>
          <CrossFitWorkoutPage />
        </ProtectedRoute>
      } />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
