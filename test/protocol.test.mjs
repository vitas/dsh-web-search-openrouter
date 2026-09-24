import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildSearchBody, endpointFor, pathFor, searchInstruction } from '../src/host/protocol.js'
import { normalizeConfig } from '../src/shared/config.mjs'

const base = normalizeConfig({
  baseURL: 'https://gateway.example/v1/',
  model: 'some/model',
  maxResults: 5,
  maxOutputTokens: 512,
})

test('joins the base and operation path without doubling the slash', () => {
  assert.equal(endpointFor('https://gateway.example/v1/', '/responses'), 'https://gateway.example/v1/responses')
  assert.equal(endpointFor('https://gateway.example/v1', '/responses'), 'https://gateway.example/v1/responses')
  assert.equal(pathFor('openai'), '/responses')
})

test('always performs the search the tool asked for', () => {
  assert.equal(searchInstruction('kittens'), 'Perform a web search for the query: kittens')
})

test('openai protocol sends only the native tool type by default', () => {
  const body = buildSearchBody(base, 'q')
  assert.deepEqual(body.tools, [{ type: 'web_search' }])
  assert.equal(body.model, 'some/model')
  assert.equal(body.input, 'Perform a web search for the query: q')
  assert.equal(body.max_output_tokens, 512)
  assert.equal(body.plugins, undefined)
})

test('openai protocol adds domain filters only when configured', () => {
  const body = buildSearchBody(normalizeConfig({ ...base, allowedDomains: ['arxiv.org', 'arxiv.org'] }), 'q')
  assert.deepEqual(body.tools[0].filters, { allowed_domains: ['arxiv.org'] })
})

test('openrouter protocol sends the server tool with parameters', () => {
  const options = normalizeConfig({
    ...base,
    protocol: 'openrouter',
    engine: 'exa',
    maxTotalResults: 20,
    searchContextSize: 'high',
    maxUses: 3,
    allowedDomains: ['arxiv.org'],
    excludedDomains: ['spam.example'],
  })
  const body = buildSearchBody(options, 'q')
  assert.deepEqual(body.tools, [
    {
      type: 'openrouter:web_search',
      parameters: {
        engine: 'exa',
        max_results: 5,
        max_total_results: 20,
        search_context_size: 'high',
        max_uses: 3,
        allowed_domains: ['arxiv.org'],
        excluded_domains: ['spam.example'],
      },
    },
  ])
})

test('openrouter protocol omits the parameters object entirely when nothing is set', () => {
  const options = normalizeConfig({ baseURL: base.baseURL, model: base.model, protocol: 'openrouter' })
  assert.deepEqual(buildSearchBody(options, 'q').tools, [{ type: 'openrouter:web_search' }])
})

test('plugin protocol uses the deprecated plugin-era field names', () => {
  const options = normalizeConfig({
    ...base,
    protocol: 'plugin',
    engine: 'firecrawl',
    allowedDomains: ['a.example'],
    excludedDomains: ['b.example'],
  })
  const body = buildSearchBody(options, 'q')
  assert.deepEqual(body.plugins, [
    { id: 'web', engine: 'firecrawl', max_results: 5, include_domains: ['a.example'], exclude_domains: ['b.example'] },
  ])
  assert.equal(body.tools, undefined)
})

test('a request-supplied bound never exceeds the engine limit', () => {
  const options = normalizeConfig(base)
  const body = buildSearchBody({ ...options, maxResults: 25 }, 'q')
  assert.equal(body.tools[0].type, 'web_search')
})
