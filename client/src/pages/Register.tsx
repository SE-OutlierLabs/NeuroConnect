import { Page, Todo } from '../components/ui'

export default function Register() {
  return (
    <Page title="Create your account">
      <Todo owner="Member D" hint="POST /auth/register with age_confirmed: true (required 18+ checkbox). Then go to /verify-otp." />
    </Page>
  )
}
