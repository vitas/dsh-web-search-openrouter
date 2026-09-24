import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseSearchResponse, errorMessage, reportedSearchCount } from '../src/host/parse.js'

/** The shape api.b.ai returns for native `web_search` on the Responses API. */
const annotationEnvelope = {
  id: 'resp_1',
  output: [
    { id: 'ws_1', type: 'web_search_call', status: 'completed', action: { type: 'search', queries: ['q'], query: 'q' } },
    { id: 'ws_2', type: 'web_search_call', status: 'completed', action: { type: 'open_page', url: 'https://a.example' } },
    {
      id: 'msg_1',
      type: 'message',
      content: [
        {
          type: 'output_text',
          text: 'Alpha is at https://a.example and beta at https://b.example.',
          annotations: [
            { type: 'url_citation', start_index: 12, end_index: 33, title: 'A', url: 'https://a.example' },
            { type: 'url_citation', start_index: 43, end_index: 64, title: 'B', url: 'https://b.example' },
          ],
        },
      ],
    },
  ],
}

/** The shape OpenRouter's `openrouter:web_search` server tool returns. */
const serverToolEnvelope = {
  output: [
    {
      type: 'openrouter:web_search',
      status: 'completed',
      action: {
        type: 'search',
        query: 'q',
        sources: [
          { url: 'https://a.example', title: 'A', snippet: 'from sources' },
          { url: 'https://c.example', snippet: 'no title' },
        ],
      },
    },
    { type: 'message', content: [{ type: 'output_text', text: 'Answer.' }] },
  ],
  usage: { server_tool_use: { web_search_requests: 2 } },
}

test('reads url_citation annotations and slices the cited span as the snippet', () => {
  const result = parseSearchResponse(annotationEnvelope)
  assert.equal(result.searched, true)
  assert.equal(result.sources.length, 2)
  assert.deepEqual(result.sources[0], {
    url: 'https://a.example',
    title: 'A',
    snippet: 'https://a.example and', // text.slice(12, 33)
  })
  assert.equal(result.sources[1].url, 'https://b.example')
  assert.match(result.answer, /Alpha is at/)
})

test('reads action.sources from server-tool items', () => {
  const result = parseSearchResponse(serverToolEnvelope)
  assert.equal(result.searched, true)
  assert.deepEqual(result.sources[0], { url: 'https://a.example', title: 'A', snippet: 'from sources' })
  assert.deepEqual(result.sources[1], { url: 'https://c.example', snippet: 'no title' })
  assert.equal(reportedSearchCount(result.usage), 2)
})

test('deduplicates by URL and merges a missing field from a later sighting', () => {
  const envelope = {
    output: [
      { type: 'web_search_call', action: { sources: [{ url: 'https://a.example' }] } },
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: 'see a',
            annotations: [{ type: 'url_citation', url: 'https://a.example', title: 'Later title', content: 'excerpt' }],
          },
        ],
      },
    ],
  }
  const result = parseSearchResponse(envelope)
  assert.equal(result.sources.length, 1)
  assert.deepEqual(result.sources[0], { url: 'https://a.example', title: 'Later title', snippet: 'excerpt' })
})

test('an annotation `content` excerpt wins over the sliced span', () => {
  const envelope = {
    output: [
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: 'ignored slice',
            annotations: [{ type: 'url_citation', url: 'https://a.example', start_index: 0, end_index: 5, content: 'real excerpt' }],
          },
        ],
      },
    ],
  }
  assert.equal(parseSearchResponse(envelope).sources[0].snippet, 'real excerpt')
})

test('reports searched=false when the gateway ignored the tool', () => {
  const result = parseSearchResponse({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'from memory' }] }] })
  assert.equal(result.searched, false)
  assert.deepEqual(result.sources, [])
  assert.equal(result.answer, 'from memory')
})

test('falls back to the flattened output_text convenience field', () => {
  assert.equal(parseSearchResponse({ output: [], output_text: 'flat' }).answer, 'flat')
})

test('drops entries with no usable URL and ignores non-citation annotations', () => {
  const result = parseSearchResponse({
    output: [
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: 'x',
            annotations: [
              { type: 'file_citation', url: 'https://ignored.example' },
              { type: 'url_citation', url: '' },
              { type: 'url_citation', url: 'https://kept.example' },
            ],
          },
        ],
      },
    ],
  })
  assert.deepEqual(result.sources.map((s) => s.url), ['https://kept.example'])
})

test('tolerates a malformed envelope without throwing', () => {
  for (const value of [null, undefined, {}, { output: null }, { output: [null, 7] }, { output: [{ type: 'message' }] }]) {
    const result = parseSearchResponse(value)
    assert.equal(result.searched, false)
    assert.deepEqual(result.sources, [])
  }
})

test('extracts gateway error messages from either envelope shape', () => {
  assert.equal(errorMessage({ error: { message: 'bad key' } }), 'bad key')
  assert.equal(errorMessage({ error: 'bad key' }), 'bad key')
  assert.equal(errorMessage({ message: 'bad key' }), 'bad key')
  assert.equal(errorMessage({}), undefined)
})
