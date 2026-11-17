# Sprint 1 server hardening (built on top of main @ 983f4bc, PR #3 included)

Teammate work from PR #3 is preserved: capacity cap (max 3 accepted mentees), `GET /mentors/suggested`,
atomic accept/decline, docs/matching-rules.md and tests/matchConcurrency.test.ts. Both sets of changes were merged
and tested together.

## Apply with git (recommended)
    git checkout main && git pull
    git checkout -b fix/sprint1-server-hardening
    git apply sprint1-hardening.patch
    cd server && npm install && npx prisma migrate dev && npx prisma generate
    git add -A && git commit -m "fix(server): Sprint 1 hardening (security, SRS gaps, role model)"
    git push -u origin fix/sprint1-server-hardening      # then open a Pull Request into main

## What changed
1. `.env` loads first (SMTP was never configured before): index.ts, new app.ts
2. Rate limiting (login 10 failures/15 min, other auth 20/15 min), OTP attempt cap (5), 60 s resend cooldown
3. 18+ confirmation required (`age_confirmed: true`)
4. Password reset invalidates all existing sessions
5. Unverified users blocked (login -> 403 `EMAIL_NOT_VERIFIED`; search/connect/admin need verified email)
6. Role model: only `mentor` accounts apply; approval doesn't change roles; decisions final; no self-approval; rejected mentors can re-apply
7. Deployment: trust proxy, COOKIE_SAMESITE, SESSION_SECRET required in production
8. Admin decision reason (required on reject)
9. Search / connect / suggested are mentee-only; Serializable transaction against duplicate requests; capacity check inside it
10. Admin `?status=` validated; audit entry inside the review transaction
11. `verification_doc_key` optional, must be under `verification/<userId>/`
12. Global JSON error handler, 404 for unknown /api routes, body size limit
13. OpenAPI spec updated for the new contract

## Frontend must know
- register needs `age_confirmed: true`; unverified login -> 403 `{code:"EMAIL_NOT_VERIFIED"}` (show OTP screen)
- `GET /mentors` -> `{ mentors, page, limit, total }`, mentee-only
- reject needs `reason`; `/auth/me` mentor_profile now has `review_reason`, no doc key
- apply is mentor-only

## Notes
- New migration `20261117090000_sprint1_hardening` adds OTP_TOKEN.attempts, MENTOR_PROFILE.review_reason, makes verification_doc_key nullable.
- If you already seeded: the pending mentor (Bilal) still has role `mentee`; change it to `mentor` manually or `prisma migrate reset`.
- tests/matchConcurrency.test.ts needs a live DB (unchanged, not run here).
