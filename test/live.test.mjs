/**
 * Opt-in live smoke test: one real search against a real gateway.
 *
 * Skipped unless `DSH_WEB_SEARCH_LIVE=1` — CI must never require a credential,
 * and the default `npm test` stays offline and deterministic.
 *
 *   DSH_WEB_SEARCH_LIVE=1 \
 *   OPENROUTER_API_KEY=sk-... \
 *   DSH_WEB_SEARCH_BASE_URL=https://openrouter.ai/api/v1 \
 *   DSH_WEB_SEARCH_MODEL=openai/gpt-5.2 \
 *   node --test test/live.test.mjs
 *
 * `DSH_WEB_SEARCH_PROTOCOL` picks the enablement surface (`openai`,
 * `openrouter`, or `plugin`), so the same test proves whichever surface the
 * target gateway supports.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { normalizeConfig } from '../src/shared/config.mjs'
import { OpenRouterSearchProvider, resolveOptions } from '../src/host/provider.js'

const live = process.env.DSH_WEB_SEARCH_LIVE === '1'

/** Minimal stand-in for the cordis context the provider reads. */
const fakeCtx = { get: () => undefined }

test('a live gateway search returns citeable sources', { skip: live ? false : 'set DSH_WEB_SEARCH_LIVE=1 to run' }, async () => {
  const config = normalizeConfig({
    protocol: process.env.DSH_WEB_SEARCH_PROTOCOL ?? 'openai',
    baseURL: process.env.DSH_WEB_SEARCH_BASE_URL,
    model: process.env.DSH_WEB_SEARCH_MODEL,
    apiKeyEnv: 'OPENROUTER_API_KEY',
    maxResults: 5,
  })
  const options = resolveOptions(fakeCtx, config)
  assert.ok(options.resolveApiKey !== undefined)
  const apiKey = await options.resolveApiKey()
  assert.ok(apiKey !== undefined, 'OPENROUTER_API_KEY must be set for the live test')

  const provider = new OpenRouterSearchProvider(() => options)
  const result = await provider.search({ query: 'DeepSeek Harness web search plugin', maxResults: 5 })
  assert.ok(Array.isArray(result.sources))
  assert.ok(result.sources.length > 0, 'the gateway returned no sources for a query that certainly has hits')
  for (const source of result.sources) {
    assert.match(source.url, /^https?:\/\//)
  }
  console.log(`live search: ${result.sources.length} sources, first = ${result.sources[0].url}`)
})

test('a credential-less configuration fails with a routable code', async () => {
  const options = resolveOptions({ get: () => undefined }, normalizeConfig({ apiKeyEnv: 'DEFINITELY_ABSENT_KEY' }))
  delete process.env.DEFINITELY_ABSENT_KEY
  const provider = new OpenRouterSearchProvider(() => options)
  await assert.rejects(
    () => provider.search({ query: 'x', maxResults: 1 }),
    (error) => error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING',
  )
})
