import { Page, Todo } from '../components/ui'

export default function MentorInbox() {
  return (
    <Page title="Connection requests">
      <Todo owner="Soha" hint="GET /mentors/connections (received list). PATCH /mentors/connections/:matchId/respond {decision}. 409 means already answered: reload." />
    </Page>
  )
}
