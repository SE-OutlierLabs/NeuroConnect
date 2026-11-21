# NeuroConnect

NeuroConnect is a mobile-first web platform that connects neurodivergent adults with vetted mentors.
Stack: React + Express + PostgreSQL. Software Engineering project, The Outliers.

## Sprint 1 scope

Sprint 1 delivers the four items set by our instructor (this differs from the sprint plan in the SRS):

| # | Feature | What works |
|---|---|---|
| 1 | Login / Register / Forgot password / OTP | Register with the 18+ confirmation, verify email with a 6-digit code, log in, reset a forgotten password |
| 2 | Admin approval for mentors | A mentor applies, an admin approves or rejects (a reason is required to reject), every decision goes to the audit log |
| 3 | Search mentor | Search approved mentors by name, bio or expertise, plus a suggested list ranked by mentor availability |
| 4 | Connect with mentor | A mentee sends a request, the mentor accepts or declines, and a mentor can have at most 3 accepted mentees |

Messaging and reporting belong to Sprint 2. The code is in `server/src/routes/message.routes.ts`, but its routes are switched off in `server/src/app.ts`.

## Tech stack

| Part | Technology |
|---|---|
| Client | Vite, React 19, TypeScript, react-router-dom, Tailwind CSS 4 |
| Server | Node.js, Express 5, TypeScript, Prisma ORM, zod, bcryptjs, express-session (sessions stored in PostgreSQL), rate limiting, nodemailer, multer |
| Database | PostgreSQL |
| Tests | vitest, supertest |

## Project structure

```
NeuroConnect/
  client/            React app (one file per page in src/pages)
  server/
    prisma/          schema, migrations, seed script
    src/routes/      auth, admin, mentor, upload (and message, disabled) routes
    src/middleware/  login, verified-email and role checks
    docs/            openapi.yaml, matching-rules.md, traceability.md
    tests/           automated tests
  .env.example       copy this to server/.env
  CHANGES.md         what the Sprint 1 hardening changed and what the frontend must know
```

## Getting started

### 1. Requirements

- Node.js 20 or newer (with npm)
- PostgreSQL, running locally, with an empty database (for example `neuroconnect`)
- Git

### 2. Clone

```bash
git clone https://github.com/SE-OutlierLabs/NeuroConnect
cd NeuroConnect
```

### 3. Configure the server

Copy the example file to `server/.env` and edit it:

```bash
# Windows PowerShell
copy .env.example server\.env

# macOS / Linux
cp .env.example server/.env
```

Set at least these values in `server/.env`:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string, e.g. `postgresql://user:password@localhost:5432/neuroconnect` |
| `SESSION_SECRET` | Any long random string |
| `CLIENT_URL` | `http://localhost:5173` |
| `PORT` | `4000` |

The `SMTP_*` values can stay empty in development (see "Email and OTP codes" below).

### 4. Set up the server and database

```bash
cd server
npm install
npx prisma migrate dev     # creates the tables
npx prisma generate
npm run db:seed            # adds the test accounts
```

### 5. Run the server

```bash
npm run dev                # http://localhost:4000
```

Open http://localhost:4000/api/health. You should see `{"status":"ok","database":"connected"}`.

### 6. Run the client

In a second terminal:

```bash
cd client
npm install
npm run dev                # http://localhost:5173
```

The client forwards every `/api` request to the server on port 4000, so you do not need any extra CORS or cookie setup. Keep both terminals running.

## Test accounts

`npm run db:seed` creates these accounts. The password for all of them is `Password123!`.

| Role | Email | Use it for |
|---|---|---|
| Admin | `admin@neuroconnect.local` | Reviewing mentor applications, audit log |
| Mentor (approved) | `mentor.approved@neuroconnect.local` | Inbox, accepting and declining requests |
| Mentor (pending) | `mentor.pending@neuroconnect.local` | Being approved or rejected by the admin |
| Mentee | `mentee@neuroconnect.local` | Search, suggested mentors, connect |

## Email and OTP codes

Register and forgot-password send a 6-digit code by email. In development you do not need working email. If `SMTP_HOST` is empty (or sending fails), the server prints the code in its terminal:

```
[DEV OTP] To: you@example.com | Purpose: verify_email | Code: 123456
```

Type that code on the OTP or reset page. Codes expire after 10 minutes, a new code can be requested once per minute, and 5 wrong guesses burn the code.

To send real emails in development, point the `SMTP_*` values at [Ethereal](https://ethereal.email) or a local [Mailpit](https://mailpit.axllent.org). Some networks block outbound SMTP (port 587); the console fallback works anyway.

## Try the whole Sprint 1 flow

1. Register a new mentee at `/register` (tick the 18+ box), enter the code from the server terminal, and you are logged in.
2. Log in as `mentor.pending@neuroconnect.local`. Open the application status page.
3. Log in as `admin@neuroconnect.local`, open **Mentor applications**, approve the mentor, then open **Audit log** to see the entry.
4. Log in as the mentee (`mentee@neuroconnect.local`), search for a mentor and press Connect.
5. Log in as the mentor (`mentor.approved@neuroconnect.local`), open **Requests** and accept or decline.

## Tests

```bash
cd server
npm test
```

The tests use your local database, so run the migrations first. The current automated test checks that two simultaneous accept and decline requests cannot both succeed.

## API documentation

- `server/docs/openapi.yaml`: request and response details for the auth endpoints
- `server/docs/matching-rules.md`: how suggested mentors are ranked and how the 3-mentee cap works
- `server/docs/traceability.md`: requirement, screen, endpoint and test for each Sprint 1 feature

Roles are `mentee`, `mentor`, `admin` and `moderator`. Every error response looks like `{ "error": "message" }`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Browser shows HTTP 502 for `/api/...` | The server is not running. Start it with `npm run dev` in `server`. |
| `prisma migrate dev` says "Drift detected" and mentions the `session` table | The server creates that table itself. Run `npx prisma migrate reset` (this wipes your local data), then `npm run db:seed`. |
| Type errors about `@prisma/client` | Run `npx prisma generate` in `server`. |
| Login says the email is not verified | Use the 6-digit code from the server terminal on the OTP page. |
| Seeded pending mentor gets "not allowed" | Your database has an old seed. Run `npx prisma migrate reset`, then `npm run db:seed`. |
| Port 4000 or 5173 is already in use | Close the old terminal or change `PORT` in `server/.env`. |
| Login keeps asking for credentials | Open the app at `http://localhost:5173` (not through another address) so the cookie is sent. |

## Working on the project

- Never push to `main`. Create a branch (`git checkout -b feat/short-name`), commit, push and open a Pull Request. Fill in the PR template.
- Pull `main` at the start of each work session: `git pull origin main`.
- Each client page is its own file in `client/src/pages/`. Only edit the files you own.
- Use `client/src/api.ts` for every API call; it sends the login cookie and turns server errors into readable messages.
- Keep comments short and in plain language, like the existing code.

## Team

The Outliers: Abdulrehman Lodhi (tech lead), Soha Ali, Sawera (QA), Areej, Muhammad Sufyan Sohail, Fahad Faisal.
