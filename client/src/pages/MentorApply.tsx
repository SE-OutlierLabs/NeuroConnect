import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, post } from '../api'
import { useAuth } from '../auth'
import { Button, Card, ErrorMessage, Page } from '../components/ui'

const BIO_MIN = 20
const BIO_MAX = 2000
const EXPERTISE_MIN = 10
const EXPERTISE_MAX = 1000

export default function MentorApply() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const profile = user?.mentor_profile
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [expertise, setExpertise] = useState(profile?.expertise_summary ?? '')
  const [error, setError] = useState<unknown>(null)
  const [fieldErrors, setFieldErrors] = useState<{ bio?: string; expertise?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (profile && profile.verification_status !== 'rejected') {
      navigate('/mentor/status', { replace: true })
    }
  }, [profile, navigate])

  function validate() {
    const next: { bio?: string; expertise?: string } = {}
    if (bio.trim().length < BIO_MIN) next.bio = `Please enter at least ${BIO_MIN} characters.`
    else if (bio.trim().length > BIO_MAX) next.bio = `Please keep your bio under ${BIO_MAX} characters.`
    if (expertise.trim().length < EXPERTISE_MIN) next.expertise = `Please enter at least ${EXPERTISE_MIN} characters.`
    else if (expertise.trim().length > EXPERTISE_MAX) next.expertise = `Please keep your expertise summary under ${EXPERTISE_MAX} characters.`
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      await post('/mentors/apply', { bio: bio.trim(), expertise_summary: expertise.trim() })
      await refresh()
      navigate('/mentor/status', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err : new Error('Your application could not be submitted. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page title={profile?.verification_status === 'rejected' ? 'Apply again as a mentor' : 'Apply as a mentor'}>
      <Card>
        <p className="mb-5 text-sm text-muted">
          Tell us about your experience and the areas where you can support other members.
          Applications are reviewed before your mentor profile appears in search.
        </p>
        {profile?.verification_status === 'rejected' && (
          <div className="mb-5 rounded-xl bg-danger-soft/70 p-4 text-sm text-danger">
            <p className="font-semibold">Your previous application was not approved.</p>
            {profile.review_reason && <p className="mt-1">Review feedback: {profile.review_reason}</p>}
            <p className="mt-1">You can update your details and submit a new application.</p>
          </div>
        )}
        <ErrorMessage error={error} />
        <form onSubmit={submit} noValidate>
          <div className="mb-5">
            <label htmlFor="mentor-bio" className="mb-1.5 block text-sm font-medium">About you</label>
            <textarea
              id="mentor-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={6}
              maxLength={BIO_MAX}
              required
              aria-invalid={!!fieldErrors.bio}
              aria-describedby="bio-help bio-count bio-error"
              className="field w-full rounded-xl px-3.5 py-2.5"
              placeholder="Share relevant experience and what you would like mentees to know about you."
            />
            <div className="mt-1 flex justify-between gap-3 text-xs text-muted">
              <span id="bio-help">At least {BIO_MIN} characters.</span>
              <span id="bio-count">{bio.length}/{BIO_MAX}</span>
            </div>
            {fieldErrors.bio && <p id="bio-error" role="alert" className="mt-1 text-sm text-danger">{fieldErrors.bio}</p>}
          </div>
          <div className="mb-5">
            <label htmlFor="mentor-expertise" className="mb-1.5 block text-sm font-medium">Areas of expertise</label>
            <textarea
              id="mentor-expertise"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              rows={4}
              maxLength={EXPERTISE_MAX}
              required
              aria-invalid={!!fieldErrors.expertise}
              aria-describedby="expertise-help expertise-count expertise-error"
              className="field w-full rounded-xl px-3.5 py-2.5"
              placeholder="Describe the topics, skills or experiences you can help with."
            />
            <div className="mt-1 flex justify-between gap-3 text-xs text-muted">
              <span id="expertise-help">At least {EXPERTISE_MIN} characters.</span>
              <span id="expertise-count">{expertise.length}/{EXPERTISE_MAX}</span>
            </div>
            {fieldErrors.expertise && <p id="expertise-error" role="alert" className="mt-1 text-sm text-danger">{fieldErrors.expertise}</p>}
          </div>
          <p className="mb-5 text-xs text-muted">Do not include private medical information. NeuroConnect is a peer-support platform, not a substitute for professional care.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit application'}</Button>
            <Link to="/mentor/status" className="text-sm text-accent underline">View application status</Link>
          </div>
        </form>
      </Card>
    </Page>
  )
}
