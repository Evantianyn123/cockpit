<template>
  <BaseConfigurationView>
    <template #title>{{ t('settings.interfaceConfiguration') }}</template>
    <template #content>
      <div class="max-h-[85vh] overflow-y-auto">
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('settings.language') }}</template>
          <template #content>
            <div class="flex flex-wrap items-center w-full gap-3 px-4 py-4">
              <v-select
                :model-value="interfaceLocale"
                :items="localeOptions"
                item-title="title"
                item-value="value"
                variant="filled"
                density="compact"
                hide-details
                class="max-w-[250px]"
                @update:model-value="setApplicationLocale"
              />
              <span class="text-xs text-slate-300 opacity-75">{{ t('settings.languageHint') }}</span>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('settings.windowMaterial') }}</template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-5">
                <div class="flex flex-row justify-start items-center w-full mb-[35px] gap-x-[85px]">
                  <div class="flex">
                    <v-menu
                      :close-on-content-click="false"
                      location="top start"
                      origin="top start"
                      transition="scale-transition"
                      class="overflow-hidden"
                    >
                      <template #activator="{ props }">
                        <div v-bind="props" class="flex cursor-pointer gap-x-[30px]">
                          <span class="text-start mt-[2px]">{{ t('settings.glassColor') }}</span>
                          <div
                            class="w-[30px] h-[30px] border-2 border-slate-600 rounded-lg cursor-pointer"
                            :style="{ backgroundColor: interfaceStore.UIGlassEffect.bgColor }"
                          ></div>
                        </div>
                      </template>
                      <v-card class="overflow-hidden"
                        ><v-color-picker
                          v-model="interfaceStore.UIGlassEffect.bgColor"
                          width="400px"
                          mode="rgba"
                          theme="dark"
                      /></v-card>
                    </v-menu>
                  </div>
                  <div class="flex gap-x-[40px] opacity-40">
                    <v-menu
                      :close-on-content-click="false"
                      location="top start"
                      origin="top start"
                      transition="scale-transition"
                      class="overflow-hidden"
                      disabled
                    >
                      <template #activator="{ props }">
                        <div v-bind="props" class="flex gap-x-[30px]">
                          <span class="text-start mt-[2px]">{{ t('settings.fontColor') }}</span>
                          <div
                            v-bind="props"
                            class="w-[30px] h-[30px] border-2 border-slate-600 rounded-lg"
                            :style="{ backgroundColor: interfaceStore.UIGlassEffect.fontColor }"
                          ></div>
                        </div>
                      </template>
                      <v-card class="overflow-hidden"
                        ><v-color-picker
                          v-model="interfaceStore.UIGlassEffect.fontColor"
                          width="400px"
                          mode="rgba"
                          theme="dark"
                      /></v-card>
                    </v-menu>
                  </div>
                  <v-btn variant="text" size="small" @click="resetColorsToDefault">{{
                    t('settings.resetToDefaults')
                  }}</v-btn>
                </div>
                <div class="flex w-full">
                  <div class="flex w-[33%] mt-[2px]">{{ t('settings.opacity') }}</div>
                  <div class="flex w-[66%]">
                    <v-slider
                      :model-value="parseInt(interfaceStore.UIGlassEffect.bgColor.slice(-2), 16) / 255"
                      color="white"
                      min="0"
                      max="1"
                      step="0.01"
                      thumb-label
                      @update:model-value="updateOpacity"
                    />
                  </div>
                </div>
                <div class="flex w-full">
                  <div class="flex w-[33%] mt-[2px]">{{ t('settings.blur') }}</div>
                  <div class="flex w-[66%]">
                    <v-slider
                      v-model="interfaceStore.UIGlassEffect.blur"
                      color="white"
                      min="0"
                      max="50"
                      step="1"
                      thumb-label
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-bottom-divider no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('settings.menu') }}</template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-5">
                <div class="flex flex-row justify-start items-center w-full mb-[35px]">
                  <div class="flex w-[33%]">{{ t('settings.mainMenuPosition') }}</div>
                  <div class="flex w-[66%]">
                    <v-radio-group v-model="interfaceStore.mainMenuStyleTrigger" inline hide-details>
                      <v-radio :label="t('settings.centerLeftTab')" value="center-left" />
                      <v-radio :label="t('settings.topBarButton')" value="burger" class="ml-6" />
                    </v-radio-group>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('settings.displayUnits') }}</template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-5">
                <div class="flex flex-row justify-start items-center w-full mb-[35px]">
                  <div class="flex w-[33%]">{{ t('settings.distance') }}</div>
                  <div class="flex w-[66%]">
                    <v-radio-group v-model="interfaceStore.displayUnitPreferences.distance" inline hide-details>
                      <v-radio
                        :label="unitPrettyName[DistanceDisplayUnit.Meters]"
                        :value="DistanceDisplayUnit.Meters"
                      />
                      <v-radio
                        :label="unitPrettyName[DistanceDisplayUnit.Feet]"
                        :value="DistanceDisplayUnit.Feet"
                        class="ml-6"
                      />
                    </v-radio-group>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { defaultUIGlassColor } from '@/assets/defaults'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { setApplicationLocale } from '@/i18n'
import { interfaceLocale } from '@/i18n/locale'
import { DistanceDisplayUnit, unitPrettyName } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const { t } = useI18n()

const localeOptions = computed(() => [
  { title: t('settings.simplifiedChinese'), value: 'zh-CN' },
  { title: t('settings.english'), value: 'en-US' },
])

const updateOpacity = (value: number): void => {
  interfaceStore.setBgOpacity(value)
}

const resetColorsToDefault = (): void => {
  interfaceStore.UIGlassEffect = defaultUIGlassColor
}
</script>
