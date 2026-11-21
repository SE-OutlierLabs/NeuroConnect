import { useEffect, useState } from 'react'
import { get } from '../api'
import { ErrorMessage, Page, Spinner } from '../components/ui'

// One audit log entry: who did what to which record.
type Log = {
  audit_id: number
  action: string
  target_table: string
  target_id: number
  occurred_at: string
  actor: { user_id: number; display_name: string; role: string }
}

// Admin page: lists the latest recorded admin actions (approvals and rejections).
export default function AuditLog() {
  const [logs, setLogs] = useState<Log[] | null>(null)
  const [error, setError] = useState<unknown>(null)

  // Load the log once when the page opens.
  useEffect(() => {
    get<{ logs: Log[] }>('/admin/audit-logs').then((d) => setLogs(d.logs)).catch(setError)
  }, [])

  return (
    <Page title="Audit log">
      <ErrorMessage error={error} />
      {!logs && !error && <Spinner />}
      {logs && logs.length === 0 && <p className="text-muted">No actions recorded yet. Approving or rejecting a mentor will appear here.</p>}
      {logs && logs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-accent-soft">
              <tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Target</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.audit_id} className="border-b border-line last:border-0">
                  <td className="p-3 whitespace-nowrap">{new Date(l.occurred_at).toLocaleString()}</td>
                  <td className="p-3">{l.actor.display_name} <span className="text-muted">({l.actor.role})</span></td>
                  <td className="p-3">{l.action}</td>
                  <td className="p-3">{l.target_table} #{l.target_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  )
}
