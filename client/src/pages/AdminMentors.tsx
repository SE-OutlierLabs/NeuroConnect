import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { get, patch } from '../api'
import { useAuth } from '../auth'
import { Button, Card, ErrorMessage, Page, Spinner } from '../components/ui'

type Status = 'pending' | 'approved' | 'rejected'
// A mentor application as returned by GET /admin/mentors.
type Application = {
  mentor_profile_id: number
  user_id: number
  bio: string
  expertise_summary: string
  verification_status: Status
  review_reason: string | null
  reviewed_at: string | null
  user: { user_id: number; display_name: string; email: string; created_at?: string }
  reviewer?: { user_id: number; display_name: string } | null
}

// Filter tabs: show applications by status.
const tabs: Array<{ value: Status; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

// Admin page: review mentor applications and approve or reject them.
export default function AdminMentors() {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>('pending')
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [reviewTarget, setReviewTarget] = useState<Application | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  // Load the applications for the selected status tab.
  const loadApplications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await get<{ applications: Application[] }>(`/admin/mentors?status=${status}`)
      setApplications(result.applications ?? [])
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [status])

  // Reload whenever the selected tab changes.
  useEffect(() => { void loadApplications() }, [loadApplications])

  // Approve an application (no reason needed).
  async function approve(application: Application) {
    setBusyId(application.mentor_profile_id)
    setError(null)
    try {
      await patch(`/admin/mentors/${application.mentor_profile_id}/review`, { decision: 'approved' })
      await loadApplications()
    } catch (err) {
      setError(err)
    } finally {
      setBusyId(null)
    }
  }

  // Open the rejection form for one application.
  function openReject(application: Application) {
    setReviewTarget(application)
    setReason('')
    setReasonError('')
  }

  // Reject needs a reason (at least 3 characters), which the mentor will see.
  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = reason.trim()
    if (trimmed.length < 3) {
      setReasonError('Please enter a reason of at least 3 characters.')
      return
    }
    if (!reviewTarget) return
    const id = reviewTarget.mentor_profile_id
    setBusyId(id)
    setError(null)
    try {
      await patch(`/admin/mentors/${id}/review`, { decision: 'rejected', reason: trimmed })
      setReviewTarget(null)
      setReason('')
      await loadApplications()
    } catch (err) {
      setError(err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Page title="Mentor applications">
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Filter applications">
        {tabs.map((tab) => (
          <Button key={tab.value} type="button" variant={status === tab.value ? 'primary' : 'secondary'} aria-pressed={status === tab.value} onClick={() => setStatus(tab.value)}>
            {tab.label}
          </Button>
        ))}
      </div>
      <ErrorMessage error={error} />
      {loading && <Spinner label="Loading applications..." />}
      {!loading && !error && applications.length === 0 && (
        <Card><p className="text-center text-muted">There are no {status} applications.</p></Card>
      )}
      {!loading && applications.map((application) => {
        // An admin cannot review their own application, so its buttons are replaced (the server refuses it too).
        const isOwn = application.user_id === user?.user_id
        const isPending = application.verification_status === 'pending'
        return (
          <Card key={application.mentor_profile_id} className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{application.user.display_name}</h2>
                <p className="text-sm text-muted">{application.user.email}</p>
              </div>
              <span className="rounded-full border px-3 py-1 text-sm capitalize">{application.verification_status}</span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-semibold">About</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm">{application.bio}</p>
              <h3 className="mt-4 text-sm font-semibold">Expertise</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm">{application.expertise_summary}</p>
            </div>
            {application.review_reason && (
              <p className="mt-4 rounded-lg bg-surface/70 p-3 text-sm"><span className="font-medium">Review reason:</span> {application.review_reason}</p>
            )}
            {application.reviewed_at && <p className="mt-3 text-xs text-muted">Reviewed {new Date(application.reviewed_at).toLocaleString()}{application.reviewer ? ` by ${application.reviewer.display_name}` : ''}</p>}
            {isPending && (
              <div className="mt-5 flex flex-wrap gap-2">
                {isOwn ? (
                  <p className="text-sm text-danger">You cannot review your own application.</p>
                ) : (
                  <>
                    <Button type="button" disabled={busyId === application.mentor_profile_id} onClick={() => void approve(application)}>
                      {busyId === application.mentor_profile_id ? 'Saving...' : 'Approve'}
                    </Button>
                    <Button type="button" variant="danger" disabled={busyId === application.mentor_profile_id} onClick={() => openReject(application)}>Reject</Button>
                  </>
                )}
              </div>
            )}
          </Card>
        )
      })}

      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && busyId === null) setReviewTarget(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="reject-title" className="w-full max-w-lg rounded-2xl bg-white p-6 text-ink shadow-xl">
            <h2 id="reject-title" className="text-lg font-semibold">Reject application</h2>
            <p className="mt-2 text-sm text-muted">Give {reviewTarget.user.display_name} a short explanation. This decision cannot be changed.</p>
            <form className="mt-5" onSubmit={reject}>
              <label htmlFor="rejection-reason" className="mb-1.5 block text-sm font-medium">Reason for rejection</label>
              <textarea
                id="rejection-reason"
                rows={4}
                maxLength={500}
                required
                value={reason}
                onChange={(event) => { setReason(event.target.value); setReasonError('') }}
                aria-invalid={!!reasonError}
                aria-describedby="reason-help"
                className="field w-full rounded-xl px-3.5 py-2.5"
                placeholder="Explain what needs improvement."
              />
              <p id="reason-help" className="mt-1 text-xs text-muted">At least 3 characters, up to 500.</p>
              {reasonError && <p role="alert" className="mt-1 text-sm text-danger">{reasonError}</p>}
              <ErrorMessage error={error} />
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="secondary" disabled={busyId !== null} onClick={() => setReviewTarget(null)}>Cancel</Button>
                <Button type="submit" variant="danger" disabled={busyId !== null || reason.trim().length < 3}>{busyId === reviewTarget.mentor_profile_id ? 'Submitting...' : 'Confirm rejection'}</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </Page>
  )
}
