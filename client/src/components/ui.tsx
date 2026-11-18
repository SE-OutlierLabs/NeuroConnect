import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-white hover:bg-accent/90',
    secondary: 'bg-surface text-ink border border-line hover:bg-accent-soft',
    danger: 'bg-danger text-white hover:bg-danger/90',
  }[variant]
  return <button {...p} className={`rounded-md px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`} />
}

export function Input({ label, error, id, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const inputId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={inputId} {...p} className="w-full rounded-md border border-line bg-surface px-3 py-2" />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-surface p-5 ${className}`}>{children}</div>
}

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null
  const text = error instanceof Error ? error.message : String(error)
  return <p role="alert" className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{text}</p>
}

export function Spinner({ label = 'Loading...' }: { label?: string }) {
  return <p role="status" className="py-8 text-center text-muted">{label}</p>
}

/** Page wrapper: title + content. */
export function Page({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  )
}

/** Shown by pages nobody has built yet. Replace the whole page body when you build yours. */
export function Todo({ owner, hint }: { owner: string; hint: string }) {
  return (
    <Card className="border-dashed">
      <p className="font-medium">Not built yet</p>
      <p className="mt-1 text-sm text-muted">Owner: {owner}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </Card>
  )
}
