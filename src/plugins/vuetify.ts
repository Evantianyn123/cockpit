// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { en, zhHans } from 'vuetify/locale'

const vuetify = createVuetify({
  locale: {
    locale: 'en',
    fallback: 'en',
    messages: { en, 'zh-Hans': zhHans },
  },
})

export default vuetify
