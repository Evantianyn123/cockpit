import { onMounted, onUnmounted, watch } from 'vue'

import { useLocale } from '@/composables/useLocale'
import { runtimeDictionary } from '@/i18n/dictionary'
import { lookup, shouldSkipElement, shouldTranslateTextNode, TRANSLATABLE_ATTRIBUTES } from '@/libs/i18n/dom-translator'
import { isProtectedSourceText } from '@/libs/i18n/runtime-translate'

const originalTextByNode = new WeakMap<Text, string>()
const originalAttributeByElement = new WeakMap<Element, Map<string, string>>()

const translateTextNode = (node: Text, toChinese: boolean): void => {
  if (!shouldTranslateTextNode(node)) return
  const current = node.nodeValue ?? ''
  if (!originalTextByNode.has(node)) originalTextByNode.set(node, current)
  const source = originalTextByNode.get(node) ?? current
  if (isProtectedSourceText(source)) return
  if (!toChinese) {
    node.nodeValue = source
    return
  }
  node.nodeValue = lookup(source, runtimeDictionary) ?? source
}

const translateAttributes = (root: Element, toChinese: boolean): void => {
  const elements = [root, ...Array.from(root.querySelectorAll('*'))]
  elements.forEach((element) => {
    if (shouldSkipElement(element)) return
    TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return
      const current = element.getAttribute(attribute) ?? ''
      let originals = originalAttributeByElement.get(element)
      if (!originals) {
        originals = new Map()
        originalAttributeByElement.set(element, originals)
      }
      if (!originals.has(attribute)) originals.set(attribute, current)
      const source = originals.get(attribute) ?? current
      if (isProtectedSourceText(source)) return
      if (!toChinese) {
        element.setAttribute(attribute, source)
        return
      }
      element.setAttribute(attribute, lookup(source, runtimeDictionary) ?? source)
    })
  })
}

const translateSubtree = (root: ParentNode, toChinese: boolean): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    translateTextNode(node as Text, toChinese)
    node = walker.nextNode()
  }
  if (root instanceof Element) translateAttributes(root, toChinese)
}

const translateDocument = (toChinese: boolean): void => {
  translateSubtree(document.body, toChinese)
}

/**
 * Watches locale changes and walks the live DOM to apply or revert runtime translations.
 * @returns {void}
 */
export function useDomTranslation(): void {
  const { isChinese } = useLocale()
  let observer: MutationObserver | undefined

  const apply = (): void => {
    translateDocument(isChinese.value)
  }

  onMounted(() => {
    apply()
    observer = new MutationObserver((records) => {
      if (!isChinese.value) return
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node as Text, true)
            return
          }
          if (node.nodeType === Node.ELEMENT_NODE) translateSubtree(node as Element, true)
        })
      })
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  })

  watch(isChinese, (toChinese) => {
    translateDocument(toChinese)
  })

  onUnmounted(() => {
    observer?.disconnect()
  })
}
