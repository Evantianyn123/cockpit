import { createI18n } from 'vue-i18n'

import enUS from '@/i18n/messages/en-US'
import zhCN from '@/i18n/messages/zh-CN'

export const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  fallbackLocale: 'en-US',
  messages: {
    'en-US': enUS,
    'zh-CN': zhCN,
  },
})

export default i18n
