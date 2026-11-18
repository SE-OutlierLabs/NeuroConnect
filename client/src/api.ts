// The ONLY place that calls fetch. Every request sends the session cookie (credentials: 'include').
const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number
  code?: string // e.g. 'EMAIL_NOT_VERIFIED' on login
  data: unknown
  constructor(message: string, status: number, data: unknown, code?: string) {
    super(message)
    this.status = status
    this.data = data
    this.code = code
  }
}

// The server answers { error: "text" } or { error: { formErrors, fieldErrors } } (zod). Turn both into one string.
function messageFrom(data: any, status: number): string {
  const e = data?.error
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const parts = [...(e.formErrors ?? []), ...Object.values(e.fieldErrors ?? {}).flat()]
    if (parts.length) return parts.join('. ')
  }
  return status === 429 ? 'Too many attempts. Please wait a bit and try again.' : `Something went wrong (${status}).`
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'include',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is it running?', 0, null)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status, data, data?.code)
  return data as T
}

export const get = <T = any>(path: string) => api<T>(path)
export const post = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} })
export const patch = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body: body ?? {} })
