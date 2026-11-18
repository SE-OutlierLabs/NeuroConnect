import { Page, Todo } from '../components/ui'

export default function Search() {
  return (
    <Page title="Find a mentor">
      <Todo owner="Member E" hint="GET /mentors?q=&page=&limit= and GET /mentors/suggested. Connect: POST /mentors/connect {mentor_user_id}." />
    </Page>
  )
}
