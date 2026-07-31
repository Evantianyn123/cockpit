<template>
  <teleport to="body">
    <v-dialog :model-value="modelValue" max-width="1180" @update:model-value="updateVisible">
      <v-card class="power-settings-dialog" theme="dark">
        <v-card-title class="power-settings-title">
          <span>{{ t('powerControl.settings') }}</span>
          <span class="power-settings-state" :class="`connection-${connectionStatus.state}`">
            {{ connectionStateLabels[connectionStatus.state] }}
          </span>
          <span class="power-settings-endpoint">{{ t('powerControl.currentEndpointApplied', connectionStatus) }}</span>
          <v-btn
            v-tooltip.bottom="t('powerControl.exportConfiguration')"
            icon="mdi-download"
            size="small"
            variant="text"
            @click="exportConfiguration"
          />
          <v-btn
            v-tooltip.bottom="t('powerControl.importConfiguration')"
            icon="mdi-upload"
            size="small"
            variant="text"
            @click="openImport"
          />
          <v-btn
            v-tooltip.bottom="t('common.close')"
            icon="mdi-close"
            size="small"
            variant="text"
            @click="updateVisible(false)"
          />
          <input
            ref="importInput"
            class="power-settings-import"
            type="file"
            accept="application/json,.json"
            @change="importConfiguration"
          />
        </v-card-title>

        <v-card-text class="power-settings-content">
          <section class="power-settings-section">
            <div class="power-settings-section-title">{{ t('powerControl.connection') }}</div>
            <div class="power-settings-grid power-settings-connection-grid">
              <v-text-field
                v-model="draftConnection.host"
                :label="t('tcpDiagnostic.tcpServerAddress')"
                density="compact"
                variant="outlined"
                hide-details
              />
              <v-text-field
                v-model.number="draftConnection.port"
                :label="t('common.port')"
                type="number"
                min="1"
                max="65535"
                density="compact"
                variant="outlined"
                hide-details
              />
              <v-text-field
                v-model.number="draftConnection.unitId"
                :label="t('powerControl.unitId')"
                type="number"
                min="1"
                max="247"
                density="compact"
                variant="outlined"
                hide-details
              />
              <v-text-field
                v-model.number="draftConnection.requestTimeoutMs"
                :label="t('powerControl.timeout')"
                type="number"
                min="100"
                max="10000"
                density="compact"
                variant="outlined"
                hide-details
              />
            </div>
            <div class="power-settings-actions">
              <v-btn color="primary" prepend-icon="mdi-content-save" size="small" @click="applyConfiguration">
                {{ t('common.saveAndApply') }}
              </v-btn>
              <v-btn
                prepend-icon="mdi-lan-connect"
                size="small"
                variant="outlined"
                :disabled="isDirty"
                @click="testConnection"
              >
                {{ t('powerControl.connectionTest') }}
              </v-btn>
            </div>
          </section>

          <section class="power-settings-section">
            <div class="power-settings-section-heading">
              <div class="power-settings-section-title">{{ t('powerControl.channels') }}</div>
              <v-text-field
                v-model.number="channelCount"
                class="power-settings-count"
                :label="t('powerControl.channelQuantity')"
                type="number"
                min="1"
                max="32"
                density="compact"
                variant="outlined"
                hide-details
              />
            </div>

            <div class="power-channel-list">
              <article v-for="channel in draftConfiguration.channels" :key="channel.id" class="power-channel-config">
                <div class="power-channel-heading">
                  <span class="power-channel-number">{{ String(channel.id).padStart(2, '0') }}</span>
                  <v-checkbox
                    v-model="channel.enabled"
                    :label="t('powerControl.enabled')"
                    density="compact"
                    hide-details
                  />
                  <v-text-field
                    v-model="channel.name"
                    class="power-channel-name"
                    :label="t('powerControl.channelName')"
                    maxlength="40"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                  <v-btn
                    v-tooltip.bottom="t('powerControl.readOnlyTest')"
                    icon="mdi-database-search-outline"
                    size="x-small"
                    variant="text"
                    :disabled="isDirty || !channel.enabled"
                    @click="testRead(channel.id)"
                  />
                </div>

                <div class="power-settings-grid power-channel-grid">
                  <v-select
                    v-model="channel.writeFunctionCode"
                    :label="t('powerControl.writeFunctionCode')"
                    :items="writeFunctionCodes"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                  <v-text-field
                    v-model.number="channel.writeAddress"
                    :label="t('powerControl.writeAddress')"
                    type="number"
                    min="0"
                    max="65535"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                  <v-text-field
                    v-model.number="channel.onValue"
                    :label="t('powerControl.writeOnValue')"
                    type="number"
                    min="0"
                    max="65535"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                  <v-text-field
                    v-model.number="channel.offValue"
                    :label="t('powerControl.writeOffValue')"
                    type="number"
                    min="0"
                    max="65535"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                  <v-select
                    v-model="channel.statusFunctionCode"
                    :label="t('powerControl.readFunctionCode')"
                    :items="readFunctionCodes"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                  <v-text-field
                    v-model.number="channel.statusAddress"
                    :label="t('powerControl.statusAddress')"
                    type="number"
                    min="0"
                    max="65535"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                  <v-text-field
                    v-model.number="channel.statusMask"
                    :label="t('powerControl.statusMask')"
                    type="number"
                    min="0"
                    max="65535"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                  <v-text-field
                    v-model.number="channel.statusOnValue"
                    :label="t('powerControl.statusOnValue')"
                    type="number"
                    min="0"
                    max="65535"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                  <v-text-field
                    v-model.number="channel.statusOffValue"
                    :label="t('powerControl.statusOffValue')"
                    type="number"
                    min="0"
                    max="65535"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </div>
              </article>
            </div>
          </section>

          <p v-if="formError" class="power-settings-error" role="alert">{{ formError }}</p>
          <p v-else-if="connectionStatus.lastError" class="power-settings-error" role="alert">
            {{ connectionStatus.lastError }}
          </p>
        </v-card-text>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import saveAs from 'file-saver'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  createPowerControlChannel,
  MAX_POWER_CONTROL_CHANNELS,
  parsePowerControlExportConfiguration,
  powerControlConfigurationSchema,
} from '@/libs/power-control/configuration'
import { powerControlConnectionConfigSchema } from '@/libs/power-control/connection-config'
import type { PowerControlConfiguration, PowerControlExportConfiguration } from '@/types/power-control'
import type { PowerModbusConnectionStatus } from '@/types/power-modbus'
import type { PowerControlConnectionConfig } from '@/types/power-tcp-diagnostic'

const props = defineProps<{
  /** Controls whether the settings dialog is visible. */
  modelValue: boolean
  /** Last saved shared TCP endpoint configuration. */
  connectionConfig: PowerControlConnectionConfig
  /** Last saved multi-channel power configuration. */
  configuration: PowerControlConfiguration
  /** Current managed Modbus transport status. */
  connectionStatus: PowerModbusConnectionStatus
}>()

const emit = defineEmits<{
  /** Updates dialog visibility. */
  (event: 'update:modelValue', visible: boolean): void
  /** Applies a validated complete configuration. */
  (event: 'apply', value: PowerControlExportConfiguration): void
  /** Tests the already applied endpoint without writing any register. */
  (event: 'connection-test'): void
  /** Reads one configured channel status without writing any register. */
  (event: 'read-test', channelId: number): void
}>()
const { t } = useI18n()

/**
 * Creates an independent JSON-compatible copy for dialog editing.
 * @template T - JSON-compatible object type.
 * @param {T} value - Source value.
 * @returns {T} Independent copy.
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const draftConnection = ref<PowerControlConnectionConfig>(clone(props.connectionConfig))
const draftConfiguration = ref<PowerControlConfiguration>(clone(props.configuration))
const formError = ref<string | undefined>()
const importInput = ref<HTMLInputElement | null>(null)
const writeFunctionCodes = [5, 6, 16]
const readFunctionCodes = [3, 4]
const connectionStateLabels = computed<Record<PowerModbusConnectionStatus['state'], string>>(() => ({
  connected: t('powerControl.status.connected'),
  connecting: t('powerControl.status.connecting'),
  disconnected: t('powerControl.status.disconnected'),
  reconnecting: t('powerControl.status.reconnecting'),
}))

const channelCount = computed<number>({
  get: () => draftConfiguration.value.channels.length,
  set: (value) => {
    const nextCount = Math.min(MAX_POWER_CONTROL_CHANNELS, Math.max(1, Number.isFinite(value) ? Math.trunc(value) : 1))
    const currentChannels = draftConfiguration.value.channels
    draftConfiguration.value.channels = Array.from({ length: nextCount }, (_value, index) => {
      const existingChannel = currentChannels[index]
      return existingChannel ? existingChannel : createPowerControlChannel(index + 1)
    })
  },
})

const isDirty = computed(
  () =>
    JSON.stringify(draftConnection.value) !== JSON.stringify(props.connectionConfig) ||
    JSON.stringify(draftConfiguration.value) !== JSON.stringify(props.configuration)
)

const validateDraft = (): PowerControlExportConfiguration | undefined => {
  const connection = powerControlConnectionConfigSchema.safeParse(draftConnection.value)
  if (!connection.success) {
    formError.value = connection.error.issues[0]?.message ?? t('powerControl.invalidConnectionConfiguration')
    return undefined
  }
  const powerControl = powerControlConfigurationSchema.safeParse(draftConfiguration.value)
  if (!powerControl.success) {
    formError.value = powerControl.error.issues[0]?.message ?? t('powerControl.invalidChannelConfiguration')
    return undefined
  }
  formError.value = undefined
  return { version: 1, connection: connection.data, powerControl: powerControl.data }
}

const applyConfiguration = (): void => {
  const configuration = validateDraft()
  if (!configuration) return
  emit('apply', configuration)
}

const testConnection = (): void => {
  if (isDirty.value) {
    formError.value = t('powerControl.saveBeforeTesting')
    return
  }
  formError.value = undefined
  emit('connection-test')
}

const testRead = (channelId: number): void => {
  if (isDirty.value) {
    formError.value = t('powerControl.saveBeforeTesting')
    return
  }
  formError.value = undefined
  emit('read-test', channelId)
}

const exportConfiguration = (): void => {
  const configuration = validateDraft()
  if (!configuration) return
  const blob = new Blob([JSON.stringify(configuration, null, 2)], { type: 'application/json;charset=utf-8' })
  saveAs(blob, 'cockpit-power-control-config.json')
}

const openImport = (): void => importInput.value?.click()

const importConfiguration = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const configuration = parsePowerControlExportConfiguration(JSON.parse(String(reader.result)))
      if (!configuration) {
        formError.value = t('powerControl.invalidConfigurationFile')
        return
      }
      draftConnection.value = clone(configuration.connection)
      draftConfiguration.value = clone(configuration.powerControl)
      formError.value = undefined
    } catch {
      formError.value = t('powerControl.invalidJsonFile')
    }
  }
  reader.readAsText(file, 'utf-8')
}

const updateVisible = (visible: boolean): void => emit('update:modelValue', visible)

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    draftConnection.value = clone(props.connectionConfig)
    draftConfiguration.value = clone(props.configuration)
    formError.value = undefined
  },
  { immediate: true }
)
</script>

<style scoped>
.power-settings-dialog {
  border-radius: 8px;
}

.power-settings-title,
.power-settings-section-heading,
.power-settings-actions,
.power-channel-heading {
  display: flex;
  align-items: center;
}

.power-settings-title {
  gap: 6px;
  font-size: 16px;
}

.power-settings-title .v-btn {
  flex: 0 0 auto;
}

.power-settings-endpoint {
  margin-left: auto;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.62);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.power-settings-state {
  padding: 1px 5px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 10px;
  white-space: nowrap;
}

.connection-connected {
  border-color: rgba(76, 175, 80, 0.48);
  color: #a5d6a7;
}

.connection-connecting,
.connection-reconnecting {
  border-color: rgba(255, 224, 130, 0.38);
  color: #ffe082;
}

.power-settings-import {
  display: none;
}

.power-settings-content {
  display: grid;
  gap: 16px;
}

.power-settings-section {
  display: grid;
  gap: 9px;
}

.power-settings-section-title {
  color: rgba(255, 255, 255, 0.84);
  font-size: 13px;
  font-weight: 700;
}

.power-settings-grid {
  display: grid;
  gap: 8px;
}

.power-settings-connection-grid {
  grid-template-columns: minmax(180px, 2fr) repeat(3, minmax(110px, 0.8fr));
}

.power-settings-actions {
  gap: 8px;
}

.power-settings-section-heading {
  justify-content: space-between;
  gap: 12px;
}

.power-settings-count {
  max-width: 128px;
}

.power-channel-list {
  max-height: min(56vh, 600px);
  overflow: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}

.power-channel-config {
  padding: 9px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.power-channel-heading {
  gap: 8px;
  min-height: 34px;
}

.power-channel-number {
  width: 28px;
  height: 24px;
  flex: 0 0 28px;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.power-channel-name {
  max-width: 320px;
}

.power-channel-grid {
  grid-template-columns: repeat(9, minmax(104px, 1fr));
}

.power-settings-error {
  margin: 0;
  color: #ef9a9a;
  font-size: 12px;
}

@media (max-width: 960px) {
  .power-settings-connection-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .power-channel-grid {
    grid-template-columns: repeat(3, minmax(120px, 1fr));
  }
}

@media (max-width: 600px) {
  .power-settings-title {
    flex-wrap: wrap;
  }

  .power-settings-endpoint {
    width: 100%;
    margin-left: 0;
  }

  .power-settings-connection-grid,
  .power-channel-grid {
    grid-template-columns: 1fr;
  }

  .power-channel-heading {
    flex-wrap: wrap;
  }

  .power-channel-name {
    width: calc(100% - 36px);
    max-width: none;
  }
}
</style>
