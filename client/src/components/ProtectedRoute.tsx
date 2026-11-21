import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, type Role } from '../auth'
import { Spinner } from './ui'

/** Wrap routes in this. Not logged in -> /login. Logged in with the wrong role -> /not-allowed. */
export default function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.role)) return <Navigate to="/not-allowed" replace />
  return <Outlet />
}
