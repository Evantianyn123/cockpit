import { watch } from 'vue'

import translations from './legacy-zh-CN.json'
import { type SupportedLocale, interfaceLocale } from './locale'

type LocalizedNode = {
  /**
   * Original English text supplied by the legacy component.
   */
  original: string
  /**
   * Last localized value applied to the rendered node.
   */
  localized: string
}

const textNodeValues = new WeakMap<Text, LocalizedNode>()
const attributeValues = new WeakMap<Element, Map<string, LocalizedNode>>()
const localizableAttributes = ['aria-label', 'placeholder', 'title'] as const
const excludedElementSelector =
  'code, pre, script, style, textarea, input, select, option, [contenteditable=true], .monaco-editor, [data-cockpit-no-localize]'

const dynamicTextPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/^Channel (\d+)$/, '通道 $1'],
  [/^Joystick (\d+)$/, '摇杆 $1'],
  [/^axis (\d+)$/i, '轴 $1'],
  [/^button (\d+)$/i, '按键 $1'],
  [/^Waypoint (\d+)$/, '航点 $1'],
  [/^Param (\d+):$/, '参数 $1：'],
  [/^Step (\d+) of (\d+)$/, '第 $1 步，共 $2 步'],
  [/^(.+) controller$/, '$1 控制器'],
  [/^Button (\d+) remapped to function '(.+)'\.$/, '按键 $1 已重新映射为功能“$2”。'],
  [/^(\d+) channels enabled$/, '已启用 $1 路通道'],
  [/^Must be <= (\d+)$/, '必须小于或等于 $1'],
]

/**
 * Translates a legacy Cockpit text fragment without changing identifiers, protocol values, or user data.
 * @param {string} value Original rendered text.
 * @param {SupportedLocale} locale Active Cockpit interface locale.
 * @returns {string} Localized text fragment.
 */
export function localizeLegacyText(value: string, locale: SupportedLocale): string {
  if (locale === 'en-US') return value

  const leadingWhitespace = value.match(/^\s*/)?.[0] ?? ''
  const trailingWhitespace = value.match(/\s*$/)?.[0] ?? ''
  const content = value.trim()
  const normalizedContent = content.replace(/\s+/g, ' ')
  const translated =
    translations[content as keyof typeof translations] ??
    translations[normalizedContent as keyof typeof translations] ??
    translateDynamicText(content) ??
    translateDynamicText(normalizedContent)

  return translated === undefined ? value : `${leadingWhitespace}${translated}${trailingWhitespace}`
}

/**
 * Starts translating legacy static DOM content when the interface locale changes.
 * @returns {void}
 */
export function startLegacyLocalizer(): void {
  if (typeof document === 'undefined' || document.body === null) return

  let pending = false
  const localize = (): void => {
    pending = false
    localizeLegacyDocument(interfaceLocale.value)
  }
  const schedule = (): void => {
    if (pending) return
    pending = true
    requestAnimationFrame(localize)
  }

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  })
  watch(interfaceLocale, schedule, { flush: 'post' })
  schedule()
}

/**
 * Applies the active locale to text and accessible attributes in the rendered interface.
 * @param {SupportedLocale} locale Active Cockpit interface locale.
 * @returns {void}
 */
export function localizeLegacyDocument(locale: SupportedLocale): void {
  const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let textNode = treeWalker.nextNode() as Text | null
  while (textNode !== null) {
    localizeTextNode(textNode, locale)
    textNode = treeWalker.nextNode() as Text | null
  }

  document
    .querySelectorAll<HTMLElement>(localizableAttributes.map((attribute) => `[${attribute}]`).join(','))
    .forEach((element) => {
      if (isExcludedElement(element)) return
      localizableAttributes.forEach((attribute) => localizeAttribute(element, attribute, locale))
    })
}

/**
 * Localizes one static text node while retaining its English source for language switching.
 * @param {Text} textNode Rendered DOM text node.
 * @param {SupportedLocale} locale Active Cockpit interface locale.
 * @returns {void}
 */
function localizeTextNode(textNode: Text, locale: SupportedLocale): void {
  const parent = textNode.parentElement
  if (parent === null || isExcludedElement(parent)) return

  const savedValue = textNodeValues.get(textNode)
  const original =
    savedValue !== undefined && textNode.data === savedValue.localized ? savedValue.original : textNode.data
  const localized = localizeLegacyText(original, locale)
  if (textNode.data !== localized) textNode.data = localized
  textNodeValues.set(textNode, { original, localized })
}

/**
 * Localizes one accessible attribute while retaining its English source for language switching.
 * @param {HTMLElement} element Rendered interface element.
 * @param {(typeof localizableAttributes)[number]} attribute Attribute to localize.
 * @param {SupportedLocale} locale Active Cockpit interface locale.
 * @returns {void}
 */
function localizeAttribute(
  element: HTMLElement,
  attribute: (typeof localizableAttributes)[number],
  locale: SupportedLocale
): void {
  const value = element.getAttribute(attribute)
  if (value === null) return

  const values = attributeValues.get(element) ?? new Map<string, LocalizedNode>()
  const savedValue = values.get(attribute)
  const original = savedValue !== undefined && value === savedValue.localized ? savedValue.original : value
  const localized = localizeLegacyText(original, locale)
  if (value !== localized) element.setAttribute(attribute, localized)
  values.set(attribute, { original, localized })
  attributeValues.set(element, values)
}

/**
 * Determines whether content belongs to an editor, control, or explicitly excluded region.
 * @param {Element} element Element that owns the candidate text or attribute.
 * @returns {boolean} True when the element must retain its original text.
 */
function isExcludedElement(element: Element): boolean {
  return element.closest(excludedElementSelector) !== null
}

/**
 * Translates predictable legacy labels that include a runtime number.
 * @param {string} value Original rendered label.
 * @returns {string | undefined} Chinese label when a supported pattern matches.
 */
function translateDynamicText(value: string): string | undefined {
  for (const [pattern, replacement] of dynamicTextPatterns) {
    if (pattern.test(value)) return value.replace(pattern, replacement)
  }
  return undefined
}
