import { Page, Todo } from '../components/ui'

export default function MentorStatus() {
  return (
    <Page title="My application">
      <Todo owner="Member F" hint="Read user.mentor_profile from useAuth(). Show pending, approved or rejected and the review_reason." />
    </Page>
  )
}
