import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { get, post, ApiError } from './api'

export type Role = 'mentee' | 'mentor' | 'admin' | 'moderator'
export type MentorProfile = {
  mentor_profile_id: number
  bio: string
  expertise_summary: string
  verification_status: 'pending' | 'approved' | 'rejected'
  review_reason: string | null
  reviewed_at: string | null
}
export type User = {
  user_id: number
  email: string
  display_name: string
  role: Role
  email_verified: boolean
  account_status: string
  mentor_profile?: MentorProfile | null
}

type AuthValue = {
  user: User | null
  loading: boolean
  /** Throws ApiError. On 403 the error has code 'EMAIL_NOT_VERIFIED': send the user to the OTP page. */
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  /** Re-read /api/auth/me (e.g. after a mentor applies or an application is reviewed). */
  refresh: () => Promise<User | null>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { user } = await get<{ user: User }>('/auth/me')
      setUser(user)
      return user
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) console.error(err)
      setUser(null) // 401 simply means "not logged in"
      return null
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const login = async (email: string, password: string) => {
    await post('/auth/login', { email, password })
    const me = await refresh()
    if (!me) throw new ApiError('Login worked but the session was not saved. Check cookie settings.', 0, null)
    return me
  }

  const logout = async () => {
    try { await post('/auth/logout') } finally { setUser(null) }
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Where each role lands after login. */
export function homeFor(role: Role): string {
  if (role === 'mentor') return '/inbox'
  if (role === 'admin' || role === 'moderator') return '/admin/mentors'
  return '/search'
}
