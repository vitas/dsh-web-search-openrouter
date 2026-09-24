/**
 * `@samebits/dsh-web-search-openrouter` — browser half.
 *
 * Claims the `web-search-openrouter` namespace on the Plugins settings tab
 * through the keyed `settings.plugin.item` slot, so the card is exactly the one
 * the host half registered a schema for. Uses only cordis client context
 * services (`slots`, `locale`, `settingsScope`) and its own components — no
 * value imports from other DSH client packages (bundle-purity rule). Without
 * the settings UI the fiber simply never fires and nothing throws.
 *
 * Localization: registers en/zh dictionaries (the locales DSH ships) plus a
 * Russian language pack — `addLanguage({ id: 'ru' })` makes Russian selectable
 * and re-evaluates the browser language list, so a Russian browser activates it
 * automatically.
 */
import * as React from 'react'
import { WebSearchSettingsCard } from './SettingsCard.js'
import { bindTranslator, notifyLocale } from './i18n.js'
import { en, zh, ru } from './locales.js'

export const name = 'dsh-web-search-openrouter'
export const inject = ['slots', 'locale']

const NS = 'web-search-openrouter'

/** Register the copy dictionaries and bind the translator. */
function wireLocale(ctx: any): void {
  const locale = ctx.locale
  if (!locale) return
  try {
    ctx.effect(() => locale.register(NS, 'en', en))
    ctx.effect(() => locale.register(NS, 'zh', zh))
    ctx.effect(() => locale.register(NS, 'ru', ru))
    const hasRu = (locale.getSnapshot?.().locales ?? []).some((entry: { id: string }) => entry.id === 'ru')
    if (!hasRu) ctx.effect(() => locale.addLanguage({ id: 'ru', label: 'Русский', fallback: 'en' }))
    const translate = locale.bind(NS)
    bindTranslator((key: string, params?: Record<string, string | number>) => translate(key, params))
    // Re-render the mounted card when the active language changes.
    ctx.effect(() => locale.subscribe(() => notifyLocale()))
  } catch {
    // The i18n shim already renders English; a locale anomaly must not hide the card.
  }
}

export function apply(ctx: any) {
  wireLocale(ctx)
  ctx.inject(['settingsScope'], (c: any) => {
    try {
      const scope = c.settingsScope.bind({ namespace: NS })
      c.slots.inject('settings.plugin.item', () =>
        c.slots.register({ name: 'settings.plugin.item', key: NS, id: 'web-search-openrouter', order: 20 }, () =>
          React.createElement(WebSearchSettingsCard, { scope }),
        ),
      )
    } catch {
      // Binding anomalies must never break the settings page itself.
    }
  })
}
