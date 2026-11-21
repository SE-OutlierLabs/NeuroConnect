import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { post } from '../api'
import { homeFor, useAuth } from '../auth'
import { Button, Card, ErrorMessage, Input, Spinner } from '../components/ui'

// Error text for each field of the form.
type Errors = Partial<Record<'email' | 'code' | 'password' | 'confirm', string>>

// Reset page: enter the emailed code and a new password.
export default function ResetPassword() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { email?: string; notice?: string } | null

  const [email, setEmail] = useState(state?.email ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <Spinner />
  if (user) return <Navigate to={homeFor(user.role)} replace />

  // Client-side checks for quick feedback (the server validates again).
  function validate(): Errors {
    const e: Errors = {}
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email address.'
    if (!/^\d{6}$/.test(code)) e.code = 'Enter the 6-digit code from your email.'
    if (password.length < 8) e.password = 'Use at least 8 characters.'
    else if (new TextEncoder().encode(password).length > 72) e.password = 'Use at most 72 characters.'
    if (confirm !== password) e.confirm = 'Passwords do not match.'
    return e
  }

  // Send the code and the new password to the server.
  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      await post('/auth/reset-password', { email: email.trim().toLowerCase(), code, new_password: password })
      // The server logs the user out everywhere, so send them to log in with the new password.
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  // Switch between hidden and visible password fields.
  const type = show ? 'text' : 'password'

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Enter the code we emailed you and choose a new password.</p>

        <form onSubmit={onSubmit} noValidate>
          {state?.notice && !error && <p role="status" className="mb-4 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm">{state.notice}</p>}
          <ErrorMessage error={error} />
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <Input
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={errors.code}
          />
          <Input label="New password" type={type} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
          <Input label="Confirm new password" type={type} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />

          <label className="-mt-2 mb-5 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-accent" />
            Show passwords
          </label>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving...' : 'Reset password'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          No code yet? <Link to="/forgot-password" className="font-medium text-accent underline">Send a new one</Link>
        </p>
        <p className="mt-4 text-center text-xs text-muted"><span className="text-danger">*</span> Required</p>
      </Card>
    </main>
  )
}