/**
 * apiClient.ts — thin fetch wrapper for the p2psats backend REST API.
 *
 * Cookie strategy
 * ───────────────
 * The backend issues an HttpOnly `__session` JWT cookie on successful
 * authentication. Every request here uses `credentials: 'include'` so the
 * browser attaches that cookie automatically on cross-origin requests. This
 * works in production because the backend sets `SameSite=None; Secure` in
 * production mode and the CORS policy on the backend must list the frontend
 * origin explicitly with `credentials: true`.
 *
 * CORS implications
 * ─────────────────
 * For credentials to flow, the server's `Access-Control-Allow-Origin` header
 * must be the exact requesting origin (not `*`). The backend reads
 * `FRONTEND_URL` from its environment and configures CORS accordingly. In
 * local dev, `VITE_API_URL` and the backend's `FRONTEND_URL` must match the
 * actual URLs in use (e.g. http://localhost:5173 and http://localhost:3000).
 *
 * Environment variable
 * ────────────────────
 * Set `VITE_API_URL` in `.env` (or `.env.local`) to point at the backend.
 * Defaults to `http://localhost:3000` when the variable is absent (dev only).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountDto {
  id: string
  /** ISO 8601 timestamp string from the backend */
  createdAt: string
  emailIdentity: { email: string; verifiedAt: string | null } | null
  nostrIdentity: { pubkey: string; verifiedAt: string | null } | null
}

/**
 * Standard Nostr signed event shape for kind:27235 (NIP-07 challenge-response /
 * NIP-98 HTTP Auth).
 *
 * The @p2psats/shared `NostrEvent` from `nip69/parseOrder` only carries the
 * fields needed for parsing orders (`id`, `pubkey`, `created_at`, `tags`) and
 * is missing `kind`, `content`, and `sig` — all required by the backend's
 * `NostrEventDto`. We declare a full type locally.
 */
export interface NostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof (body as Record<string, unknown>).message === 'string'
        ? (body as { message: string }).message
        : `HTTP ${status}`
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

const JSON_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (JSON_METHODS.has(method) && body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    let errorBody: unknown
    try {
      errorBody = contentType.includes('application/json')
        ? await response.json()
        : await response.text()
    } catch {
      errorBody = `HTTP ${response.status}`
    }
    throw new ApiError(response.status, errorBody)
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as unknown as T
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

export const apiClient = {
  auth: {
    /** POST /auth/email/start — initiate magic-link flow */
    startEmail(email: string): Promise<{ message: string }> {
      return request<{ message: string }>('POST', '/auth/email/start', { email })
    },

    /** POST /auth/email/verify — consume token, receive account + sets __session cookie */
    verifyEmail(token: string): Promise<{ account: AccountDto }> {
      return request<{ account: AccountDto }>('POST', '/auth/email/verify', { token })
    },

    /** GET /auth/nostr/challenge — fetch a one-time nonce */
    challengeNostr(): Promise<{ nonce: string }> {
      return request<{ nonce: string }>('GET', '/auth/nostr/challenge')
    },

    /** POST /auth/nostr/verify — verify signed kind:27235 event, sets __session cookie */
    verifyNostr(event: NostrEvent): Promise<{ account: AccountDto }> {
      return request<{ account: AccountDto }>('POST', '/auth/nostr/verify', { event })
    },

    /** POST /auth/link-email — start email-link flow for authenticated account */
    linkEmail(email: string): Promise<{ message: string }> {
      return request<{ message: string }>('POST', '/auth/link-email', { email })
    },

    /** POST /auth/link-nostr — link Nostr pubkey to authenticated account */
    linkNostr(event: NostrEvent): Promise<{ account: AccountDto }> {
      return request<{ account: AccountDto }>('POST', '/auth/link-nostr', { event })
    },

    /** GET /me — return the authenticated account */
    me(): Promise<AccountDto> {
      return request<AccountDto>('GET', '/me')
    },
  },

  // alerts.* methods are UNIMPLEMENTED — reserved for task #13
  alerts: {},
} as const
