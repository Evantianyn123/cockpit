import { describe, expect, test } from 'vitest'

import { runtimeDictionary } from '@/i18n/dictionary'
import {
  lookup,
  NO_I18N_ATTRIBUTE,
  normalizeSourceText,
  resolveLiveSourceText,
  shouldSkipElement,
  shouldTranslateTextNode,
  TRANSLATABLE_ATTRIBUTES,
} from '@/libs/i18n/dom-translator'
import { isProtectedSourceText } from '@/libs/i18n/runtime-translate'

describe('normalizeSourceText', () => {
  test('collapses whitespace and trims', () => {
    expect(normalizeSourceText('  Hello   world \n ')).toBe('Hello world')
  })
})

describe('lookup', () => {
  test('matches only after normalization', () => {
    const dictionary = { Settings: '设置' }
    expect(lookup('  Settings  ', dictionary)).toBe('设置')
    expect(lookup('Setting', dictionary)).toBeUndefined()
  })
})

describe('shouldSkipElement', () => {
  test('skips marked subtrees and form controls', () => {
    document.body.innerHTML = `
      <div ${NO_I18N_ATTRIBUTE}>
        <p id="user-view">Video</p>
      </div>
      <input id="native-input" value="Video" />
      <div class="monaco-editor"><span>ignored</span></div>
      <p id="plain">Settings</p>
    `
    expect(shouldSkipElement(document.getElementById('user-view'))).toBe(true)
    expect(shouldSkipElement(document.getElementById('native-input'))).toBe(true)
    expect(shouldSkipElement(document.querySelector('.monaco-editor'))).toBe(true)
    expect(shouldSkipElement(document.getElementById('plain'))).toBe(false)
  })
})

describe('shouldTranslateTextNode', () => {
  test('ignores empty text and skipped parents', () => {
    document.body.innerHTML = `<div ${NO_I18N_ATTRIBUTE}><p>Video</p></div>`
    const node = document.querySelector('p')?.firstChild as Text
    expect(shouldTranslateTextNode(node)).toBe(false)
  })
})

describe('runtime collision safety', () => {
  test('user view named Video inside opt-out is not translated by dictionary', () => {
    document.body.innerHTML = `<p ${NO_I18N_ATTRIBUTE}>Video</p>`
    const node = document.querySelector('p')?.firstChild as Text
    expect(runtimeDictionary.Video).toBe('视频')
    expect(shouldTranslateTextNode(node)).toBe(false)
    expect(node.nodeValue).toBe('Video')
  })

  test('dictionary maps Settings to Chinese', () => {
    expect(runtimeDictionary.Settings).toBe('设置')
  })
})

describe('TRANSLATABLE_ATTRIBUTES', () => {
  test('limits attribute translation surface', () => {
    expect(TRANSLATABLE_ATTRIBUTES).toEqual(['placeholder', 'title', 'aria-label'])
  })
})

describe('isProtectedSourceText', () => {
  test('skips brand names only when they are the entire string', () => {
    expect(isProtectedSourceText('Cockpit')).toBe(true)
    expect(isProtectedSourceText('MAVLink')).toBe(true)
    expect(isProtectedSourceText('MAVLink2REST')).toBe(true)
    expect(isProtectedSourceText('Manage Cockpit settings')).toBe(false)
    expect(isProtectedSourceText('Cockpit folder location:')).toBe(false)
    expect(isProtectedSourceText('MAVLink2REST URI')).toBe(false)
  })
})

describe('resolveLiveSourceText', () => {
  test('keeps cached English when the node already shows the translation', () => {
    expect(resolveLiveSourceText('下一步', 'Next', '下一步')).toBe('Next')
  })

  test('adopts Vue in-place English replacements', () => {
    expect(resolveLiveSourceText('Next', 'Start', '开始')).toBe('Next')
  })
})

describe('brand-containing dictionary entries', () => {
  test('translates whole sentences while keeping brand tokens', () => {
    expect(lookup('Manage Cockpit settings', runtimeDictionary)).toBe('管理 Cockpit 设置')
    expect(lookup('Cockpit folder location:', runtimeDictionary)).toBe('Cockpit 文件夹位置：')
    expect(lookup('MAVLink2REST URI', runtimeDictionary)).toBe('MAVLink2REST 地址')
    expect(lookup('Welcome to Cockpit!', runtimeDictionary)).toBe('欢迎使用 Cockpit！')
    expect(
      lookup("Cockpit connects to a vehicle's network using a global address.", runtimeDictionary)
    ).toBe('Cockpit 通过全局地址连接到载具网络。')
  })

  test('matches multiline tutorial copy after normalization', () => {
    const raw = `This is usually found automatically, but if necessary you can specify a custom domain to connect
      to and search for the relevant vehicle components.`
    expect(lookup(raw, runtimeDictionary)).toBe(
      '通常会自动发现；如有需要，也可以指定自定义域名来连接并搜索相关载具组件。'
    )
  })
})
