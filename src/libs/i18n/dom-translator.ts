/** Marks a DOM subtree as user-owned or otherwise off-limits to runtime translation. */
export const NO_I18N_ATTRIBUTE = 'data-cockpit-no-i18n'

/** Attributes whose string values may be translated when they hold UI copy, not user data. */
export const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const

// Canvas widgets (Attitude, Compass, Plotter, etc.) and video ASS overlays render text outside the DOM tree,
// so they are out of scope for this runtime walker and would need per-widget changes to localize.

const SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'SCRIPT', 'STYLE', 'IFRAME', 'PRE', 'CODE'])

/**
 * Collapse whitespace so multi-line template text can hit dictionary keys written on one line.
 * @param {string} raw
 * @returns {string}
 */
export const normalizeSourceText = (raw: string): string => raw.replace(/\s+/g, ' ').trim()

/**
 * Exact-match lookup after normalization. Partial matches are intentionally rejected.
 * @param {string} raw
 * @param {Readonly<Record<string, string>>} dictionary
 * @returns {string | undefined}
 */
export const lookup = (raw: string, dictionary: Readonly<Record<string, string>>): string | undefined => {
  const normalized = normalizeSourceText(raw)
  if (!normalized) return undefined
  return dictionary[normalized]
}

/**
 * Pick the English source after a live text-node change.
 * Vue may replace the English in place; the translator may replace it with Chinese.
 * @param {string} current
 * @param {string | undefined} cached
 * @param {string | undefined} translatedCached
 * @returns {string}
 */
export const resolveLiveSourceText = (
  current: string,
  cached: string | undefined,
  translatedCached: string | undefined
): string => {
  if (cached === undefined) return current
  if (current === cached || current === translatedCached) return cached
  return current
}

/**
 * Whether the element or any ancestor opts out of runtime translation.
 * @param {Element | null} element
 * @returns {boolean}
 */
export const shouldSkipElement = (element: Element | null): boolean => {
  let current: Element | null = element
  while (current) {
    if (current.hasAttribute(NO_I18N_ATTRIBUTE)) return true
    if (SKIP_TAGS.has(current.tagName)) return true
    if (current.classList.contains('monaco-editor')) return true
    if (current.classList.contains('leaflet-tooltip')) return true
    if (current.classList.contains('leaflet-popup')) return true
    current = current.parentElement
  }
  return false
}

/**
 * Whether a text node should be considered for translation.
 * @param {Text} node
 * @returns {boolean}
 */
export const shouldTranslateTextNode = (node: Text): boolean => {
  const parent = node.parentElement
  if (!parent || shouldSkipElement(parent)) return false
  const raw = node.nodeValue ?? ''
  return normalizeSourceText(raw).length > 0
}
