import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError, post } from '../api'
import { homeFor, useAuth } from '../auth'
import { Button, Card, ErrorMessage, Input, Spinner } from '../components/ui'

const COOLDOWN_SECONDS = 60 // the server allows one new code per 60 seconds

export default function VerifyOtp() {
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { email?: string; notice?: string } | null

  const [email, setEmail] = useState(state?.email ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [info, setInfo] = useState<string | null>(state?.notice ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  // A code was just sent when the user arrives here (register or login), so the cooldown starts now.
  const [cooldown, setCooldown] = useState(state?.email ? COOLDOWN_SECONDS : 0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (loading) return <Spinner />
  if (user) return <Navigate to={homeFor(user.role)} replace />

  const hasEmail = Boolean(state?.email)
  const cleanEmail = email.trim().toLowerCase()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      await post('/auth/verify-otp', { email: cleanEmail, code }) // the server logs the user in on success
      const me = await refresh()
      if (!me) throw new ApiError('Email verified, but the session was not saved. Please log in.', 0, null)
      navigate(homeFor(me.role), { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function onResend() {
    setError(null)
    setInfo(null)
    setResending(true)
    try {
      await post('/auth/resend-otp', { email: cleanEmail })
      setCode('')
      setInfo(`If ${cleanEmail} needs verifying, a new code is on its way.`)
      setCooldown(COOLDOWN_SECONDS)
    } catch (err) {
      setError(err)
    } finally {
      setResending(false)
    }
  }

  const canSubmit = code.length === 6 && /^\S+@\S+\.\S+$/.test(cleanEmail) && !submitting

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <h1 className="text-2xl font-semibold">Verify your email</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          {hasEmail ? <>Enter the 6-digit code sent to <span className="font-medium text-ink">{cleanEmail}</span>.</> : 'Enter your email and the 6-digit code we sent you.'}
        </p>

        <form onSubmit={onSubmit} noValidate>
          {info && <p role="status" className="mb-4 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm">{info}</p>}
          <ErrorMessage error={error} />

          {!hasEmail && (
            <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          )}

          <div className="mb-2">
            <label htmlFor="otp-code" className="mb-1.5 block text-sm font-medium">
              Verification code<span aria-hidden="true" className="ml-0.5 text-danger">*</span>
            </label>
            <input
              id="otp-code"
              className="field w-full rounded-xl px-3.5 py-3 text-center text-2xl font-semibold tracking-[0.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <p className="mb-5 text-xs text-muted">The code expires after a short time. After 5 wrong tries, ask for a new code.</p>

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {submitting ? 'Verifying...' : 'Verify email'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={onResend}
            disabled={resending || cooldown > 0 || !/^\S+@\S+\.\S+$/.test(cleanEmail)}
          >
            {resending ? 'Sending...' : cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
          </Button>
          <p className="mt-4 text-muted">
            Wrong email? <Link to="/register" className="font-medium text-accent underline">Start again</Link>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-muted"><span className="text-danger">*</span> Required</p>
      </Card>
    </main>
  )
}
