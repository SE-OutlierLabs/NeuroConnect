import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, homeFor, useAuth } from './auth'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyOtp from './pages/VerifyOtp'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Search from './pages/Search'
import Connections from './pages/Connections'
import MentorApply from './pages/MentorApply'
import MentorStatus from './pages/MentorStatus'
import MentorInbox from './pages/MentorInbox'
import AdminMentors from './pages/AdminMentors'
import AuditLog from './pages/AuditLog'
import NotAllowed from './pages/NotAllowed'
import NotFound from './pages/NotFound'

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />

            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Mentee */}
            <Route element={<ProtectedRoute roles={['mentee']} />}>
              <Route path="/search" element={<Search />} />
              <Route path="/connections" element={<Connections />} />
            </Route>

            {/* Mentor */}
            <Route element={<ProtectedRoute roles={['mentor']} />}>
              <Route path="/mentor/apply" element={<MentorApply />} />
              <Route path="/mentor/status" element={<MentorStatus />} />
              <Route path="/inbox" element={<MentorInbox />} />
            </Route>

            {/* Admin (moderators may review applications too) */}
            <Route element={<ProtectedRoute roles={['admin', 'moderator']} />}>
              <Route path="/admin/mentors" element={<AdminMentors />} />
            </Route>
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route path="/admin/audit-log" element={<AuditLog />} />
            </Route>

            <Route path="/not-allowed" element={<NotAllowed />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
