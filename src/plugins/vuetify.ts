// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { en, zhHans } from 'vuetify/locale'

import { type SupportedLocale, interfaceLocale, vuetifyLocale } from '@/i18n/locale'

const vuetify = createVuetify({
  locale: {
    locale: vuetifyLocale(interfaceLocale.value),
    fallback: 'en',
    messages: { en, zhHans },
  },
})

/**
 * Synchronizes Vuetify's internal component strings with Cockpit's language.
 * @param {SupportedLocale} locale Selected Cockpit interface locale.
 * @returns {void}
 */
export function updateVuetifyLocale(locale: SupportedLocale): void {
  vuetify.locale.current.value = vuetifyLocale(locale)
}

export default vuetify
