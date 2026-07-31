import { createI18n } from 'vue-i18n'

import { updateVuetifyLocale } from '@/plugins/vuetify'

import { type SupportedLocale, interfaceLocale, persistLocale, resolveLocale } from './locale'
import { messages } from './messages'

export const i18n = createI18n({
  legacy: false,
  locale: interfaceLocale.value,
  fallbackLocale: 'en-US',
  messages,
  missingWarn: false,
  fallbackWarn: false,
})

/**
 * Applies and persists the selected language across Cockpit and Vuetify.
 * @param {unknown} value Locale submitted by the language selector or storage.
 * @returns {SupportedLocale} Applied locale.
 */
export function setApplicationLocale(value: unknown): SupportedLocale {
  const locale = resolveLocale(value)
  interfaceLocale.value = locale
  persistLocale(locale)
  i18n.global.locale.value = locale
  updateVuetifyLocale(locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
  return locale
}

setApplicationLocale(interfaceLocale.value)
