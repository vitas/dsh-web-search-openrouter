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

Known **not** to work on this gateway. The three failure modes are worth keeping
apart, because only one of them is loud:

| Models | Mechanism | Evidence (re-measured 2026-09-24) |
|---|---|---|
| `glm-5.3-flash`, `deepseek-v4.1-flash`, `qwen3.8-flash`, `minimax-*`, `mimo-*` | **HTTP 200, tool silently ignored.** The provider has no OpenAI-style server-side search, and an unknown entry in `tools` is dropped instead of rejected. | no `web_search_call` block; **24–105 input tokens** on the same prompt, against 4313 for the model that works |
| `gpt-5-nano` | **HTTP 200, model never calls the tool.** Same family as `gpt-5.4-nano`, so it is the model, not the route. | output was a lone `reasoning` block; **18 input tokens** |
| `gemini-*`, Anthropic routes | **HTTP 400 at the route**, before any tool question arises. | `model "gemini-3.5-flash-lite" is not supported on /v1/responses; use /v1/chat/completions instead` |
| `:online` suffixes | `model_not_found` — OpenRouter's routing convention, not implemented here. | |
| `plugins: [{ id: 'web' }]` | ignored (OpenRouter's older convention). | |
| `openrouter:web_search` | rejected by the request validator (OpenRouter-proprietary server tool). | |

Input-token count is the reliable tell: a search that really ran injects its
results back into the context, so the prompt suddenly costs thousands of tokens.
A silent no-op leaves the count at prompt size. That is the whole reason the
provider checks `searched` rather than trusting a 200.

The root cause is that "OpenAI-compatible" specifies the message shape, not the
server-side tools. Every vendor exposes search its own way: OpenAI as the
`web_search` tool on `/responses`, Gemini as `google_search` grounding,
Anthropic as its own tool with a different schema, and the Chinese providers as a
standalone search endpoint with **no model in the loop at all** — which is the
cheapest architecture of the lot if you are optimising for cost.

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
