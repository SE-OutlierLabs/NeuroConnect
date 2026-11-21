import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { post } from '../api'
import { homeFor, useAuth } from '../auth'
import { Button, Card, ErrorMessage, Input, Spinner } from '../components/ui'

type Role = 'mentee' | 'mentor'
type Errors = Partial<Record<'name' | 'email' | 'password' | 'confirm' | 'age', string>>

const ROLES: { value: Role; title: string; text: string }[] = [
  { value: 'mentee', title: 'I want a mentor', text: 'Search for approved mentors and send connection requests.' },
  { value: 'mentor', title: 'I want to mentor', text: 'Apply to become a mentor. An admin reviews every application.' },
]

export default function Register() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [role, setRole] = useState<Role>('mentee')
  const [age, setAge] = useState(false)
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <Spinner />
  if (user) return <Navigate to={homeFor(user.role)} replace />

  function validate(): Errors {
    const e: Errors = {}
    const n = name.trim()
    if (n.length < 2 || n.length > 50) e.name = 'Enter a name between 2 and 50 characters.'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email address.'
    if (password.length < 8) e.password = 'Use at least 8 characters.'
    else if (new TextEncoder().encode(password).length > 72) e.password = 'Use at most 72 characters.'
    if (confirm !== password) e.confirm = 'Passwords do not match.'
    if (!age) e.age = 'You must confirm that you are 18 or older.'
    return e
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      const cleanEmail = email.trim().toLowerCase() // the server stores emails in lowercase
      const res = await post<{ otp_sent: boolean }>('/auth/register', {
        email: cleanEmail,
        password,
        display_name: name.trim(),
        role,
        age_confirmed: true,
      })
      navigate('/verify-otp', {
        state: {
          email: cleanEmail,
          notice: res.otp_sent
            ? `We sent a 6-digit code to ${cleanEmail}. Enter it below to verify your email.`
            : 'Your account was created, but the code could not be sent. Request a new code below.',
        },
      })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  const type = show ? 'text' : 'password'

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Join NeuroConnect. It takes about a minute.</p>

        <form onSubmit={onSubmit} noValidate>
          <ErrorMessage error={error} />

          <fieldset className="mb-5">
            <legend className="mb-1.5 text-sm font-medium">
              I am joining as<span aria-hidden="true" className="ml-0.5 text-danger">*</span>
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className="cursor-pointer rounded-xl border border-accent/30 bg-white/60 p-3.5 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:shadow-[0_0_0_2px_rgba(44,107,111,0.25)] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    className="sr-only"
                  />
                  <span className="block font-medium">{r.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{r.text}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Input label="Display name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <Input label="Password" type={type} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
          <Input label="Confirm password" type={type} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />

          <label className="-mt-2 mb-5 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-accent" />
            Show passwords
          </label>

          <div className="mb-6">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={age}
                onChange={(e) => setAge(e.target.checked)}
                aria-invalid={errors.age ? true : undefined}
                className="mt-0.5 size-4 accent-accent"
              />
              <span>I confirm that I am 18 years old or older<span aria-hidden="true" className="ml-0.5 text-danger">*</span></span>
            </label>
            {errors.age && <p className="mt-1 text-sm text-danger">{errors.age}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account? <Link to="/login" className="font-medium text-accent underline">Log in</Link>
        </p>
        <p className="mt-4 text-center text-xs text-muted"><span className="text-danger">*</span> Required</p>
      </Card>
    </main>
  )
}
