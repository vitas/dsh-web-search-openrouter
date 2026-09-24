# Distribution

## Package layout

`npm pack` publishes exactly:

```
package.json      main → src/host/index.js, exports ./client, ./cordis.patch.yml
src/              host + shared modules (plain ESM, no build step)
lib/client.js     the built browser bundle (committed)
cordis.patch.yml  bundle patch
README.md  CHANGELOG.md  LICENSE
```

`docs/`, `test/`, and `scripts/` stay in the repository; `files` keeps them out of
the tarball. `lib/` is in `.gitignore` for the *rest* of the directory but
`lib/client.js` is committed, because the registry install must work without
running a build. CI enforces freshness: it rebuilds and fails if the committed
bundle differs.

## Why the browser bundle is committed

A DSH profile installs packages into `~/.dsh/profiles/node_modules/` and loads the
client entry listed in `dsh.client`. Running esbuild at install time would require
a devDependency in a production install; committing the bundle keeps the install
to a plain extract, exactly like the harness's own client packages.

`prepare` and `prepack` still build it for local development, so a `link:`
checkout is always in sync.

## Installation paths

| Path | Command | Notes |
|---|---|---|
| Registry (recommended) | `dsh plugin add @samebits/dsh-web-search-openrouter --profile web` | Applies the bundle patch at the next boot. |
| Linked checkout | `dsh plugin add link:$PWD --profile web` | Same bundle patch; run `npm install && npm run build` first. |

Both paths compose the web seam and the provider row from
[`cordis.patch.yml`](../cordis.patch.yml). The profile's own
`cordis.patch.yml` is applied **after** bundle patches and wins per row, so a
deployment can override any value (and address the same `web-search-openrouter`
row) without forking the package.

> A patch replaces the target row's **whole** `config`, so an override must
> restate every field it wants to keep. The `web` row carries exactly
> `searchProvider` and `fetchProvider`.

## Profile wiring, spelled out

The bundle patch is equivalent to:

```yaml
- id: web
  config:
    searchProvider: openrouter
    fetchProvider: http

- insert:
    - id: web-search-openrouter
      name: '@samebits/dsh-web-search-openrouter'
      config:
        protocol: openai
        apiKeyEnv: OPENROUTER_API_KEY
        baseURL: https://openrouter.ai/api/v1
        model: openai/gpt-5.2
```

Do **not** also add this `insert` to the profile's own patch: two rows with the
same id would register two providers with the same id. If you wired the plugin
manually before 1.0.0, delete those rows when you switch to the bundled install.

## Release checklist

```sh
npm ci
npm run check          # syntax + typecheck
npm run check-locales
npm test               # 35 offline tests
DSH_WEB_SEARCH_LIVE=1 OPENROUTER_API_KEY=… \
  DSH_WEB_SEARCH_BASE_URL=… DSH_WEB_SEARCH_MODEL=… \
  node --test test/live.test.mjs
npm run build          # and commit lib/client.js
npm pack --dry-run     # confirm the file set
```

Then: bump `version` in `package.json`, move the CHANGELOG's unreleased section
into the new version, tag `vX.Y.Z`, and `npm publish --access public` (the package
is scoped, so `--access public` is required).

## Versioning

Semantic versioning against the plugin's own surfaces:

- **major** — a renamed or removed config field, provider `id`, settings
  namespace, or loopback route; a raised minimum DSH version.
- **minor** — a new protocol, field, route, or locale.
- **patch** — parsing fixes, message improvements, dependency bumps.
