import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'
import { Card, ErrorMessage, Page, Spinner } from '../components/ui'

type Status = 'pending' | 'accepted' | 'declined'
type Sent = {
  match_id: number
  status: Status
  requested_at: string
  mentor: { user_id: number; display_name: string }
}

const badge: Record<Status, string> = {
  pending: 'bg-white/60 text-muted border border-white/70',
  accepted: 'bg-accent text-white',
  declined: 'bg-danger-soft/80 text-danger',
}

export default function Connections() {
  const [sent, setSent] = useState<Sent[] | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    get<{ sent: Sent[] }>('/mentors/connections')
      .then((d) => setSent(d.sent))
      .catch(setError)
  }, [])

  return (
    <Page title="My connections">
      <ErrorMessage error={error} />
      {!sent && !error && <Spinner />}

      {sent && sent.length === 0 && (
        <Card className="text-center">
          <p className="text-muted">You haven't requested any mentors yet.</p>
          <Link to="/search" className="mt-2 inline-block font-medium text-accent underline">Find a mentor</Link>
        </Card>
      )}

      {sent?.map((c) => (
        <Card key={c.match_id} className="mb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{c.mentor.display_name}</h3>
              <p className="text-xs text-muted">Requested {new Date(c.requested_at).toLocaleDateString()}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${badge[c.status]}`}>{c.status}</span>
          </div>
        </Card>
      ))}
    </Page>
  )
}
