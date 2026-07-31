import { enUS } from './en-US'
import { zhCN } from './zh-CN'

export const messages = {
  'en-US': enUS,
  'zh-CN': zhCN,
}

/**
 * Lists every translation leaf path in a message tree.
 * @param {Record<string, unknown>} value Translation tree to inspect.
 * @param {string} prefix Current key prefix.
 * @returns {string[]} Sorted translation leaf paths.
 */
export function translationLeafPaths(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value)
    .flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key
      return typeof child === 'string' ? [path] : translationLeafPaths(child as Record<string, unknown>, path)
    })
    .sort()
}

/**
 * Returns interpolation placeholders used by one translation message.
 * @param {string} message Translation message to inspect.
 * @returns {string[]} Sorted placeholder names.
 */
export function translationPlaceholders(message: string): string[] {
  return [...message.matchAll(/\{([\w-]+)\}/g)].map((match) => match[1]).sort()
}
