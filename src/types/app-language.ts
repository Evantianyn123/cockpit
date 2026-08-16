export const supportedApplicationLocales = ['zh-CN', 'en-US'] as const

export type ApplicationLocale = (typeof supportedApplicationLocales)[number]

/**
 * Validates a locale received from a renderer or stored configuration.
 * @param {unknown} value Candidate application locale.
 * @returns {boolean} True when the locale is supported by Cockpit.
 */
export function isApplicationLocale(value: unknown): value is ApplicationLocale {
  return typeof value === 'string' && supportedApplicationLocales.includes(value as ApplicationLocale)
}
