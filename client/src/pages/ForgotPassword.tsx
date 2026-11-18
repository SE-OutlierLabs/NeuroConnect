import { Page, Todo } from '../components/ui'

export default function ForgotPassword() {
  return (
    <Page title="Forgot password">
      <Todo owner="Member D" hint="POST /auth/forgot-password. Always show the same message whether or not the account exists." />
    </Page>
  )
}
