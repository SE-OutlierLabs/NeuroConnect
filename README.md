# NeuroConnect
NeuroConnect: a mobile-first web platform connecting neurodivergent adults with vetted mentors. React + Express + PostgreSQL. Software Engineering project, The Outliers.

## Dev setup — Email (OTP)

Register and forgot-password send a one-time code by email. In `server/.env`, `SMTP_*` can
point at [Ethereal](https://ethereal.email) for fake outbound email in dev.

On this network, outbound SMTP (port 587) was blocked (`ETIMEDOUT`) — Ethereal never actually
delivered. Fallback already built in: if SMTP isn't configured or a send fails, the server logs
the OTP code straight to the console instead, so register / verify-otp / forgot-password /
reset-password are all still testable end-to-end without working email. Watch the `server`
terminal output for the code after triggering any of those.

If your network allows outbound SMTP, Ethereal should work as documented on their site.
Mailpit (a local SMTP catcher) is a good alternative if Ethereal keeps timing out.
