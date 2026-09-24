/**
 * `dsh-web-search-openrouter` — host half.
 *
 * Registers a `ctx.web` search provider that runs the harness's built-in
 * `web_search` tool through an OpenRouter-compatible gateway, using the same
 * endpoint and credential as the chat models. It also owns the
 * `web-search-openrouter` settings namespace (the Plugins settings card) and a
 * loopback test route the card calls to prove the configuration works.
 *
 * No server of its own, no telemetry: the only outbound traffic is the search
 * request itself, to the endpoint the user configured.
 *
 * @module dsh-web-search-openrouter/host
 */

import {
  DEFAULT_API_KEY_ENV,
  DEFAULT_BASE_URL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_MAX_RESULTS,
  DEFAULT_MODEL,
  MAX_RESULTS_LIMIT,
  PLUGIN_NAME,
  PROTOCOL_IDS,
  SETTINGS_NAMESPACE,
} from '../shared/config.mjs'
import { OpenRouterSearchProvider, resolveOptions } from './provider.js'

export { OpenRouterSearchProvider } from './provider.js'

/** Cordis plugin name used by loader diagnostics. */
export const name = PLUGIN_NAME

/** The web seam this provider registers into. */
export const inject = ['web']

/** Loopback route the settings card uses for its "Test search" button. */
export const TEST_ROUTE = '/web-search-openrouter/test'

/** Loopback route the settings card uses to read and write the API key. */
export const CREDENTIAL_ROUTE = '/web-search-openrouter/credential'

/** POSIX-shell identifier grammar accepted by the credentials seam. */
const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Upper bound on sources echoed back to the card. */
const TEST_SOURCE_LIMIT = 8

/** Default probe query; specific enough to produce real hits on any engine. */
const TEST_QUERY = 'DeepSeek Harness web search plugin'

/**
 * Build the settings schema. Kept in a helper so the schema only exists when
 * schemastery resolves — a bare development checkout without the peer still
 * composes, with the composition entry as the only configuration source.
 */
async function buildSchema() {
  const { default: z } = await import('@deepseek-ai/schemastery')
  return z.object({
    protocol: z.union(PROTOCOL_IDS.map((id) => z.const(id))).default('openai'),
    apiKey: z.string().role('secret'),
    apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
    baseURL: z.string().default(DEFAULT_BASE_URL),
    model: z.string().default(DEFAULT_MODEL),
    maxResults: z.number().step(1).min(1).max(MAX_RESULTS_LIMIT).default(DEFAULT_MAX_RESULTS),
    maxOutputTokens: z.number().step(1).min(1).default(DEFAULT_MAX_OUTPUT_TOKENS),
    includeAnswer: z.boolean().default(false),
    engine: z.string(),
    searchContextSize: z.string(),
    maxUses: z.number().step(1).min(1),
    maxTotalResults: z.number().step(1).min(1),
    allowedDomains: z.array(z.string()),
    excludedDomains: z.array(z.string()),
    referer: z.string(),
    title: z.string(),
  })
}

/** Write one JSON response with no caching. */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** Read and parse a small JSON request body; resolves `{}` for an empty body. */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 64 * 1024) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (size === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Plugin entry.
 *
 * @param ctx - host cordis context.
 * @param config - the composition entry's config (the settings base layer).
 */
export async function apply(ctx, config = {}) {
  /** Effective configuration: composition entry until the settings service attaches. */
  let current = () => config

  try {
    const schema = await buildSchema()
    ctx.inject(['settings'], (settingsCtx) => {
      settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, schema, config, {
        setSource: (source) => {
          current = source
        },
        onChange: () => {},
      })
    })
  } catch {
    // schemastery or the settings seam unavailable — the composition entry stays
    // authoritative and every other surface keeps working.
  }

  const provider = new OpenRouterSearchProvider(() => {
    const options = resolveOptions(ctx, current())
    return {
      ...options,
      log: (event) => ctx.logger?.debug?.(`${PLUGIN_NAME}: ${JSON.stringify(event)}`),
    }
  })
  ctx.web.registerSearchProvider(provider)

  // The card's "Test search" and key-management routes. Registered only when
  // the web GUI is mounted; headless and SDK compositions simply never fire
  // this fiber.
  ctx.inject(['webServer'], (serverCtx) => {
    if (!serverCtx.webServer?.register) return

    /** Resolve the credentials service, if this composition has one. */
    const credentialsOf = () => ctx.get('credentials')

    /** The reference the current configuration names, when it is well-formed. */
    const currentRef = () => {
      const env = resolveOptions(ctx, current()).apiKeyEnv
      return REF_PATTERN.test(env) ? env : undefined
    }

    const disposeTest = serverCtx.webServer.register({
      kind: 'exact',
      path: TEST_ROUTE,
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          return sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
        }
        let query = TEST_QUERY
        try {
          const body = await readJsonBody(req)
          if (typeof body?.query === 'string' && body.query.trim().length > 0) query = body.query.trim().slice(0, 400)
        } catch (error) {
          return sendJson(res, 400, { ok: false, error: `invalid request body: ${String(error?.message ?? error)}` })
        }
        const options = resolveOptions(ctx, current())
        const startedAt = Date.now()
        try {
          const result = await provider.search({ query, maxResults: TEST_SOURCE_LIMIT })
          return sendJson(res, 200, {
            ok: true,
            protocol: options.protocol,
            model: options.model,
            baseURL: options.baseURL,
            query,
            durationMs: Date.now() - startedAt,
            sources: result.sources.slice(0, TEST_SOURCE_LIMIT).map((source) => ({
              url: source.url,
              ...(source.title !== undefined ? { title: source.title } : {}),
              ...(source.snippet !== undefined ? { snippet: source.snippet.slice(0, 240) } : {}),
            })),
            ...(result.content !== undefined ? { answer: result.content.slice(0, 1200) } : {}),
          })
        } catch (error) {
          return sendJson(res, 200, {
            ok: false,
            protocol: options.protocol,
            model: options.model,
            baseURL: options.baseURL,
            query,
            durationMs: Date.now() - startedAt,
            code: typeof error?.code === 'string' ? error.code : 'WEB_PROVIDER_ERROR',
            error: String(error?.message ?? error),
          })
        }
      },
    })

    const disposeCredential = serverCtx.webServer.register({
      kind: 'exact',
      path: CREDENTIAL_ROUTE,
      handler: async (req, res) => {
        const ref = currentRef()
        if (ref === undefined) {
          return sendJson(res, 200, { ok: false, error: 'apiKeyEnv is not a valid credential reference' })
        }
        const credentials = credentialsOf()
        if (credentials === undefined) {
          return sendJson(res, 200, { ok: false, configured: false, writable: false, error: 'no credentials service in this composition' })
        }
        try {
          if (req.method === 'GET') {
            const info = await credentials.describe(ref)
            return sendJson(res, 200, {
              ok: true,
              apiKeyEnv: ref,
              configured: info.configured === true,
              writable: info.writable === true,
              ...(info.source !== undefined ? { source: info.source } : {}),
            })
          }
          if (req.method !== 'POST') {
            return sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
          }
          const body = await readJsonBody(req)
          const value = typeof body?.value === 'string' ? body.value : ''
          if (value.length === 0) await credentials.unset(ref)
          else await credentials.set(ref, value)
          const info = await credentials.describe(ref)
          return sendJson(res, 200, {
            ok: true,
            apiKeyEnv: ref,
            configured: info.configured === true,
            writable: info.writable === true,
            ...(info.source !== undefined ? { source: info.source } : {}),
          })
        } catch (error) {
          return sendJson(res, 200, {
            ok: false,
            apiKeyEnv: ref,
            code: typeof error?.code === 'string' ? error.code : 'CREDENTIAL_WRITE_FAILED',
            error: String(error?.message ?? error),
          })
        }
      },
    })

    serverCtx.effect(() => () => {
      disposeTest?.()
      disposeCredential?.()
    })
  })

  ctx.logger?.info?.(`${PLUGIN_NAME}: provider registered as "${provider.id}"`)
}
