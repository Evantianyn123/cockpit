import { getStoredLocale } from '@/composables/useLocale'
import { runtimeDictionary } from '@/i18n/dictionary'
import { lookup, normalizeSourceText } from '@/libs/i18n/dom-translator'

/**
 * Translate a runtime English UI string when the active locale is Chinese.
 * @param {string} raw
 * @returns {string}
 */
export const translateRuntimeText = (raw: string): string => {
  if (getStoredLocale() !== 'zh-CN') return raw
  return lookup(raw, runtimeDictionary) ?? raw
}

/**
 * Translate snackbar or dialog message arrays element-wise.
 * @param {string | string[]} message
 * @returns {string | string[]}
 */
export const translateRuntimeMessage = (message: string | string[]): string | string[] => {
  if (Array.isArray(message)) return message.map((entry) => translateRuntimeText(entry))
  return translateRuntimeText(message)
}

/**
 * Whether runtime DOM translation should run.
 * @returns {boolean}
 */
export const shouldRunDomTranslation = (): boolean => getStoredLocale() === 'zh-CN'

const PROTECTED_TERMS = new Set(['Cockpit', 'BlueOS', 'MAVLink', 'MAVLink2REST', 'ArduPilot'])

/**
 * Skip translation only when the entire string is a brand or protocol name.
 * Sentences that contain these terms are translated; the terms stay in the Chinese copy.
 * @param {string} raw
 * @returns {boolean}
 */
export const isProtectedSourceText = (raw: string): boolean => {
  const normalized = normalizeSourceText(raw)
  if (!normalized) return true
  return PROTECTED_TERMS.has(normalized)
}
