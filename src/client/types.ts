/**
 * Structural slices of the framework types this card consumes. Declared
 * locally so the client bundle stays pure — the DSH bundle-purity rule forbids
 * value (and, for safety, type) imports from other client packages.
 */

/** Mirrors `@deepseek-ai/dsh-client-ui-settings` `SettingsScopeSnapshot`. */
export interface SettingsSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: WebSearchSettings | undefined
  base: unknown
  user: unknown
  revision: number | undefined
  writable?: boolean
}

/** The `web-search-openrouter` namespace fields this card edits. */
export interface WebSearchSettings {
  protocol?: string
  apiKey?: string
  apiKeyEnv?: string
  baseURL?: string
  model?: string
  maxResults?: number
  maxOutputTokens?: number
  includeAnswer?: boolean
  engine?: string
  searchContextSize?: string
  maxUses?: number
  maxTotalResults?: number
  allowedDomains?: string[]
  excludedDomains?: string[]
  referer?: string
  title?: string
}

/** Minimal slice of the framework settings scope this card consumes. */
export interface WebSearchScope {
  getSnapshot(): SettingsSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
  unset(field: string): Promise<void>
}

/** Answer of `GET/POST /web-search-openrouter/credential`. */
export interface CredentialStatus {
  ok: boolean
  apiKeyEnv?: string
  configured?: boolean
  writable?: boolean
  source?: string
  error?: string
}

/** Answer of `POST /web-search-openrouter/test`. */
export interface TestResult {
  ok: boolean
  protocol?: string
  model?: string
  baseURL?: string
  query?: string
  durationMs?: number
  sources?: Array<{ url: string; title?: string; snippet?: string }>
  answer?: string
  code?: string
  error?: string
}
