# Mentor Matching Rules — NeuroConnect

## Who gets suggested
A mentee is shown mentors who meet all of the following:
- `verification_status = approved` (vetted by a moderator)
- Account is `active` (not suspended/deactivated)
- The mentee has no existing `pending` or `accepted` match with them (no duplicate suggestions)
- The mentor is **under capacity** (fewer than 3 currently `accepted` mentees)

## Ranking
Suggested mentors are sorted by current mentee load, ascending — mentors with
fewer active mentees are shown first. This spreads mentees more evenly instead
of everyone piling onto the same few mentors.

## Reason labels
- `available` — mentor currently has 0 accepted mentees
- `low current mentee load` — mentor has 1–2 accepted mentees
- (mentors with 3+ accepted mentees are excluded entirely, not shown with a label)

## Capacity cap
A mentor can have at most **3** concurrently accepted mentees. This is enforced in
two places:
- `POST /api/mentors/connect` — rejects a new request with `409 This mentor is at
  full capacity` if the mentor is already at 3
- `GET /api/mentors/suggested` — excludes full mentors from suggestions entirely

## Concurrency
Accepting/declining a match (`PATCH /api/mentors/connections/:matchId/respond`) uses
an atomic database update (`updateMany` with the status condition inside the `WHERE`
clause) rather than a separate read-then-write. This prevents a race condition where
two near-simultaneous requests could both pass a "is this still pending?" check before
either one writes its result.