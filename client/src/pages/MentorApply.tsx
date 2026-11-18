import { Page, Todo } from '../components/ui'

export default function MentorApply() {
  return (
    <Page title="Apply as a mentor">
      <Todo owner="Member F" hint="POST /mentors/apply {bio, expertise_summary}. Call refresh() from useAuth() afterwards." />
    </Page>
  )
}
