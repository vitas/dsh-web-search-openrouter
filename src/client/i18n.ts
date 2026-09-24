/**
 * Translation shim. Components call `tr(key, params)`; the active translator is
 * bound to DSH's locale service during apply (see index.tsx). If the locale
 * service is absent, everything keeps rendering in English from the dictionary
 * instead of failing.
 */
import { en, type CopyKey } from './locales.js'

export type Translator = (key: CopyKey, params?: Record<string, string | number>) => string

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}

let active: Translator = (key, params) => interpolate(String((en as Record<string, string>)[key] ?? key), params)

/** Install the bound translate function (called once from apply). */
export function bindTranslator(translate: Translator): void {
  active = translate
}

/** Translate a copy key at render time; reads whatever locale is active now. */
export const tr: Translator = (key, params) => active(key, params)

/**
 * Language-change signal. `tr` reads the translator at render time, so a card
 * only needs to re-render when the active language changes; components observe
 * this counter through `useSyncExternalStore`.
 */
const listeners = new Set<() => void>()
let version = 0

/** Subscribe to active-language changes. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Current language revision (a stable primitive snapshot). */
export function localeRevision(): number {
  return version
}

/** Announce an active-language change to every mounted card. */
export function notifyLocale(): void {
  version += 1
  for (const listener of listeners) listener()
}
