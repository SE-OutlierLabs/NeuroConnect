import { Page, Todo } from '../components/ui'

export default function VerifyOtp() {
  return (
    <Page title="Verify your email">
      <Todo owner="Member D" hint="POST /auth/verify-otp {email, code}. Resend: POST /auth/resend-otp (60 s cooldown)." />
    </Page>
  )
}
