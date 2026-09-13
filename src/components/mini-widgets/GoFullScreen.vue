<template>
  <div>
    <v-tooltip :text="fullScreenTooltip" location="bottom">
      <template #activator="{ props: tooltipProps }">
        <div v-bind="tooltipProps" class="relative cursor-pointer" @click="toggleFullScreen">
          <FontAwesomeIcon :icon="fullScreenToggleIcon" size="xl text-white" />
        </div>
      </template>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import { computed } from 'vue'

import { translateRuntimeText } from '@/libs/i18n/runtime-translate'

const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

const fullScreenToggleIcon = computed(() => (isFullscreen.value ? 'fa-solid fa-compress' : 'fa-solid fa-expand'))
const isFullScreen = computed(() => isFullscreen.value)
const fullScreenTooltip = computed(() =>
  translateRuntimeText(isFullScreen.value ? 'Exit full screen' : 'Go full screen')
)

const toggleFullScreen = (): void => {
  logUserAction(`${isFullscreen.value ? 'Exited' : 'Entered'} fullscreen via mini-widget`)
  toggleFullscreen()
}
</script>
