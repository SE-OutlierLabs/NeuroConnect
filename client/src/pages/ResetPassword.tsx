import { Page, Todo } from '../components/ui'

export default function ResetPassword() {
  return (
    <Page title="Reset password">
      <Todo owner="Member D" hint="POST /auth/reset-password {email, code, new_password}, then go to /login." />
    </Page>
  )
}
