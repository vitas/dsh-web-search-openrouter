# Gateways

Web search is a **server tool**: the gateway must implement it for the model you
name. Naming a model that does not support it is the most common misconfiguration,
so the plugin detects it and says so instead of returning a confident answer
built from the model's memory.

## Choosing a protocol

| Gateway | Protocol | Notes |
|---|---|---|
| `api.b.ai` | `openai` | Verified. `/v1/responses` + `tools: [{ type: 'web_search' }]`; hits arrive as `url_citation` annotations with no `action.sources`. |
| `openrouter.ai` | `openrouter` | Documented surface. `tools: [{ type: 'openrouter:web_search', parameters }]`. |
| `api.openai.com` | `openai` | Native tool; sources arrive as `web_search_call.action.sources[]`. |
| Older OpenRouter-era gateways | `plugin` | Deprecated `plugins: [{ id: 'web' }]`. |

A gateway that rejects the chosen protocol says so in the error text
(`Invalid value: 'openrouter:web_search'`, `Unknown parameter: 'tools'`, …), which
the plugin surfaces verbatim in the **Test search** panel.

## `api.b.ai` — verified model matrix

Measured with `tools: [{ type: 'web_search' }]` on `/v1/responses`.

| Model | Citations returned | Approx. input tokens | Verdict |
|---|---|---|---|
| `gpt-5.4-nano` | 2 | ~8.5k | cheapest that works |
| `gpt-5.4-mini` | 4 | — | |
| `gpt-5.5-instant` | 8 | — | most citations observed |
| `gpt-5-mini` | 4 | ~18.3k | larger context, no benefit here |
| `gpt-6-astra`, `gpt-6-sol`, `gpt-5.6-sol`, `gpt-5.5` | 1–4 | — | work, cost more |

Known **not** to work on this gateway:

- `gpt-5-nano` — answers without searching (`searched: false`).
- `glm-*`, `deepseek-*`, Anthropic and Gemini routes — the native tool is ignored.
- `:online` model suffixes — `model_not_found`.
- `plugins: [{ id: 'web' }]` — ignored.
- `openrouter:web_search` — rejected by the request validator.

## Cost

Server-side search is billed as **tokens**, not per query, and the search model's
input context is the dominant term. A single-query `web_search` on `api.b.ai` with
`gpt-5.4-nano` measured ~8.5k input tokens; with `dsh-tool-web`'s default
`searchMaxQueries: 4` one tool call can reach ~34k input tokens.

Levers, cheapest first:

1. **`searchMaxQueries`** in `dsh-tool-web` (composition config, not this plugin):
   set it to `1` if the agent usually asks one thing at a time.
2. **`model`** — the cheapest model the gateway serves *with search*.
3. **`maxResults`** — fewer results means a shorter injected context.
4. **`includeAnswer: false`** (default) — the search model's prose never enters
   the conversation.
5. **`maxUses`** (`openrouter` protocol) — hard cap on server-tool invocations.

If token-billed search is the wrong shape for your workload, a dedicated search
API (Brave, Tavily, Exa, SearXNG) is materially cheaper per query — but it needs
its own key and its own provider plugin. This plugin exists for the case where
you want search on the key and the account you already have.

## Attribution headers

OpenRouter ranks and attributes traffic from `HTTP-Referer` and `X-Title`. Set
`referer` and `title` in the settings card if you want your deployment
attributed; they are omitted otherwise.

## Diagnostics

The **Test search** button reports, for one real query:

- `protocol`, `model`, `baseURL` actually used;
- `durationMs`;
- the number of sources and their first five URLs;
- on failure, the routable `code` and the gateway's own message.

The same information is logged at debug level on every real search:

```
web-search-openrouter: {"endpoint":"…/responses","protocol":"openai","model":"gpt-5.4-nano","sources":7,"searched":2,"durationMs":6633}
```
