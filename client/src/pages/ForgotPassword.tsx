import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { post } from '../api'
import { homeFor, useAuth } from '../auth'
import { Button, Card, ErrorMessage, Input, Spinner } from '../components/ui'

export default function ForgotPassword() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <Spinner />
  if (user) return <Navigate to={homeFor(user.role)} replace />

  const cleanEmail = email.trim().toLowerCase()
  const validEmail = /^\S+@\S+\.\S+$/.test(cleanEmail)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await post('/auth/forgot-password', { email: cleanEmail })
      // Same message whether or not the account exists (the server hides this on purpose).
      navigate('/reset-password', {
        state: {
          email: cleanEmail,
          notice: `If an account exists for ${cleanEmail}, we sent a 6-digit code. Enter it below with your new password.`,
        },
      })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <h1 className="text-2xl font-semibold">Forgot your password?</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Enter your email and we will send you a code to reset it.</p>

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
          <Button type="submit" className="w-full" disabled={submitting || !validEmail}>
            {submitting ? 'Sending...' : 'Send reset code'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Remembered it? <Link to="/login" className="font-medium text-accent underline">Back to log in</Link>
        </p>
        <p className="mt-4 text-center text-xs text-muted"><span className="text-danger">*</span> Required</p>
      </Card>
    </main>
  )
}