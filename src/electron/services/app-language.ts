import { ipcMain } from 'electron'

import { isApplicationLocale } from '../../types/app-language'
import store from './config-store'

/**
 * Registers the persisted desktop-language mirror IPC endpoint.
 * @returns {void}
 */
export function setupAppLanguageService(): void {
  ipcMain.handle('app-language-set', (_event, locale: unknown): boolean => {
    if (!isApplicationLocale(locale)) return false
    store.set('appLanguage', locale)
    return true
  })
}
