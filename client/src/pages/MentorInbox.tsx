import { useEffect, useState } from 'react'
import { get, patch, ApiError } from '../api'
import { Button, Card, ErrorMessage, Page, Spinner } from '../components/ui'

type Status = 'pending' | 'accepted' | 'declined'
// A connection request a mentee has sent to this mentor.
type Received = {
  match_id: number
  status: Status
  requested_at: string
  mentee: { user_id: number; display_name: string }
}

// Badge colours for each request status.
const badge: Record<Status, string> = {
  pending: 'bg-white/60 text-muted border border-white/70',
  accepted: 'bg-accent text-white',
  declined: 'bg-danger-soft/80 text-danger',
}

// Mentor page: lists incoming requests with Accept and Decline buttons.
export default function MentorInbox() {
  const [received, setReceived] = useState<Received[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  // Fetch the requests this mentor has received.
  function load() {
    get<{ received: Received[] }>('/mentors/connections')
      .then((d) => setReceived(d.received))
      .catch(setError)
  }

  // Load once when the page opens.
  useEffect(load, [])

  // Accept or decline. The server answers 409 if the request was already answered, so we just reload the list.
  async function respond(matchId: number, decision: 'accepted' | 'declined') {
    // Ignore extra clicks while a request is being sent.
    if (busyId !== null) return
    setBusyId(matchId)
    setError(null)
    try {
      await patch(`/mentors/connections/${matchId}/respond`, { decision })
      load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        load()
      } else {
        setError(err)
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Page title="Connection requests">
      <ErrorMessage error={error} />
      {!received && !error && <Spinner />}

      {received && received.length === 0 && (
        <Card className="text-center">
          <p className="text-muted">No connection requests yet.</p>
        </Card>
      )}

      {received?.map((r) => (
        <Card key={r.match_id} className="mb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{r.mentee.display_name}</h3>
              <p className="text-xs text-muted">Requested {new Date(r.requested_at).toLocaleDateString()}</p>
            </div>

            {r.status === 'pending' ? (
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  disabled={busyId !== null}
                  onClick={() => respond(r.match_id, 'accepted')}
                >
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  disabled={busyId !== null}
                  onClick={() => respond(r.match_id, 'declined')}
                >
                  Decline
                </Button>
              </div>
            ) : (
              <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${badge[r.status]}`}>
                {r.status}
              </span>
            )}
          </div>
        </Card>
      ))}
    </Page>
  )
}
