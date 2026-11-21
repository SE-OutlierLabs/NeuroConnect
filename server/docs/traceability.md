# SRS Traceability Matrix

Maps each implemented requirement to its screen, API endpoint(s), and how it's verified.
No formal SRS requirement IDs were issued for this sprint, so requirements are named
by the user story they implement — swap in the real `US-x.x` labels here once the team's
SRS numbering is finalized; the mapping underneath won't change.

| # | Requirement | Screen | Endpoint(s) | Test case |
|---|---|---|---|---|
| 1 | A user can register with name, email, password, role, and 18+ confirmation | `Register.tsx` | `POST /api/auth/register` | Manual: register via curl/UI, confirm 18+ is required (`age_confirmed: true`), confirm OTP is sent |
| 2 | A user verifies their email with a one-time code before they can log in | `VerifyOtp.tsx` | `POST /api/auth/verify-otp`, `POST /api/auth/resend-otp` | Manual: register → read OTP from dev console/Ethereal → verify → confirm `/auth/me` now shows verified |
| 3 | A user logs in, and an unverified account is blocked with a clear reason | `Login.tsx` | `POST /api/auth/login` | Manual: login before verifying (expect `403 EMAIL_NOT_VERIFIED`), then after verifying (expect success + session cookie) |
| 4 | A user can reset a forgotten password via emailed OTP; reset invalidates other sessions | `ForgotPassword.tsx`, `ResetPassword.tsx` | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` | Manual: request reset, read code from Ethereal/dev console, reset, confirm old session cookie no longer works |
| 5 | A logged-in user can view their session and log out | *(all protected pages via `ProtectedRoute.tsx`)* | `GET /api/auth/me`, `POST /api/auth/logout` | Manual: refresh a protected page (session persists), log out (session cookie cleared, protected pages redirect to login) |
| 6 | A mentee can search/browse approved mentors | `Search.tsx` | `GET /api/mentors` | Manual: search as mentee, confirm only `approved` + `active` mentors appear |
| 7 | A mentee sees ranked mentor suggestions, least-loaded first, excluding mentors they're already matched with | `Search.tsx` | `GET /api/mentors/suggested` | Automated: `tests/matchConcurrency.test.ts` covers the underlying capacity/status data; ranking itself is manually verified (seed 2+ mentors with different active-mentee counts, confirm order) |
| 8 | A mentee can send a connection request to a mentor who isn't at capacity (max 3 active mentees) | `Search.tsx` | `POST /api/mentors/connect` | Manual: connect to a mentor with 3 accepted mentees already, expect `409` full-capacity error |
| 9 | A mentee can view the status of requests they've sent | `Connections.tsx` | `GET /api/mentors/connections` (`sent`) | Manual: send a request, load Connections, confirm it shows `pending`, then `accepted`/`declined` after the mentor responds |
| 10 | A mentor can view requests they've received and accept or decline them; a second response to an already-answered request fails safely, not with a crash | `MentorInbox.tsx` | `GET /api/mentors/connections` (`received`), `PATCH /api/mentors/connections/:matchId/respond` | Automated: `tests/matchConcurrency.test.ts` (two simultaneous responses — only one succeeds). Manual: double-click Accept in the UI, confirm it reloads to the final state instead of showing an error |
| 11 | A prospective mentor applies with a bio, expertise summary, and (optionally) a verification document | `MentorApply.tsx` *(not yet built — Member F)* | `POST /api/mentors/apply`, `POST /api/mentors/upload` | Manual: register as mentor → verify OTP → upload a file → apply with the returned key → confirm `verification_status: pending` |
| 12 | A mentor's verification document key can't be spoofed to point at another user's folder | *(enforced server-side, no dedicated screen)* | `POST /api/mentors/apply` (key must start with `verification/<userId>/`) | Manual: apply with a key under a different user's folder, confirm `400 Invalid document key` |
| 13 | An admin reviews pending mentor applications and approves/rejects with a reason | `AdminMentors.tsx` | `GET /api/admin/mentors`, `PATCH /api/admin/mentors/:profileId/review` | Manual: as admin, reject a pending mentor without a `reason` (expect validation error), then with one (expect success + audit entry) |
| 14 | Every admin decision is recorded in an audit log | `AuditLog.tsx` | `GET /api/admin/audit-logs` | Manual: after an admin review action, confirm a matching entry appears in the audit log |

## Coverage notes
- Only one automated test exists so far (`matchConcurrency.test.ts`), covering the accept/decline race condition. Everything else above is manually verified via curl or the UI — worth flagging to the team as a gap, not hiding it.
- Row 11's screen is a stub (`Todo` component) owned by Member F; the backend side (upload + apply) is built and tested independently via curl.
