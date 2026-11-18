import { Page, Todo } from '../components/ui'

export default function Login() {
  return (
    <Page title="Log in">
      <Todo owner="Member D" hint="POST /auth/login. On 403 with code EMAIL_NOT_VERIFIED go to /verify-otp. Use login() from useAuth(), then navigate(homeFor(user.role))." />
    </Page>
  )
}
