import { Link } from 'react-router-dom'
import { Page } from '../components/ui'

export default function NotAllowed() {
  return (
    <Page title="You can't open this page">
      <p>Your account type doesn't have access to this page. <Link to="/" className="underline">Go back to your home page</Link>.</p>
    </Page>
  )
}
