<template>
  <div class="flex items-center justify-center m-2 text-sm font-bold text-center text-white select-none min-w-[90px]">
    {{ format(timeNow, dateFormat, { locale: dateLocale }) }}
  </div>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { format } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import { computed } from 'vue'

import { interfaceLocale } from '@/i18n/locale'

const timeNow = useTimestamp({ interval: 1000 })
const dateFormat = computed(() => (interfaceLocale.value === 'zh-CN' ? 'yyyy年M月d日 HH:mm' : 'EEE LLL do HH:mm'))
const dateLocale = computed(() => (interfaceLocale.value === 'zh-CN' ? zhCN : enUS))
</script>
