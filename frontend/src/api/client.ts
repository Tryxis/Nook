export class ApiError extends Error {
  status: number
  fieldErrors: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }

  /** First error for a field (keys from the API are camelCase or PascalCase). */
  field(name: string): string | undefined {
    const key = Object.keys(this.fieldErrors).find((k) => k.toLowerCase() === name.toLowerCase())
    return key ? this.fieldErrors[key][0] : undefined
  }
}

/** JSON fetch against our same-origin API. The auth cookie travels automatically. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const body = text ? safeParse(text) : undefined

  if (!res.ok) {
    const problem = (body ?? {}) as { title?: string; errors?: Record<string, string[]> }
    const errors = problem.errors ?? {}
    const first = Object.values(errors)[0]?.[0]
    const message =
      res.status === 429
        ? 'Slow down a little — too many requests. Try again in a minute.'
        : first ?? problem.title ?? `Something went wrong (${res.status}).`
    throw new ApiError(res.status, message, errors)
  }

  return body as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
