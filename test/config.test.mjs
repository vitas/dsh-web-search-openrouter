import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_API_KEY_ENV,
  DEFAULT_BASE_URL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_MODEL,
  PROVIDER_ID,
  SETTINGS_NAMESPACE,
  clampMaxResults,
  normalizeConfig,
  normalizeDomainList,
  protocolSpec,
} from '../src/shared/config.mjs'

test('stable identity never drifts', () => {
  assert.equal(PROVIDER_ID, 'openrouter')
  assert.equal(SETTINGS_NAMESPACE, 'web-search-openrouter')
})

test('an empty config projects to documented defaults', () => {
  const options = normalizeConfig(undefined)
  assert.equal(options.protocol, 'openai')
  assert.equal(options.baseURL, DEFAULT_BASE_URL)
  assert.equal(options.model, DEFAULT_MODEL)
  assert.equal(options.apiKeyEnv, DEFAULT_API_KEY_ENV)
  assert.equal(options.maxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS)
  assert.equal(options.includeAnswer, false)
  assert.deepEqual(options.allowedDomains, [])
  assert.deepEqual(options.excludedDomains, [])
})

test('unknown protocols and malformed values fall back instead of throwing', () => {
  for (const raw of [null, 'nope', 42, [], { protocol: 'nonsense' }, { model: 7 }, { baseURL: '' }]) {
    const options = normalizeConfig(raw)
    assert.ok(['openai', 'openrouter', 'plugin'].includes(options.protocol))
    assert.equal(typeof options.model, 'string')
    assert.ok(options.model.length > 0)
  }
})

test('a literal key is kept and blank strings are dropped', () => {
  assert.equal(normalizeConfig({ apiKey: 'sk-live' }).apiKey, 'sk-live')
  assert.equal(normalizeConfig({ apiKey: '' }).apiKey, undefined)
  assert.equal(normalizeConfig({ apiKey: '   ' }).apiKey, '   ')
})

test('result bounds are clamped into the engine range', () => {
  assert.equal(clampMaxResults(0), undefined)
  assert.equal(clampMaxResults(-3), undefined)
  assert.equal(clampMaxResults(1.5), undefined)
  assert.equal(clampMaxResults(1), 1)
  assert.equal(clampMaxResults(5), 5)
  assert.equal(clampMaxResults(999), 25)
  assert.equal(normalizeConfig({ maxResults: 999 }).maxResults, 25)
  assert.equal(normalizeConfig({ maxResults: 'many' }).maxResults, undefined)
})

test('domain lists are trimmed, lowercased, de-duplicated and blank-free', () => {
  assert.deepEqual(normalizeDomainList([' ArXiv.org ', 'arxiv.org', '', '  ', 'b.example']), ['arxiv.org', 'b.example'])
  assert.deepEqual(normalizeDomainList('arxiv.org'), [])
  assert.deepEqual(normalizeDomainList(undefined), [])
})

test('protocol metadata resolves and defaults safely', () => {
  assert.equal(protocolSpec('openrouter').path, '/responses')
  assert.equal(protocolSpec('plugin').deprecated, true)
  assert.equal(protocolSpec('unknown').id, 'openai')
})
