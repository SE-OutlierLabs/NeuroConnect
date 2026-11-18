import { Page, Todo } from '../components/ui'

export default function Connections() {
  return (
    <Page title="My connections">
      <Todo owner="Member E" hint="GET /mentors/connections, use the sent list. Show a status badge: pending, accepted or declined." />
    </Page>
  )
}
