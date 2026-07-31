import { ref } from 'vue'

export const INTERFACE_LANGUAGE_STORAGE_KEY = 'cockpit-interface-language-v1'
export const DEFAULT_INTERFACE_LOCALE = 'zh-CN'
export const supportedLocales = ['zh-CN', 'en-US'] as const

export type SupportedLocale = (typeof supportedLocales)[number]

/**
 * Checks whether a value is a supported Cockpit interface locale.
 * @param {unknown} value Value to validate.
 * @returns {boolean} True when the value is a supported locale.
 */
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && supportedLocales.includes(value as SupportedLocale)
}

/**
 * Resolves an arbitrary stored value to a supported locale.
 * @param {unknown} value Value loaded from storage or a UI control.
 * @returns {SupportedLocale} Supported locale, falling back to simplified Chinese.
 */
export function resolveLocale(value: unknown): SupportedLocale {
  return isSupportedLocale(value) ? value : DEFAULT_INTERFACE_LOCALE
}

/**
 * Reads this workstation's interface-language preference.
 * @returns {SupportedLocale} Persisted locale or the Chinese default.
 */
export function readStoredLocale(): SupportedLocale {
  if (typeof localStorage === 'undefined') return DEFAULT_INTERFACE_LOCALE
  return resolveLocale(localStorage.getItem(INTERFACE_LANGUAGE_STORAGE_KEY))
}

export const interfaceLocale = ref<SupportedLocale>(readStoredLocale())

/**
 * Persists one validated interface locale on this workstation.
 * @param {SupportedLocale} locale Locale to persist.
 * @returns {void}
 */
export function persistLocale(locale: SupportedLocale): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(INTERFACE_LANGUAGE_STORAGE_KEY, locale)
}

/**
 * Maps application locales to the locale identifiers supplied by Vuetify.
 * @param {SupportedLocale} locale Application locale.
 * @returns {'en' | 'zhHans'} Vuetify locale identifier.
 */
export function vuetifyLocale(locale: SupportedLocale): 'en' | 'zhHans' {
  return locale === 'zh-CN' ? 'zhHans' : 'en'
}
