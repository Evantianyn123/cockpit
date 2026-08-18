<template>
  <BaseConfigurationView>
    <template #title>{{ t('generalConfiguration.title') }}</template>
    <template #content>
      <div
        class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px]"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw] max-h-[90vh]' : 'max-w-[650px] max-h-[85vh]'"
      >
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('generalConfiguration.userSettings') }}</template>
          <template #info>
            <p class="w-full">
              {{ t('generalConfiguration.userSettingsDescription') }}
              <br />
              <br />
              <span class="font-semibold">{{ t('generalConfiguration.pirateMode') }}</span>
              {{ t('generalConfiguration.pirateModeDescription') }}
            </p>
          </template>
          <template #content>
            <div class="flex flex-col w-full items-start">
              <div class="flex align-center w-full justify-between pr-2 mt-1 mb-3">
                <div>
                  <span class="mr-2">{{ t('generalConfiguration.currentUser') }}</span>
                  <span class="font-semibold text-2xl cursor-pointer" @click="manageUsers">{{
                    missionStore.username
                  }}</span>
                </div>
                <div class="flex justify-end">
                  <v-btn
                    id="select-profile"
                    size="small"
                    append-icon="mdi-account"
                    class="bg-[#FFFFFF22] shadow-2 -mr-2"
                    variant="flat"
                    @click="manageUsers"
                    >{{ t('generalConfiguration.manageUsers') }}</v-btn
                  >
                </div>
              </div>
              <v-divider class="w-full opacity-[0.08]" />
              <div class="flex flex-row w-full items-center justify-between py-3 gap-x-2 gap-y-3 flex-wrap">
                <v-btn size="x-small" class="bg-[#FFFFFF22] shadow-1" variant="flat" @click="openTutorial">
                  {{ t('generalConfiguration.showTutorial') }}
                </v-btn>
                <v-btn size="x-small" class="bg-[#FFFFFF22] shadow-1" variant="flat" @click="openCockpitSettingsDialog">
                  {{ t('generalConfiguration.manageCockpitSettings') }}
                </v-btn>
                <v-btn size="x-small" class="bg-[#FFFFFF22] shadow-1" variant="flat" @click="togglePirateMode">
                  {{
                    t(
                      interfaceStore.pirateMode
                        ? 'generalConfiguration.disablePirateMode'
                        : 'generalConfiguration.enablePirateMode'
                    )
                  }}
                </v-btn>
                <v-btn size="x-small" class="bg-[#FFFFFF22] shadow-1" variant="flat" @click="openExternalFeaturesModal">
                  {{ t('generalConfiguration.extensionFeatures') }}
                </v-btn>
                <v-btn
                  size="x-small"
                  class="bg-[#FFFFFF22] shadow-1"
                  variant="flat"
                  prepend-icon="mdi-shield-lock-outline"
                  @click="openDataPrivacyModal"
                >
                  {{ t('generalConfiguration.sharedData') }}
                </v-btn>
              </div>
              <v-divider v-if="isElectron()" class="w-full opacity-[0.08]" />
              <div v-if="isElectron()" class="flex flex-col w-full py-4 gap-1">
                <span class="text-md mb-1 text-slate-200">{{ t('generalConfiguration.folderLocation') }}</span>
                <div class="flex items-center gap-6">
                  <v-tooltip
                    :text="cockpitFolderPath"
                    :disabled="cockpitFolderPath !== defaultCockpitFolderPath"
                    location="bottom"
                    open-delay="300"
                  >
                    <template #activator="{ props: tooltipProps }">
                      <v-text-field
                        v-bind="tooltipProps"
                        :model-value="cockpitFolderPath"
                        variant="filled"
                        density="compact"
                        hide-details
                        readonly
                        class="cursor-pointer"
                        @click="browseCockpitFolder"
                      >
                        <template #append-inner>
                          <v-icon
                            v-if="cockpitFolderPath !== defaultCockpitFolderPath"
                            v-tooltip.bottom="t('generalConfiguration.resetDefaultFolder')"
                            color="white"
                            @click.stop="resetCockpitFolderPath"
                          >
                            mdi-restore
                          </v-icon>
                        </template>
                      </v-text-field>
                    </template>
                  </v-tooltip>
                  <v-btn
                    size="small"
                    append-icon="mdi-folder-open-outline"
                    class="bg-[#FFFFFF22] shadow-2"
                    variant="flat"
                    @click="openCockpitFolder"
                  >
                    {{ t('generalConfiguration.openFolder') }}
                  </v-btn>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>

        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('generalConfiguration.vehicleNetworkConnection') }}</template>
          <template #subtitle>{{
            t('generalConfiguration.currentAddress', { address: mainVehicleStore.globalAddress })
          }}</template>
          <template #info>{{ t('generalConfiguration.vehicleNetworkDescription') }}</template>
          <template #content>
            <v-btn
              v-if="isElectron()"
              size="x-small"
              class="bg-[#FFFFFF22] mt-3 mb-2 shadow-2"
              variant="flat"
              @click="openVehicleDiscoveryDialog"
            >
              {{ t('generalConfiguration.searchForVehicles') }}
            </v-btn>
            <v-form
              ref="globalAddressForm"
              v-model="globalAddressFormValid"
              class="flex w-full mt-2 mb-2"
              @submit.prevent="setGlobalAddress"
            >
              <div
                class="flex justify-start items-center w-[86%] mb-4"
                :class="interfaceStore.isOnSmallScreen ? 'scale-80' : 'scale-100'"
                :style="
                  interfaceStore.highlightedComponent === 'vehicle-address' && {
                    animation: 'highlightBackground 0.5s alternate 20',
                    borderRadius: '10px',
                  }
                "
              >
                <v-text-field
                  v-model="newGlobalAddress"
                  variant="filled"
                  type="input"
                  density="compact"
                  :hint="t('generalConfiguration.addressHint')"
                  hide-details
                  class="w-[80%]"
                  :rules="[isValidHostAddress, isValidConnectionURI]"
                  @click:append-inner="resetGlobalAddress"
                >
                  <template #append-inner>
                    <v-icon
                      v-tooltip.bottom="t('generalConfiguration.resetGlobalAddress')"
                      color="white"
                      @click="resetGlobalAddress"
                    >
                      mdi-restore
                    </v-icon>
                  </template>
                </v-text-field>
                <v-btn
                  :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                  :disabled="!globalAddressFormValid"
                  class="bg-transparent"
                  :class="interfaceStore.isOnSmallScreen ? 'ml-1' : 'ml-5'"
                  variant="text"
                  type="submit"
                >
                  {{ t('common.apply') }}
                </v-btn>
              </div>
            </v-form>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('generalConfiguration.mavlink2RestUri') }}</template>
          <template #subtitle>
            {{
              t('generalConfiguration.currentAddress', {
                address: ConnectionManager.mainConnection()?.uri().toString() ?? t('generalConfiguration.none'),
              })
            }}<br />
            {{ t('generalConfiguration.status') }}
            {{
              vehicleConnected
                ? t('common.connected')
                : vehicleConnected === undefined
                ? t('common.connecting')
                : t('generalConfiguration.connectionFailed')
            }}
          </template>
          <template #content>
            <v-progress-circular v-if="vehicleConnected === undefined" indeterminate size="24" class="mr-3" />
            <v-form
              ref="mainConnectionForm"
              v-model="mainConnectionFormValid"
              class="flex w-full mt-2"
              @submit.prevent="setMainVehicleConnectionURI"
            >
              <div class="flex flex-row w-full justify-start gap-x-8 align-center">
                <div
                  class="flex justify-start items-center"
                  :class="interfaceStore.isOnSmallScreen ? 'scale-80 w-[80%]' : 'scale-100 w-[76%]'"
                >
                  <v-text-field
                    v-model="mavlink2RestWebsocketURI"
                    :disabled="!mainVehicleStore.customMAVLink2RestWebsocketURI.enabled"
                    variant="filled"
                    type="input"
                    density="compact"
                    :hint="t('generalConfiguration.mavlink2RestUriHint')"
                    :rules="[isValidSocketConnectionURI]"
                  >
                    <template #append-inner>
                      <v-icon
                        v-tooltip.bottom="t('generalConfiguration.resetDefault')"
                        color="white"
                        :disabled="!mainVehicleStore.customMAVLink2RestWebsocketURI.enabled"
                        @click="resetMainVehicleConnectionURI"
                      >
                        mdi-restore
                      </v-icon>
                    </template>
                  </v-text-field>
                </div>
                <v-btn
                  :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                  class="bg-transparent -mt-5 -ml-6"
                  :disabled="!mainVehicleStore.customMAVLink2RestWebsocketURI.enabled"
                  variant="text"
                  type="submit"
                >
                  {{ t('common.apply') }}
                </v-btn>
              </div>
              <div class="flex justify-end mt-6">
                <div
                  class="flex flex-col align-end text-[10px]"
                  :class="interfaceStore.isOnSmallScreen ? '-mt-3' : '-mt-5'"
                >
                  <v-switch
                    v-model="mainVehicleStore.customMAVLink2RestWebsocketURI.enabled"
                    v-tooltip.bottom="t('generalConfiguration.enableCustom')"
                    class="-mt-5 bg-transparent mr-1 mb-[7px]"
                    density="compact"
                    hide-details
                  />
                  <div class="-mt-[4px]">
                    {{
                      mainVehicleStore.customMAVLink2RestWebsocketURI.enabled
                        ? t('common.enabled')
                        : t('common.disabled')
                    }}
                  </div>
                </div>
              </div>
            </v-form>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('generalConfiguration.videoConnection') }}</template>
          <template #subtitle>{{
            t('generalConfiguration.currentAddress', {
              address: mainVehicleStore.webRTCSignallingURI?.toString() ?? '',
            })
          }}</template>
          <template #content>
            <v-form
              ref="webRTCSignallingForm"
              v-model="webRTCSignallingFormValid"
              class="justify-center d-flex align-center mt-2"
              @submit.prevent="setWebRTCSignallingURI"
            >
              <div class="flex flex-row w-full justify-start gap-x-8 align-center">
                <div
                  class="flex justify-start items-center"
                  :class="interfaceStore.isOnSmallScreen ? 'scale-80 w-[80%]' : 'scale-100 w-[76%]'"
                >
                  <v-text-field
                    v-model="webRTCSignallingURI"
                    :disabled="!mainVehicleStore.customWebRTCSignallingURI.enabled"
                    variant="filled"
                    type="input"
                    density="compact"
                    :hint="t('generalConfiguration.webRtcUriHint')"
                    :rules="[isValidSocketConnectionURI]"
                  >
                    <template #append-inner>
                      <v-icon
                        v-tooltip.bottom="t('generalConfiguration.resetDefault')"
                        color="white"
                        :disabled="!mainVehicleStore.customWebRTCSignallingURI.enabled"
                        @click="resetWebRTCSignallingURI"
                      >
                        mdi-restore
                      </v-icon>
                    </template>
                  </v-text-field>
                </div>
                <v-btn
                  :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                  :disabled="!mainVehicleStore.customWebRTCSignallingURI.enabled || !webRTCSignallingFormValid"
                  class="bg-transparent -mt-5 -ml-6"
                  variant="text"
                  type="submit"
                >
                  {{ t('common.apply') }}
                </v-btn>
              </div>
              <div>
                <div
                  class="flex flex-col align-end text-[10px]"
                  :class="interfaceStore.isOnSmallScreen ? '-mt-3' : '-mt-5'"
                >
                  <v-switch
                    v-model="mainVehicleStore.customWebRTCSignallingURI.enabled"
                    v-tooltip.bottom="t('generalConfiguration.enableCustom')"
                    class="-mt-5 bg-transparent mr-1 mb-[7px]"
                    density="compact"
                    hide-details
                  />
                  <div class="-mt-[4px]">
                    {{
                      mainVehicleStore.customWebRTCSignallingURI.enabled ? t('common.enabled') : t('common.disabled')
                    }}
                  </div>
                </div>
              </div>
            </v-form>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('generalConfiguration.customWebRtcConfiguration') }}</template>
          <template #content>
            <div class="flex justify-between mt-2 w-full">
              <v-textarea
                id="rtcConfigTextInput"
                v-model="customRtcConfiguration"
                :disabled="!mainVehicleStore.customWebRTCConfiguration.enabled"
                variant="outlined"
                :label="t('generalConfiguration.customWebRtcLabel')"
                :rows="6"
                hint="e.g.: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }"
                class="w-full"
              />
              <div class="flex flex-col justify-around align-center w-[100px] -mr-6">
                <v-btn
                  :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                  :disabled="!mainVehicleStore.customWebRTCConfiguration.enabled"
                  class="bg-transparent -mb-5"
                  variant="text"
                  type="submit"
                  @click="handleCustomRtcConfiguration"
                >
                  {{ t('common.apply') }}
                </v-btn>

                <div class="flex flex-col align-end text-[10px] -mt-8">
                  <v-switch
                    v-model="mainVehicleStore.customWebRTCConfiguration.enabled"
                    v-tooltip.bottom="t('generalConfiguration.enableCustom')"
                    class="-mt-5 bg-transparent"
                    rounded="lg"
                    hide-details
                  />
                  <div class="-mt-[4px]">
                    {{
                      mainVehicleStore.customWebRTCConfiguration.enabled ? t('common.enabled') : t('common.disabled')
                    }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('generalConfiguration.genericWebSocketConnections') }}</template>
          <template #info>
            <div class="w-full">
              <p>{{ t('generalConfiguration.genericConnectionDescription') }}</p>
              <ul class="list-disc list-inside mt-2">
                <li>
                  {{ t('generalConfiguration.genericConnectionFormat') }}
                </li>
                <li>
                  {{ t('generalConfiguration.genericConnectionUrlExample') }}
                  <span class="font-mono">{{ exampleGenericWebSocketUrl }}</span>
                </li>
              </ul>
            </div>
          </template>
          <template #content>
            <div class="flex flex-col w-full mt-2 pb-8">
              <!-- Existing connections list -->
              <div v-if="Object.keys(genericWebSocketConnections).length > 0" class="mb-4">
                <div
                  v-for="(conn, url) in genericWebSocketConnections"
                  :key="url"
                  class="flex items-center justify-between py-2 px-3 mb-2 rounded bg-[#FFFFFF11]"
                >
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <v-icon :color="getLoadingStatusColor(conn.status)" size="small">
                      {{ getLoadingStatusIcon(conn.status) }}
                    </v-icon>
                    <span class="truncate text-sm" :title="url">{{ replaceDataLakeInputsInString(url) }}</span>
                    <span class="text-xs opacity-60">({{ t(`common.${conn.status}`) }})</span>
                  </div>
                  <v-btn icon="mdi-close" size="x-small" variant="text" @click="removeGenericWebSocket(url)" />
                </div>
              </div>
              <div v-else class="text-sm opacity-60 mb-4">{{ t('generalConfiguration.noConnectionsConfigured') }}</div>

              <!-- Add new connection -->
              <div class="flex justify-start items-center">
                <v-text-field
                  v-model="newGenericWebSocketUrl"
                  variant="outlined"
                  type="input"
                  density="compact"
                  :hint="exampleGenericWebSocketUrl"
                  hide-details
                  @keyup.enter="addGenericWebSocket"
                />
                <v-btn
                  :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                  :disabled="!newGenericWebSocketUrl.trim()"
                  class="bg-transparent"
                  :class="interfaceStore.isOnSmallScreen ? 'ml-1' : 'ml-5'"
                  variant="text"
                  @click="addGenericWebSocket"
                >
                  {{ t('generalConfiguration.addConnection') }}
                </v-btn>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ t('generalConfiguration.vehicleConnectionTimeouts') }}</template>
          <template #info>
            <p class="w-full">{{ t('generalConfiguration.heartbeatTimeoutDescription') }}</p>
            <br />
            <p class="w-full">{{ t('generalConfiguration.watchdogTimeoutDescription') }}</p>
          </template>
          <template #content>
            <div
              class="grid w-full mt-2 pb-2 gap-12"
              :class="interfaceStore.isOnPhoneScreen ? 'grid-cols-1' : 'grid-cols-2'"
            >
              <div class="min-w-0">
                <div class="mb-1 text-sm">{{ t('generalConfiguration.heartbeatTimeout') }}</div>
                <v-form
                  ref="connectionTimeoutForm"
                  v-model="connectionTimeoutFormValid"
                  class="w-full"
                  @submit.prevent="setConnectionTimeout"
                >
                  <div class="flex items-start gap-2">
                    <v-text-field
                      v-model.number="newVehicleConnectionTimeoutSeconds"
                      variant="filled"
                      type="number"
                      density="compact"
                      theme="dark"
                      class="flex-1"
                      suffix="s"
                      :rules="[isValidConnectionTimeout]"
                    >
                      <template #append-inner>
                        <v-icon
                          v-tooltip.bottom="t('generalConfiguration.resetDefault')"
                          color="white"
                          @click="resetConnectionTimeout"
                        >
                          mdi-restore
                        </v-icon>
                      </template>
                    </v-text-field>
                    <v-btn
                      :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                      :disabled="!connectionTimeoutFormValid"
                      class="bg-transparent mt-1"
                      variant="text"
                      type="submit"
                    >
                      {{ t('common.apply') }}
                    </v-btn>
                  </div>
                </v-form>
              </div>
              <div class="min-w-0">
                <div class="mb-1 text-sm">{{ t('generalConfiguration.watchdogTimeout') }}</div>
                <v-form
                  ref="watchdogTimeoutForm"
                  v-model="watchdogTimeoutFormValid"
                  class="w-full"
                  @submit.prevent="setWatchdogTimeout"
                >
                  <div class="flex items-start gap-2">
                    <v-text-field
                      v-model.number="newVehicleConnectionWatchdogTimeoutSeconds"
                      variant="filled"
                      type="number"
                      density="compact"
                      theme="dark"
                      class="flex-1"
                      suffix="s"
                      :rules="[isValidWatchdogTimeout]"
                    >
                      <template #append-inner>
                        <v-icon
                          v-tooltip.bottom="t('generalConfiguration.resetDefault')"
                          color="white"
                          @click="resetWatchdogTimeout"
                        >
                          mdi-restore
                        </v-icon>
                      </template>
                    </v-text-field>
                    <v-btn
                      :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                      :disabled="!watchdogTimeoutFormValid"
                      class="bg-transparent mt-1"
                      variant="text"
                      type="submit"
                    >
                      {{ t('common.apply') }}
                    </v-btn>
                  </div>
                </v-form>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
  <VehicleDiscoveryDialog v-model="showDiscoveryDialog" />
  <ManageCockpitSettings v-model:openConfigDialog="showCockpitSettingsDialog" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { defaultGlobalAddress } from '@/assets/defaults'
import ManageCockpitSettings from '@/components/configuration/CockpitSettingsManager.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import VehicleDiscoveryDialog from '@/components/VehicleDiscoveryDialog.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import {
  addGenericWebSocketConnection,
  GenericWebSocketConnection,
  listenToGenericWebSocketConnections,
  removeGenericWebSocketConnection,
} from '@/libs/generic-websocket'
import { isElectron, isValidNetworkAddress } from '@/libs/utils'
import { getLoadingStatusColor, getLoadingStatusIcon } from '@/libs/utils/ui'
import { replaceDataLakeInputsInString } from '@/libs/utils-data-lake'
import { reloadCockpitAndWarnUser } from '@/libs/utils-vue'
import * as Protocol from '@/libs/vehicle/protocol/protocol'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

import BaseConfigurationView from './BaseConfigurationView.vue'

const mainVehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()
const { t } = useI18n()
const { openSnackbar } = useSnackbar()
const { showDialog, closeDialog } = useInteractionDialog()

const globalAddressForm = ref()
const globalAddressFormValid = ref(false)
const newGlobalAddress = ref(mainVehicleStore.globalAddress)
const showCockpitSettingsDialog = ref(false)

const cockpitFolderPath = ref('')
const defaultCockpitFolderPath = ref('')

const loadCockpitFolderPath = async (): Promise<void> => {
  if (!isElectron() || !window.electronAPI) return
  cockpitFolderPath.value = await window.electronAPI.getCockpitFolderPath()
  defaultCockpitFolderPath.value = await window.electronAPI.getDefaultCockpitFolderPath()
}

const applyFolderPath = async (path: string): Promise<void> => {
  if (!window.electronAPI) return
  await window.electronAPI.setCockpitFolderPath(path)
  cockpitFolderPath.value = path
}

const browseCockpitFolder = async (): Promise<void> => {
  if (!window.electronAPI) return
  logUserAction('Browsed for a custom Cockpit folder')
  const selected = await window.electronAPI.selectCockpitFolder()
  if (!selected) return

  const folderName = selected.split(/[/\\]/).filter(Boolean).pop()
  if (folderName === 'Cockpit') {
    await applyFolderPath(selected)
    return
  }

  const selectedName = selected.split(/[/\\]/).filter(Boolean).pop() ?? ''
  showDialog({
    title: 'Cockpit folder location',
    message:
      `The selected folder is not named "Cockpit". Would you like to use ` +
      `${selected} directly, or create and use a Cockpit subfolder inside it?`,
    variant: 'info',
    persistent: true,
    maxWidth: 700,
    actions: [
      { text: 'Cancel', size: 'small', action: () => closeDialog() },
      {
        text: `Use ${selectedName}`,
        size: 'small',
        action: () => {
          closeDialog()
          applyFolderPath(selected)
        },
      },
      {
        text: `Use ${selectedName}/Cockpit`,
        size: 'small',
        action: () => {
          closeDialog()
          applyFolderPath(`${selected}/Cockpit`)
        },
      },
    ],
  })
}

const resetCockpitFolderPath = async (): Promise<void> => {
  if (!window.electronAPI) return
  logUserAction('Reset Cockpit folder path to default')
  await window.electronAPI.setCockpitFolderPath(defaultCockpitFolderPath.value)
  cockpitFolderPath.value = defaultCockpitFolderPath.value
}

const setGlobalAddress = async (): Promise<void> => {
  await globalAddressForm.value.validate()

  const validation = isValidConnectionURI(newGlobalAddress.value)
  if (validation !== true) {
    alert(validation)
    return
  }

  logUserAction(`Set vehicle global address to '${newGlobalAddress.value}'`)
  mainVehicleStore.globalAddress = newGlobalAddress.value

  // Temporary solution to actually set the address and connect the vehicle, since this is non-reactive today.
  // TODO: Modify the store variables to be reactive.
  reloadCockpitAndWarnUser()
}

const resetGlobalAddress = async (): Promise<void> => {
  newGlobalAddress.value = defaultGlobalAddress

  await setGlobalAddress()
}

const handleCustomRtcConfiguration = (): void => {
  logUserAction(
    `${mainVehicleStore.customWebRTCConfiguration.enabled ? 'Enabled' : 'Disabled'} custom WebRTC configuration`
  )
  if (mainVehicleStore.customWebRTCConfiguration.enabled) {
    updateWebRtcConfiguration()
  }
}

/** Main vehicle connection */

const vehicleConnected = ref<boolean | undefined>(mainVehicleStore.isVehicleOnline)
watch(
  () => mainVehicleStore.isVehicleOnline,
  () => (vehicleConnected.value = mainVehicleStore.isVehicleOnline)
)

const mainConnectionForm = ref()
const mainConnectionFormValid = ref(false)
const mavlink2RestWebsocketURI = ref(mainVehicleStore.MAVLink2RestWebsocketURI)

const addNewVehicleConnection = async (conn: Connection.URI): Promise<void> => {
  mavlink2RestWebsocketURI.value = conn
  vehicleConnected.value = undefined
  setTimeout(() => (vehicleConnected.value ??= false), 5000)
  try {
    ConnectionManager.addConnection(new Connection.URI(conn), Protocol.Type.MAVLink, {
      websocket: { getWatchdogTimeoutMs: () => mainVehicleStore.vehicleConnectionWatchdogTimeoutMs },
    })
  } catch (error) {
    console.error(error)
    alert(`Could not update main connection. ${error}.`)
    return
  }
  console.debug(`New connection successfully configured to ${conn.toString()}.`)
}

watch(
  () => mainVehicleStore.MAVLink2RestWebsocketURI,
  (val: Connection.URI) => {
    if (val.toString() === mavlink2RestWebsocketURI.value.toString()) {
      return
    }

    addNewVehicleConnection(val)
  }
)

const setMainVehicleConnectionURI = async (): Promise<void> => {
  const res = await mainConnectionForm.value.validate()

  if (!res.valid) {
    return
  }

  logUserAction(`Set custom main vehicle connection URI to '${mavlink2RestWebsocketURI.value.toString()}'`)
  mainVehicleStore.customMAVLink2RestWebsocketURI = {
    data: mavlink2RestWebsocketURI.value.toString(),
    enabled: true,
  }

  addNewVehicleConnection(mavlink2RestWebsocketURI.value)
}

const resetMainVehicleConnectionURI = async (): Promise<void> => {
  logUserAction('Reset main vehicle connection URI to default')
  mainVehicleStore.customMAVLink2RestWebsocketURI = {
    enabled: false,
    data: mainVehicleStore.defaultMAVLink2RestWebsocketURI.toString(),
  }
}

const webRTCSignallingForm = ref()
const webRTCSignallingFormValid = ref(false)
const webRTCSignallingURI = ref(mainVehicleStore.webRTCSignallingURI)

const addWebRTCConnection = async (conn: Connection.URI): Promise<void> => {
  webRTCSignallingURI.value = conn

  // This works as a reset for the custom URI, and its not needed in MAVLink2RestWebsocketURI since on Add from
  // ConnectionManager it will be set.
  if (!mainVehicleStore.customWebRTCSignallingURI.enabled) {
    mainVehicleStore.customWebRTCSignallingURI.data = conn.toString()
  }

  // Temporary solution to actually set WebRTC URI, since right now we cannot just make reactive because streams will
  // be kept open.
  // TODO: handle video stream re connection
  reloadCockpitAndWarnUser()
}

watch(
  () => mainVehicleStore.webRTCSignallingURI,
  (val: Connection.URI) => {
    if (val.toString() === webRTCSignallingURI.value.toString()) {
      return
    }

    addWebRTCConnection(val)
  }
)

const setWebRTCSignallingURI = async (): Promise<void> => {
  const res = await webRTCSignallingForm.value.validate()

  if (!res.valid) {
    return
  }

  logUserAction(`Set custom WebRTC signalling URI to '${webRTCSignallingURI.value.toString()}'`)
  mainVehicleStore.customWebRTCSignallingURI = {
    data: webRTCSignallingURI.value.toString(),
    enabled: true,
  }

  addWebRTCConnection(webRTCSignallingURI.value)
}

const resetWebRTCSignallingURI = (): void => {
  logUserAction('Reset WebRTC signalling URI to default')
  mainVehicleStore.customWebRTCSignallingURI = {
    enabled: false,
    data: mainVehicleStore.defaultWebRTCSignallingURI.toString(),
  }
}

/** Vehicle connection timeout */

const defaultVehicleConnectionTimeoutSeconds = 5
const minVehicleConnectionTimeoutSeconds = 1

const connectionTimeoutForm = ref()
const connectionTimeoutFormValid = ref(true)
const vehicleConnectionTimeoutSeconds = computed(
  () => Math.round(mainVehicleStore.vehicleConnectionTimeoutMs / 100) / 10
)
const newVehicleConnectionTimeoutSeconds = ref<number>(vehicleConnectionTimeoutSeconds.value)

watch(vehicleConnectionTimeoutSeconds, (value) => (newVehicleConnectionTimeoutSeconds.value = value))

const isValidConnectionTimeout = (value: number | string): boolean | string => {
  const numericValue = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(numericValue)) return 'Timeout must be a valid number.'
  if (numericValue < minVehicleConnectionTimeoutSeconds) {
    return `Minimum timeout is ${minVehicleConnectionTimeoutSeconds} s.`
  }
  return true
}

const setConnectionTimeout = async (): Promise<void> => {
  const validation = await connectionTimeoutForm.value.validate()
  if (!validation.valid) return

  logUserAction(`Set vehicle connection timeout to ${newVehicleConnectionTimeoutSeconds.value}s`)
  mainVehicleStore.vehicleConnectionTimeoutMs = Math.round(newVehicleConnectionTimeoutSeconds.value * 1000)
}

const resetConnectionTimeout = (): void => {
  logUserAction('Reset vehicle connection timeout to default')
  newVehicleConnectionTimeoutSeconds.value = defaultVehicleConnectionTimeoutSeconds
  mainVehicleStore.vehicleConnectionTimeoutMs = defaultVehicleConnectionTimeoutSeconds * 1000
}

/** Reconnection watchdog timeout */

const defaultVehicleConnectionWatchdogTimeoutSeconds = 4
const minVehicleConnectionWatchdogTimeoutSeconds = 1

const watchdogTimeoutForm = ref()
const watchdogTimeoutFormValid = ref(true)
const vehicleConnectionWatchdogTimeoutSeconds = computed(
  () => Math.round(mainVehicleStore.vehicleConnectionWatchdogTimeoutMs / 100) / 10
)
const newVehicleConnectionWatchdogTimeoutSeconds = ref<number>(vehicleConnectionWatchdogTimeoutSeconds.value)

watch(vehicleConnectionWatchdogTimeoutSeconds, (value) => (newVehicleConnectionWatchdogTimeoutSeconds.value = value))

const isValidWatchdogTimeout = (value: number | string): boolean | string => {
  const numericValue = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(numericValue)) return 'Must be a valid number.'
  if (numericValue < minVehicleConnectionWatchdogTimeoutSeconds) {
    return `Minimum timeout is ${minVehicleConnectionWatchdogTimeoutSeconds} s.`
  }
  return true
}

const setWatchdogTimeout = async (): Promise<void> => {
  const validation = await watchdogTimeoutForm.value.validate()
  if (!validation.valid) return

  logUserAction(`Set reconnection watchdog timeout to ${newVehicleConnectionWatchdogTimeoutSeconds.value}s`)
  mainVehicleStore.vehicleConnectionWatchdogTimeoutMs = Math.round(
    newVehicleConnectionWatchdogTimeoutSeconds.value * 1000
  )
}

const resetWatchdogTimeout = (): void => {
  logUserAction('Reset reconnection watchdog timeout to default')
  newVehicleConnectionWatchdogTimeoutSeconds.value = defaultVehicleConnectionWatchdogTimeoutSeconds
  mainVehicleStore.vehicleConnectionWatchdogTimeoutMs = defaultVehicleConnectionWatchdogTimeoutSeconds * 1000
}

const isValidHostAddress = (value: string): boolean | string => {
  return isValidNetworkAddress(value) ?? 'Invalid host address. Should be an IP address or a hostname'
}

const isValidConnectionURI = (value: string): boolean | string => {
  const forbiddenStartStrings = ['http://', 'https://', 'ws://', 'wss://']
  if (forbiddenStartStrings.some((protocol) => value.startsWith(protocol))) {
    return 'Address should not include protocol (e.g.: "http://", "wss://").'
  }

  try {
    new Connection.URI(`ws://${value}:6040/`)
  } catch (error) {
    return `Invalid connection URI. ${error}.`
  }
  return true
}

const isValidSocketConnectionURI = (value: string): boolean | string => {
  try {
    const conn = new Connection.URI(value)
    if (!isElectron() && conn.type() !== Connection.Type.WebSocket && conn.type() !== Connection.Type.Serial) {
      throw new Error('URI should be of type WebSocket or Serial')
    }
    if (
      isElectron() &&
      conn.type() !== Connection.Type.WebSocket &&
      conn.type() !== Connection.Type.Serial &&
      conn.type() !== Connection.Type.UdpIn &&
      conn.type() !== Connection.Type.UdpOut &&
      conn.type() !== Connection.Type.UdpBroadcast &&
      conn.type() !== Connection.Type.TcpIn &&
      conn.type() !== Connection.Type.TcpOut
    ) {
      throw new Error('URI should be of type WebSocket, Serial, Udp or Tcp.')
    }
  } catch (error) {
    return `Invalid connection URI. ${error}.`
  }
  return true
}

const customRtcConfiguration = ref<string>(JSON.stringify(mainVehicleStore.customWebRTCConfiguration.data, null, 4))
const updateWebRtcConfiguration = (): void => {
  try {
    logUserAction('Updated custom WebRTC configuration')
    const newConfig = JSON.parse(customRtcConfiguration.value)
    mainVehicleStore.customWebRTCConfiguration.data = newConfig
    reloadCockpitAndWarnUser()
  } catch (error) {
    alert(`Could not update WebRTC configuration. ${error}.`)
  }
}

const tryToPrettifyRtcConfig = (): void => {
  try {
    const ugly = customRtcConfiguration.value
    const obj = JSON.parse(ugly)
    const pretty = JSON.stringify(obj, null, 4)
    if (ugly !== pretty) {
      customRtcConfiguration.value = pretty
    }
  } catch (error) {
    // Do nothing if the JSON is invalid
  }
}

const openTutorial = (): void => {
  logUserAction('Opened Tutorial')
  interfaceStore.isMainMenuVisible = false
  interfaceStore.isTutorialVisible = true
}

const openDataPrivacyModal = (): void => {
  logUserAction('Opened Data Privacy dialog')
  interfaceStore.isDataPrivacyModalVisible = true
}

const manageUsers = (): void => {
  logUserAction('Opened user management')
  missionStore.changeUsername()
}

const openCockpitSettingsDialog = (): void => {
  logUserAction('Opened Cockpit settings management dialog')
  showCockpitSettingsDialog.value = true
}

const openVehicleDiscoveryDialog = (): void => {
  logUserAction('Opened Vehicle Discovery dialog')
  showDiscoveryDialog.value = true
}

const togglePirateMode = (): void => {
  logUserAction(`${!interfaceStore.pirateMode ? 'Enabled' : 'Disabled'} pirate mode`)
  interfaceStore.pirateMode = !interfaceStore.pirateMode
}

const openExternalFeaturesModal = (): void => {
  logUserAction('Opened External Features dialog')
  interfaceStore.isMainMenuVisible = false
  interfaceStore.mainMenuCurrentStep = 1
  interfaceStore.currentSubMenuName = null
  interfaceStore.currentSubMenuComponentName = null
  interfaceStore.isExternalFeaturesModalVisible = true
}

watch(customRtcConfiguration, () => tryToPrettifyRtcConfig())

const showDiscoveryDialog = ref(false)

// Generic WebSocket connections
const exampleGenericWebSocketUrl = 'ws://{{ vehicle-address }}:1234'
const genericWebSocketConnections = ref<Record<string, GenericWebSocketConnection>>({})
const newGenericWebSocketUrl = ref(exampleGenericWebSocketUrl)
let unsubscribeGenericWebSocket: (() => void) | null = null

onMounted(() => {
  loadCockpitFolderPath()
  tryToPrettifyRtcConfig()
  unsubscribeGenericWebSocket = listenToGenericWebSocketConnections((connections) => {
    genericWebSocketConnections.value = connections
  })
})

onUnmounted(() => {
  if (unsubscribeGenericWebSocket) {
    unsubscribeGenericWebSocket()
  }
})

const addGenericWebSocket = (): void => {
  const url = newGenericWebSocketUrl.value.trim()
  if (!url) return

  logUserAction(`Added generic WebSocket connection '${url}'`)
  addGenericWebSocketConnection(url)
  newGenericWebSocketUrl.value = ''
}

const removeGenericWebSocket = (url: string): void => {
  logUserAction(`Removed generic WebSocket connection '${url}'`)
  removeGenericWebSocketConnection(url)
}

const openCockpitFolder = (): void => {
  logUserAction('Opened Cockpit folder')
  if (isElectron() && window.electronAPI) {
    window.electronAPI?.openCockpitFolder()
  } else {
    openSnackbar({
      message: 'This feature is only available in Cockpit Standalone.',
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  }
}
</script>
<style scoped>
.uri-input {
  width: 100% !important;
}
</style>
