import { useEffect, useState } from 'react'
import { ApiError, get, post } from '../api'
import { Button, Card, ErrorMessage, Input, Page, Spinner } from '../components/ui'

// A mentor as returned by GET /mentors.
type Mentor = {
  mentor_profile_id: number
  user_id: number
  bio: string
  expertise_summary: string
  user: { display_name: string }
}
// A suggested mentor also carries their current mentee count and why they were suggested.
type Suggested = Mentor & { active_mentee_count: number; reason: string }
// Shape of the paged search response.
type SearchResponse = { mentors: Mentor[]; page: number; limit: number; total: number }
// A request this mentee has already sent (used to disable the Connect button).
type Sent = { mentor_id: number; status: 'pending' | 'accepted' | 'declined' }

// Mentors shown per page.
const LIMIT = 10

// One mentor in a list, with a Connect button that is disabled once a request is sent.
function MentorCard({
  mentor, label, requested, connecting, note, onConnect,
}: {
  mentor: Mentor
  label?: string
  requested: boolean
  connecting: boolean
  note?: string
  onConnect: () => void
}) {
  return (
    <Card className="mb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{mentor.user.display_name}</h3>
          {label && <p className="text-xs text-muted">{label}</p>}
        </div>
        <Button onClick={onConnect} disabled={requested || connecting}>
          {requested ? 'Requested' : connecting ? 'Sending...' : 'Connect'}
        </Button>
      </div>
      <p className="mt-3 text-sm"><span className="font-medium">Expertise:</span> {mentor.expertise_summary}</p>
      <p className="mt-1 text-sm text-muted">{mentor.bio}</p>
      {note && <p role="alert" className="mt-3 text-sm text-danger">{note}</p>}
    </Card>
  )
}

// Mentee page: search approved mentors, see suggestions and send connection requests.
export default function Search() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const [suggested, setSuggested] = useState<Suggested[]>([])
  const [requested, setRequested] = useState<Set<number>>(new Set())
  const [connecting, setConnecting] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [q])

  // Search results.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    get<SearchResponse>(`/mentors?q=${encodeURIComponent(query)}&page=${page}&limit=${LIMIT}`)
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query, page])

  // Suggested mentors + mentors already requested (so their button starts disabled).
  useEffect(() => {
    get<{ suggested: Suggested[] }>('/mentors/suggested')
      .then((d) => setSuggested(d.suggested))
      .catch(() => {})
    get<{ sent: Sent[] }>('/mentors/connections')
      .then((d) => setRequested(new Set(d.sent.filter((s) => s.status !== 'declined').map((s) => s.mentor_id))))
      .catch(() => {})
  }, [])

  // Send a connection request; if it fails (for example the mentor is full) show the message under the card.
  async function connect(mentorId: number) {
    setConnecting(mentorId)
    setNotes((n) => ({ ...n, [mentorId]: '' }))
    try {
      await post('/mentors/connect', { mentor_user_id: mentorId })
      setRequested((s) => new Set(s).add(mentorId))
      setSuggested((list) => list.filter((m) => m.user_id !== mentorId))
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && /already have/i.test(err.message)) {
        setRequested((s) => new Set(s).add(mentorId))
      }
      setNotes((n) => ({ ...n, [mentorId]: err instanceof Error ? err.message : 'Something went wrong.' }))
    } finally {
      setConnecting(null)
    }
  }

  // Number of pages for the pager.
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const reasonLabel = (r: string) => (r === 'available' ? 'Available now' : 'Low current mentee load')

  return (
    <Page title="Find a mentor">
      {suggested.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold">Recommended for you</h2>
          <p className="mb-4 text-sm text-muted">Mentors with the fewest current mentees are shown first, so requests are spread out evenly.</p>
          {suggested.slice(0, 3).map((m) => (
            <MentorCard
              key={m.user_id}
              mentor={m}
              label={reasonLabel(m.reason)}
              requested={requested.has(m.user_id)}
              connecting={connecting === m.user_id}
              note={notes[m.user_id]}
              onConnect={() => connect(m.user_id)}
            />
          ))}
        </section>
      )}

      <h2 className="mb-3 text-lg font-semibold">All mentors</h2>
      <Input
        label="Search by name, bio or expertise"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. anxiety, study skills"
      />

      <ErrorMessage error={error} />
      {loading && <Spinner />}

      {!loading && !error && data && data.mentors.length === 0 && (
        <Card><p className="text-center text-muted">No mentors found.</p></Card>
      )}

      {!loading && data?.mentors.map((m) => (
        <MentorCard
          key={m.user_id}
          mentor={m}
          requested={requested.has(m.user_id)}
          connecting={connecting === m.user_id}
          note={notes[m.user_id]}
          onConnect={() => connect(m.user_id)}
        />
      ))}

      {data && data.total > data.limit && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted">Page {page} of {totalPages}</span>
          <Button variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </Page>
  )
}
