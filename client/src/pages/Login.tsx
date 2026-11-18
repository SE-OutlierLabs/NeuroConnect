import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api'
import { homeFor, useAuth } from '../auth'
import { Button, Card, ErrorMessage, Input, Spinner } from '../components/ui'

export default function Login() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <Spinner />
  // Already logged in: go straight to this role's home page.
  if (user) return <Navigate to={homeFor(user.role)} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const me = await login(email.trim(), password)
      navigate(from ?? homeFor(me.role), { replace: true })
    } catch (err) {
      // Email not verified yet: send them to the OTP page.
      if (err instanceof ApiError && err.status === 403 && err.code === 'EMAIL_NOT_VERIFIED') {
        navigate('/verify-otp', { state: { email: email.trim(), notice: 'Your email is not verified yet. Enter the code we sent you, or ask for a new one.' } })
        return
      }
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Log in to continue to NeuroConnect.</p>

        <form onSubmit={onSubmit} noValidate>
          <ErrorMessage error={error} />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="-mt-2 mb-5 text-right text-sm">
            <Link to="/forgot-password" className="underline">Forgot password?</Link>
          </div>
          <Button type="submit" className="w-full" disabled={submitting || !email.trim() || !password}>
            {submitting ? 'Logging in...' : 'Log in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          New here? <Link to="/register" className="font-medium text-accent underline">Create an account</Link>
        </p>
        <p className="mt-4 text-center text-xs text-muted"><span className="text-danger">*</span> Required</p>
      </Card>
    </main>
  )
}
