import { describe, expect, test } from 'vitest'

import { runtimeDictionary } from '@/i18n/dictionary'
import {
  lookup,
  NO_I18N_ATTRIBUTE,
  normalizeSourceText,
  shouldSkipElement,
  shouldTranslateTextNode,
  TRANSLATABLE_ATTRIBUTES,
} from '@/libs/i18n/dom-translator'

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
