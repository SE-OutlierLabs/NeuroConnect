import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-white shadow-sm shadow-accent/30 hover:bg-accent/90',
    secondary: 'bg-white/60 text-ink border border-white/70 backdrop-blur hover:bg-white/90',
    danger: 'bg-danger text-white hover:bg-danger/90',
  }[variant]
  return <button {...p} className={`rounded-xl px-4 py-2.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`} />
}

export function Input({ label, error, id, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const inputId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        {label}
        {p.required && <span aria-hidden="true" className="ml-0.5 text-danger">*</span>}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        {...p}
        className="field w-full rounded-xl px-3.5 py-2.5 placeholder:text-muted/70"
      />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-2xl p-6 ${className}`}>{children}</div>
}

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null
  const text = error instanceof Error ? error.message : String(error)
  return <p role="alert" className="mb-4 rounded-xl bg-danger-soft/80 px-3.5 py-2.5 text-sm text-danger">{text}</p>
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
