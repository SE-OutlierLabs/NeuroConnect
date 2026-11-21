import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { Button, Card, Page } from '../components/ui'

export default function MentorStatus() {
  const { user, loading, refresh } = useAuth()
  if (loading) return <Page title="My application"><p role="status" className="py-8 text-center text-muted">Loading your application...</p></Page>

  const profile = user?.mentor_profile
  if (!profile) {
    return (
      <Page title="My application">
        <Card>
          <h2 className="text-lg font-semibold">You haven't applied yet</h2>
          <p className="mt-2 text-sm text-muted">Complete the mentor application to be considered for approval.</p>
          <Link to="/mentor/apply" className="mt-4 inline-block rounded-xl bg-accent px-4 py-2.5 font-medium text-white">Start application</Link>
        </Card>
      </Page>
    )
  }

  const statusContent = {
    pending: {
      title: 'Your application is being reviewed',
      detail: 'The admin team has received your application. You can return to this page to check its status.',
      style: 'border-amber-300 bg-amber-50 text-amber-900',
    },
    approved: {
      title: 'Your application has been approved',
      detail: 'Your mentor profile is approved. You can now receive and respond to connection requests.',
      style: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    },
    rejected: {
      title: 'Your application was not approved',
      detail: 'Please review the feedback below. You can update your application and submit it again.',
      style: 'border-rose-300 bg-rose-50 text-rose-900',
    },
  }[profile.verification_status]

  return (
    <Page title="My application">
      <Card>
        <div className={`rounded-xl border p-4 ${statusContent.style}`}>
          <p className="font-semibold">{statusContent.title}</p>
          <p className="mt-1 text-sm">{statusContent.detail}</p>
        </div>
        <dl className="mt-6 space-y-4">
          <div>
            <dt className="text-sm font-medium text-muted">About you</dt>
            <dd className="mt-1 whitespace-pre-wrap">{profile.bio}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted">Areas of expertise</dt>
            <dd className="mt-1 whitespace-pre-wrap">{profile.expertise_summary}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted">Submitted status</dt>
            <dd className="mt-1 capitalize">{profile.verification_status}</dd>
          </div>
          {profile.verification_status === 'rejected' && profile.review_reason && (
            <div>
              <dt className="text-sm font-medium text-muted">Feedback from the reviewer</dt>
              <dd className="mt-1 whitespace-pre-wrap">{profile.review_reason}</dd>
            </div>
          )}
          {profile.reviewed_at && (
            <div>
              <dt className="text-sm font-medium text-muted">Reviewed on</dt>
              <dd className="mt-1">{new Date(profile.reviewed_at).toLocaleDateString()}</dd>
            </div>
          )}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          {profile.verification_status === 'rejected' && <Link to="/mentor/apply" className="rounded-xl bg-accent px-4 py-2.5 font-medium text-white">Update and re-apply</Link>}
          {profile.verification_status === 'approved' && <Link to="/inbox" className="rounded-xl bg-accent px-4 py-2.5 font-medium text-white">Open connection requests</Link>}
          <Button variant="secondary" onClick={() => void refresh()}>Refresh status</Button>
        </div>
      </Card>
    </Page>
  )
}
