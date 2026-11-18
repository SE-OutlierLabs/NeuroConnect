import { Link } from 'react-router-dom'
import { Page } from '../components/ui'

export default function NotFound() {
  return (
    <Page title="Page not found">
      <p>That page doesn't exist. <Link to="/" className="underline">Go to the start</Link>.</p>
    </Page>
  )
}
