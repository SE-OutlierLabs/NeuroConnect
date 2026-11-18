import { Page, Todo } from '../components/ui'

export default function AdminMentors() {
  return (
    <Page title="Mentor applications">
      <Todo owner="Member F" hint="GET /admin/mentors?status=pending. PATCH /admin/mentors/:profileId/review {decision, reason}. A reason is required to reject." />
    </Page>
  )
}
