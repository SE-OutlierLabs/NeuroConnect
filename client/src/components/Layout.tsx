import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth, homeFor } from '../auth'

const linksFor = (role?: string): [string, string][] => {
  if (role === 'mentee') return [['/search', 'Find a mentor'], ['/connections', 'My connections']]
  if (role === 'mentor') return [['/inbox', 'Requests'], ['/mentor/status', 'My application']]
  if (role === 'admin') return [['/admin/mentors', 'Mentor applications'], ['/admin/audit-log', 'Audit log']]
  if (role === 'moderator') return [['/admin/mentors', 'Mentor applications']]
  return []
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <>
      <header className="border-b border-line bg-surface">
        <nav aria-label="Main" className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to={user ? homeFor(user.role) : '/login'} className="text-lg font-semibold text-accent">NeuroConnect</Link>
          {linksFor(user?.role).map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'font-medium text-accent underline underline-offset-4' : 'text-muted hover:text-ink')}>
              {label}
            </NavLink>
          ))}
          <span className="ml-auto flex items-center gap-4 text-sm">
            {user ? (
              <>
                <span className="text-muted">{user.display_name}</span>
                <button className="underline" onClick={async () => { await logout(); navigate('/login') }}>Log out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="underline">Log in</Link>
                <Link to="/register" className="underline">Register</Link>
              </>
            )}
          </span>
        </nav>
      </header>
      <Outlet />
    </>
  )
}
