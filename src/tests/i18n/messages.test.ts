import { afterEach, describe, expect, test } from 'vitest'

import { localizeLegacyDocument, localizeLegacyText } from '@/i18n/legacy-localizer'
import {
  DEFAULT_INTERFACE_LOCALE,
  INTERFACE_LANGUAGE_STORAGE_KEY,
  readStoredLocale,
  resolveLocale,
} from '@/i18n/locale'
import { translationLeafPaths, translationPlaceholders } from '@/i18n/messages'
import { enUS } from '@/i18n/messages/en-US'
import { zhCN } from '@/i18n/messages/zh-CN'

const originalStoredLocale = localStorage.getItem(INTERFACE_LANGUAGE_STORAGE_KEY)

/**
 * Resolves one nested translation leaf by dotted path.
 * @param {Record<string, unknown>} messages Translation tree.
 * @param {string} path Dotted translation path.
 * @returns {string} Translation leaf value.
 */
function messageAt(messages: Record<string, unknown>, path: string): string {
  return path
    .split('.')
    .reduce<unknown>((current, key) => (current as Record<string, unknown>)[key], messages) as string
}

afterEach(() => {
  if (originalStoredLocale === null) localStorage.removeItem(INTERFACE_LANGUAGE_STORAGE_KEY)
  else localStorage.setItem(INTERFACE_LANGUAGE_STORAGE_KEY, originalStoredLocale)
  document.body.innerHTML = ''
})

describe('Cockpit interface language', () => {
  test('defaults invalid or missing values to simplified Chinese', () => {
    localStorage.removeItem(INTERFACE_LANGUAGE_STORAGE_KEY)
    expect(readStoredLocale()).toBe(DEFAULT_INTERFACE_LOCALE)
    expect(resolveLocale('en-US')).toBe('en-US')
    expect(resolveLocale('zh-CN')).toBe('zh-CN')
    expect(resolveLocale('fr-FR')).toBe(DEFAULT_INTERFACE_LOCALE)
  })

  test('uses a valid persisted language preference', () => {
    localStorage.setItem(INTERFACE_LANGUAGE_STORAGE_KEY, 'en-US')
    expect(readStoredLocale()).toBe('en-US')
  })

  test('keeps Chinese and English translation keys and placeholders aligned', () => {
    const englishPaths = translationLeafPaths(enUS)
    const chinesePaths = translationLeafPaths(zhCN)

    expect(chinesePaths).toEqual(englishPaths)
    englishPaths.forEach((path) => {
      expect(messageAt(enUS, path)).not.toBe('')
      expect(messageAt(zhCN, path)).not.toBe('')
      expect(translationPlaceholders(messageAt(zhCN, path))).toEqual(translationPlaceholders(messageAt(enUS, path)))
    })
  })

  test('translates legacy interface text while preserving English mode', () => {
    expect(localizeLegacyText('Video configuration', 'zh-CN')).toBe('视频设置')
    expect(localizeLegacyText('Channel 8', 'zh-CN')).toBe('通道 8')
    expect(localizeLegacyText('axis 0', 'zh-CN')).toBe('轴 0')
    expect(localizeLegacyText('button 2', 'zh-CN')).toBe('按键 2')
    expect(localizeLegacyText('Waypoint 3', 'zh-CN')).toBe('航点 3')
    expect(localizeLegacyText('Step 2 of 4', 'zh-CN')).toBe('第 2 步，共 4 步')
    expect(localizeLegacyText('Video\n configuration', 'zh-CN')).toBe('视频设置')
    expect(localizeLegacyText('MAVLink2REST URI', 'zh-CN')).toBe('MAVLink2REST URI')
    expect(localizeLegacyText('Video configuration', 'en-US')).toBe('Video configuration')
  })

  test('does not translate user-authored labels that match interface text', () => {
    document.body.innerHTML = '<p>Map</p><p data-cockpit-no-localize>Map</p>'

    localizeLegacyDocument('zh-CN')

    expect(document.body.children[0].textContent).toBe('地图')
    expect(document.body.children[1].textContent).toBe('Map')
  })
})
