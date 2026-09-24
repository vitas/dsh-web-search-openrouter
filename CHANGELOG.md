# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2025-09-24

First public release. Published to npm as
[`@samebits/dsh-web-search-openrouter`](https://www.npmjs.com/package/@samebits/dsh-web-search-openrouter).

### Added

- `ctx.web` search provider (`id: openrouter`) that runs the built-in
  `web_search` tool server-side on an OpenRouter-compatible Responses gateway.
- Three request protocols: `openai` (`tools: [{ type: 'web_search' }]`),
  `openrouter` (`openrouter:web_search` server tool with `parameters`), and the
  deprecated `plugin` shape (`plugins: [{ id: 'web' }]`).
- Response parsing for `web_search_call.action.sources[]`,
  `openrouter:web_search.action.sources[]`, and `url_citation` annotations —
  including snippets sliced from the cited span when no excerpt is supplied.
  Sources are deduplicated by URL with missing fields merged across sightings.
- `web-search-openrouter` settings namespace, editable from the Plugins settings
  tab, with live reload through the settings scope. English, 中文 and Русский
  copy dictionaries.
- Settings card with per-field override markers and reset, a write-only API-key
  row backed by the DSH credential store, and a **Test search** button that runs
  one real query through the saved configuration.
- Loopback routes `POST /web-search-openrouter/test` and
  `GET|POST /web-search-openrouter/credential`.
- Per-search credential resolution through `ctx.credentials`, falling back to the
  launching process environment.
- Routable failures (`WEB_PROVIDER_CREDENTIAL_MISSING`, `WEB_ABORTED`,
  `WEB_PROVIDER_ERROR`), including a distinct error when the gateway answers
  without running a server-side search.
- 34 offline tests (`node --test`) plus an opt-in live smoke test.
- Bundle patch (`dsh.bundle.patch`) that points the web seam at this provider and
  composes the provider row, so `dsh plugin add` is the whole installation.
- GitHub Actions CI: host syntax check, client typecheck, locale parity, unit
  tests, committed-bundle freshness, and `npm pack` inspection.

[1.0.0]: https://github.com/vitas/dsh-web-search-openrouter/releases/tag/v1.0.0
