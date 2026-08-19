import { useStorage } from '@vueuse/core'
import { type ComputedRef, type WritableComputedRef, computed, watch } from 'vue'

import { i18n } from '@/i18n'
import vuetify from '@/plugins/vuetify'

/** Supported Cockpit UI locales stored machine-locally in `cockpit-locale`. */
export type AppLocale = 'en-US' | 'zh-CN'

const localeStorage = useStorage<AppLocale>('cockpit-locale', 'en-US')

const vuetifyLocaleFor = (locale: AppLocale): string => (locale === 'zh-CN' ? 'zh-Hans' : 'en')

const syncLocale = (locale: AppLocale): void => {
  i18n.global.locale.value = locale
  vuetify.locale.current.value = vuetifyLocaleFor(locale)
}

syncLocale(localeStorage.value)

watch(localeStorage, (locale) => {
  syncLocale(locale)
})

/**
 * Machine-local locale preference. Never use `useBlueOsStorage` for this — language must not sync to the vehicle.
 * @returns {{ locale: import('vue').WritableComputedRef<AppLocale>, setLocale: (next: AppLocale) => void, isChinese: import('vue').ComputedRef<boolean> }}
 */
export function useLocale(): {
  /**
   *
   */
  locale: WritableComputedRef<AppLocale>
  /**
   *
   */
  setLocale: (next: AppLocale) => void
  /**
   *
   */
  isChinese: ComputedRef<boolean>
} {
  const locale = computed({
    get: () => localeStorage.value,
    set: (next: AppLocale) => {
      localeStorage.value = next
    },
  })

  const setLocale = (next: AppLocale): void => {
    localeStorage.value = next
  }

  const isChinese = computed(() => localeStorage.value === 'zh-CN')

  return { locale, setLocale, isChinese }
}

/**
 * Read the persisted locale without pulling Vue reactivity into non-component modules.
 * @returns {AppLocale}
 */
export const getStoredLocale = (): AppLocale => localeStorage.value
