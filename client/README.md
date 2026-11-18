# NeuroConnect client (React + Vite + TypeScript + Tailwind)

## Run it
```bash
# terminal 1: API (needs database + .env set up, see root README)
cd server && npm run dev          # http://localhost:4000

# terminal 2: frontend
cd client
npm install
npm run dev                       # http://localhost:5173
```
Vite forwards every `/api/*` request to the server on port 4000, so there is no CORS setup and the login cookie just works.
Check types any time with `npx tsc -b`.

## How the code is organised
| File | What it is |
|---|---|
| `src/api.ts` | The only place that calls `fetch`. Use `get`, `post`, `patch`. Sends the session cookie. Throws `ApiError` with a readable `message`, plus `status` and `code`. |
| `src/auth.tsx` | `useAuth()` gives `{ user, loading, login, logout, refresh }`. `homeFor(role)` gives the landing page per role. |
| `src/components/ProtectedRoute.tsx` | Guards routes by role (already wired in `App.tsx`). |
| `src/components/ui.tsx` | `Button`, `Input`, `Card`, `ErrorMessage`, `Spinner`, `Page`, `Todo`. Use these so every screen looks the same. |
| `src/pages/*.tsx` | **One file per screen.** Edit only your own files. |
| `src/App.tsx` | All routes. Abdul edits this; ask him if you need a new route. |

## Who owns which page
| Page file | Route | Owner |
|---|---|---|
| Login, Register, VerifyOtp, ForgotPassword, ResetPassword | /login, /register, /verify-otp, /forgot-password, /reset-password | Member D |
| Search, Connections | /search, /connections | Member E |
| MentorApply, MentorStatus, AdminMentors | /mentor/apply, /mentor/status, /admin/mentors | Member F |
| MentorInbox | /inbox | Soha |
| AuditLog (done), Layout, auth, api | /admin/audit-log | Abdul |

Each placeholder page says what endpoints to use. Delete the `<Todo>` block and build the screen.

## Example: calling the API
```tsx
import { useEffect, useState } from 'react'
import { get } from '../api'
import { ErrorMessage, Spinner } from '../components/ui'

const [data, setData] = useState<any>(null)
const [error, setError] = useState<unknown>(null)
useEffect(() => { get('/mentors?q=adhd').then(setData).catch(setError) }, [])
// render: <ErrorMessage error={error} /> and <Spinner /> while data is null
```
Paths do NOT include `/api`; `api.ts` adds it.

## Rules
- Never call `fetch` directly. Always use `api.ts`.
- Always show loading, empty and error states.
- Only edit your own page files. Work on a branch, open a Pull Request.
- Keep the calm look: use the colours from `src/index.css` (`bg-accent`, `text-muted`, ...) and no animations.
