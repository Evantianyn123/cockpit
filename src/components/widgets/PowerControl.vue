<template>
  <section class="power-control-widget" :class="{ 'is-collapsed': isCollapsed }" :aria-label="t('powerControl.title')">
    <header class="power-control-header">
      <div class="widget-title">
        <v-icon icon="mdi-power-plug" size="16" />
        <span>{{ t('powerControl.title') }}</span>
        <span class="connection-state" :class="`connection-${connectionStatus.state}`">
          {{ connectionStateLabels[connectionStatus.state] }}
        </span>
      </div>
      <div class="header-actions">
        <span class="connection-endpoint" :title="`${connectionStatus.host}:${connectionStatus.port}`">
          {{ connectionStatus.host }}:{{ connectionStatus.port }}
        </span>
        <v-btn
          v-if="isSessionOwner && isElectron()"
          v-tooltip.bottom="t('powerControl.settings')"
          icon="mdi-cog-outline"
          size="x-small"
          variant="text"
          @click.stop="settingsDialogOpen = true"
        />
        <v-btn
          v-if="isSessionOwner && isElectron()"
          v-tooltip.bottom="t('powerControl.rawTcpTest')"
          icon="mdi-lan-connect"
          size="x-small"
          variant="text"
          @click.stop="tcpTestDialogOpen = true"
        />
        <v-btn
          v-if="isSessionOwner"
          v-tooltip.bottom="isCollapsed ? t('powerControl.expand') : t('powerControl.collapse')"
          :icon="isCollapsed ? 'mdi-chevron-down' : 'mdi-chevron-up'"
          size="x-small"
          variant="text"
          @click.stop="toggleCollapsed"
        />
      </div>
    </header>

    <div v-if="!isCollapsed && !isSessionOwner" class="empty-state">
      <v-icon icon="mdi-information-outline" size="18" />
      <span>{{ t('powerControl.singleInstance') }}</span>
    </div>
    <div v-else-if="!isCollapsed && activeChannels.length === 0" class="empty-state">
      <v-icon icon="mdi-power-settings" size="18" />
      <span>{{ t('powerControl.noChannels') }}</span>
    </div>
    <div v-else-if="!isCollapsed" class="channel-list">
      <div
        v-for="channel in activeChannels"
        :key="channel.id"
        class="channel-row"
        :data-power-state="displayedState(channel)"
      >
        <span class="channel-name" data-cockpit-no-localize>{{ channel.name }}</span>

        <div class="channel-state" :class="`state-${displayedState(channel)}`">
          <v-progress-circular v-if="displayedState(channel) === 'executing'" indeterminate size="12" width="2" />
          <span v-else class="state-dot" />
          <span>{{ stateMeta[displayedState(channel)] }}</span>
        </div>

        <div class="channel-actions">
          <v-btn
            prepend-icon="mdi-power"
            :color="runtimeFor(channel).actualState === 'on' ? '#2e7d32' : undefined"
            :variant="runtimeFor(channel).actualState === 'on' ? 'flat' : 'outlined'"
            size="small"
            :disabled="isActionDisabled(channel)"
            :aria-label="`${channel.name} ${t('powerControl.on')}`"
            @click.stop="requestState(channel, 'on')"
          >
            {{ t('powerControl.on') }}
          </v-btn>
          <v-btn
            prepend-icon="mdi-power-off"
            :color="runtimeFor(channel).actualState === 'off' ? '#c62828' : undefined"
            :variant="runtimeFor(channel).actualState === 'off' ? 'flat' : 'outlined'"
            size="small"
            :disabled="isActionDisabled(channel)"
            :aria-label="`${channel.name} ${t('powerControl.off')}`"
            @click.stop="requestState(channel, 'off')"
          >
            {{ t('powerControl.off') }}
          </v-btn>
        </div>
      </div>
    </div>

    <p v-if="visibleTransportMessage" class="transport-message" :title="visibleTransportMessage">
      {{ visibleTransportMessage }}
    </p>
    <PowerControlSettingsDialog
      v-if="isElectron()"
      v-model="settingsDialogOpen"
      :connection-config="connectionConfig"
      :configuration="powerControlConfiguration"
      :connection-status="connectionStatus"
      @apply="applySettings"
      @connection-test="testConnection"
      @read-test="testRead"
    />
    <PowerTcpConnectionTestDialog
      v-if="isElectron()"
      v-model="tcpTestDialogOpen"
      @connection-config-applied="applyDiagnosticConnectionConfig"
    />
  </section>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed, onBeforeMount, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PowerControlSettingsDialog from '@/components/widgets/PowerControlSettingsDialog.vue'
import PowerTcpConnectionTestDialog from '@/components/widgets/PowerTcpConnectionTestDialog.vue'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import {
  buildPowerControlReadBatches,
  DEFAULT_POWER_CONTROL_CONFIGURATION,
  POWER_CONTROL_CONFIGURATION_STORAGE_KEY,
  powerControlConfigurationSchema,
  powerControlStateFromRegister,
} from '@/libs/power-control/configuration'
import {
  DEFAULT_POWER_CONTROL_CONNECTION_CONFIG,
  POWER_CONTROL_CONNECTION_STORAGE_KEY,
  powerControlConnectionConfigSchema,
} from '@/libs/power-control/connection-config'
import { settingsManager } from '@/libs/settings-management'
import { isElectron } from '@/libs/utils'
import type {
  PowerChannelState,
  PowerControlChannelConfig,
  PowerControlConfiguration,
  PowerControlExportConfiguration,
} from '@/types/power-control'
import type { PowerModbusConnectionStatus } from '@/types/power-modbus'
import type { PowerControlConnectionConfig } from '@/types/power-tcp-diagnostic'
import type { Widget } from '@/types/widgets'

type PowerCommand = 'on' | 'off'
type PowerDisplayedState = PowerChannelState | 'executing'
const collapsedHeaderHeightPx = 38
let activePowerControlWidgetHash: string | undefined

/**
 *
 */
interface PowerControlInternalState {
  /**
   *
   */
  expandedHeight?: number
}

/** One channel's readback and in-flight command state. */
interface PowerChannelRuntime {
  /** Last actual state derived from a valid register response. */
  actualState: PowerChannelState
  /** Whether this channel has received at least one valid status register. */
  hasValidRead: boolean
  /** Command waiting for a fresh confirmation read. */
  pendingCommand?: PowerCommand
}

const props = defineProps<{
  /** Widget reference. */
  widget: Widget
}>()

const widget = toRefs(props).widget
const { t } = useI18n()
const { height: windowHeight } = useWindowSize()
const connectionConfig = useBlueOsStorage<PowerControlConnectionConfig>(
  POWER_CONTROL_CONNECTION_STORAGE_KEY,
  DEFAULT_POWER_CONTROL_CONNECTION_CONFIG
)
const powerControlConfiguration = useBlueOsStorage<PowerControlConfiguration>(
  POWER_CONTROL_CONFIGURATION_STORAGE_KEY,
  DEFAULT_POWER_CONTROL_CONFIGURATION
)
const activeConnectionConfig = ref<PowerControlConnectionConfig>({ ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG })
const connectionStatus = ref<PowerModbusConnectionStatus>({
  state: 'disconnected',
  host: DEFAULT_POWER_CONTROL_CONNECTION_CONFIG.host,
  port: DEFAULT_POWER_CONTROL_CONNECTION_CONFIG.port,
})
const channelStates = ref<Record<number, PowerChannelRuntime>>({})
const transportMessageKey = ref('powerControl.loading')
const transportMessageParameters = ref<Record<string, string | number>>({})
const transportMessageRaw = ref<string | undefined>()
const isTransportBusy = ref(false)
const settingsDialogOpen = ref(false)
const tcpTestDialogOpen = ref(false)
const isSessionOwner = ref(false)
const isCollapsed = computed(() => Boolean(widget.value.options.collapsed))
const stateMeta = computed<Record<PowerDisplayedState, string>>(() => ({
  on: t('powerControl.status.on'),
  off: t('powerControl.status.off'),
  unknown: t('powerControl.status.unknown'),
  offline: t('powerControl.status.disconnected'),
  executing: t('powerControl.status.executing'),
}))
const connectionStateLabels = computed<Record<PowerModbusConnectionStatus['state'], string>>(() => ({
  connected: t('powerControl.status.connected'),
  connecting: t('powerControl.status.connecting'),
  disconnected: t('powerControl.status.disconnected'),
  reconnecting: t('powerControl.status.reconnecting'),
}))
const displayedTransportMessage = computed(
  () => transportMessageRaw.value ?? t(transportMessageKey.value, transportMessageParameters.value)
)
const visibleTransportMessage = computed(
  () => transportMessageRaw.value ?? (isTransportBusy.value ? displayedTransportMessage.value : undefined)
)

/**
 * Updates the translated operator-facing transport status.
 * @param {string} key Translation key.
 * @param {Record<string, string | number>} parameters Interpolation values.
 * @returns {void}
 */
const setTransportMessage = (key: string, parameters: Record<string, string | number> = {}): void => {
  transportMessageKey.value = key
  transportMessageParameters.value = parameters
  transportMessageRaw.value = undefined
}

/**
 * Displays a raw technical error without discarding protocol detail.
 * @param {string} message Transport or protocol diagnostic text.
 * @returns {void}
 */
const setTransportError = (message: string): void => {
  transportMessageRaw.value = message
}

let pollTimer: ReturnType<typeof window.setInterval> | undefined
let lifecycleGeneration = 0
let lastSuccessfulReadAt = 0

const activeChannels = computed(() => powerControlConfiguration.value.channels.filter((channel) => channel.enabled))

/**
 * Returns the persisted internal state for this widget.
 * @returns {PowerControlInternalState} State that must survive refreshes but is not user configuration.
 */
const getInternalState = (): PowerControlInternalState => {
  if (!widget.value.persistentInternalState) widget.value.persistentInternalState = {}
  return widget.value.persistentInternalState as PowerControlInternalState
}

const collapsedHeightNormalized = (): number => collapsedHeaderHeightPx / Math.max(windowHeight.value, 1)

const keepWidgetInViewport = (): void => {
  widget.value.size.height = Math.min(1, Math.max(collapsedHeightNormalized(), widget.value.size.height))
  widget.value.position.y = Math.min(1 - widget.value.size.height, Math.max(0, widget.value.position.y))
}

const applyCollapsedGeometry = (): void => {
  if (isCollapsed.value) {
    widget.value.size.height = collapsedHeightNormalized()
  } else if (getInternalState().expandedHeight) {
    widget.value.size.height = getInternalState().expandedHeight!
  }
  keepWidgetInViewport()
}

const toggleCollapsed = (): void => {
  if (isCollapsed.value) {
    widget.value.options.collapsed = false
  } else {
    getInternalState().expandedHeight = widget.value.size.height
    widget.value.options.collapsed = true
  }
  applyCollapsedGeometry()
}

const claimPowerControlSession = (): boolean => {
  if (activePowerControlWidgetHash && activePowerControlWidgetHash !== widget.value.hash) return false
  activePowerControlWidgetHash = widget.value.hash
  return true
}

const savedConnectionConfig = (): PowerControlConnectionConfig => {
  const parsed = powerControlConnectionConfigSchema.safeParse(connectionConfig.value)
  return parsed.success ? parsed.data : { ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG }
}

const savedPowerControlConfiguration = (): PowerControlConfiguration => {
  const parsed = powerControlConfigurationSchema.safeParse(powerControlConfiguration.value)
  return parsed.success ? parsed.data : { ...DEFAULT_POWER_CONTROL_CONFIGURATION }
}

const runtimeFor = (channel: PowerControlChannelConfig): PowerChannelRuntime =>
  channelStates.value[channel.id] ?? { actualState: 'unknown', hasValidRead: false }

const updateRuntime = (channelId: number, update: Partial<PowerChannelRuntime>): void => {
  const current = channelStates.value[channelId] ?? { actualState: 'unknown', hasValidRead: false }
  channelStates.value = { ...channelStates.value, [channelId]: { ...current, ...update } }
}

const resetRuntime = (): void => {
  channelStates.value = Object.fromEntries(
    activeChannels.value.map((channel) => [channel.id, { actualState: 'unknown', hasValidRead: false }])
  )
  lastSuccessfulReadAt = Date.now()
}

const displayedState = (channel: PowerControlChannelConfig): PowerDisplayedState => {
  const runtime = runtimeFor(channel)
  return runtime.pendingCommand ? 'executing' : runtime.actualState
}

const isActionDisabled = (channel: PowerControlChannelConfig): boolean => {
  const runtime = runtimeFor(channel)
  return (
    isTransportBusy.value ||
    runtime.pendingCommand !== undefined ||
    !runtime.hasValidRead ||
    runtime.actualState === 'offline' ||
    connectionStatus.value.state !== 'connected'
  )
}

const setOfflineWhenStale = (): void => {
  if (Date.now() - lastSuccessfulReadAt < 3000) return
  activeChannels.value.forEach((channel) => {
    if (!runtimeFor(channel).pendingCommand) updateRuntime(channel.id, { actualState: 'offline', hasValidRead: false })
  })
}

const refreshConnectionStatus = async (): Promise<boolean> => {
  if (!isElectron() || !window.electronAPI) {
    connectionStatus.value = {
      state: 'disconnected',
      host: activeConnectionConfig.value.host,
      port: activeConnectionConfig.value.port,
      lastError: t('powerControl.desktopOnly'),
    }
    return false
  }

  connectionStatus.value = await window.electronAPI.powerModbusGetStatus()
  return connectionStatus.value.state === 'connected'
}

const readConfiguredChannels = async (generation: number): Promise<boolean> => {
  const canRead = await refreshConnectionStatus()
  if (!canRead) {
    setOfflineWhenStale()
    return false
  }

  const batches = buildPowerControlReadBatches(activeChannels.value)
  if (batches.length === 0) {
    setTransportMessage('powerControl.noChannels')
    return true
  }

  for (const batch of batches) {
    const result = await window.electronAPI!.powerModbusRead({
      functionCode: batch.functionCode,
      unitId: activeConnectionConfig.value.unitId,
      address: batch.address,
      quantity: batch.quantity,
    })
    if (generation !== lifecycleGeneration) return false
    if (!result.ok) {
      setTransportError(result.error.message)
      await refreshConnectionStatus()
      setOfflineWhenStale()
      return false
    }

    batch.channels.forEach((channel) => {
      const registerValue = result.value.values[channel.statusAddress - batch.address]
      updateRuntime(channel.id, {
        actualState: registerValue === undefined ? 'unknown' : powerControlStateFromRegister(channel, registerValue),
        hasValidRead: registerValue !== undefined,
      })
    })
  }

  lastSuccessfulReadAt = Date.now()
  setTransportMessage('powerControl.statusRead', { count: batches.length })
  return true
}

const pollChannels = async (): Promise<void> => {
  if (!isSessionOwner.value || isTransportBusy.value) return
  isTransportBusy.value = true
  const generation = lifecycleGeneration
  try {
    await readConfiguredChannels(generation)
  } finally {
    if (generation === lifecycleGeneration) isTransportBusy.value = false
  }
}

const configureConnection = async (config: PowerControlConnectionConfig): Promise<boolean> => {
  if (!isElectron() || !window.electronAPI) {
    await refreshConnectionStatus()
    return false
  }

  const result = await window.electronAPI.powerModbusConfigure(config)
  if (!result.ok) {
    setTransportError(result.error.message)
    await refreshConnectionStatus()
    return false
  }
  activeConnectionConfig.value = { ...config }
  connectionStatus.value = result.value
  return true
}

const connectAndPoll = async (): Promise<void> => {
  if (!isElectron() || !window.electronAPI) {
    await refreshConnectionStatus()
    setTransportMessage('powerControl.desktopOnly')
    return
  }

  if (!(await configureConnection(activeConnectionConfig.value))) return
  const result = await window.electronAPI.powerModbusConnect()
  if (!result.ok) setTransportError(result.error.message)
  else connectionStatus.value = result.value
  await pollChannels()
}

const applyConnectionConfiguration = async (config: PowerControlConnectionConfig): Promise<void> => {
  activeConnectionConfig.value = { ...config }
  if (!isSessionOwner.value || !window.electronAPI) return

  lifecycleGeneration += 1
  resetRuntime()
  isTransportBusy.value = true
  try {
    if (!(await configureConnection(config))) return
    const result = await window.electronAPI.powerModbusConnect()
    if (!result.ok) setTransportError(result.error.message)
    else {
      connectionStatus.value = result.value
      setTransportMessage('powerControl.savedAndReading')
      await readConfiguredChannels(lifecycleGeneration)
    }
  } finally {
    isTransportBusy.value = false
  }
}

const requestState = async (channel: PowerControlChannelConfig, command: PowerCommand): Promise<void> => {
  if (isActionDisabled(channel) || !window.electronAPI) return

  const generation = lifecycleGeneration
  isTransportBusy.value = true
  updateRuntime(channel.id, { pendingCommand: command })
  setTransportMessage('powerControl.sendingCommand', {
    name: channel.name,
    command: t(command === 'on' ? 'powerControl.on' : 'powerControl.off'),
  })
  try {
    const value = command === 'on' ? channel.onValue : channel.offValue
    const request =
      channel.writeFunctionCode === 16
        ? {
            functionCode: 16 as const,
            unitId: activeConnectionConfig.value.unitId,
            address: channel.writeAddress,
            values: [value],
          }
        : {
            functionCode: channel.writeFunctionCode,
            unitId: activeConnectionConfig.value.unitId,
            address: channel.writeAddress,
            value,
          }
    const writeResult = await window.electronAPI.powerModbusWrite(request)
    if (!writeResult.ok) {
      setTransportError(writeResult.error.message)
      await refreshConnectionStatus()
      setOfflineWhenStale()
      return
    }

    await readConfiguredChannels(generation)
  } finally {
    if (generation === lifecycleGeneration) {
      updateRuntime(channel.id, { pendingCommand: undefined })
      isTransportBusy.value = false
    }
  }
}

const applySettings = async (configuration: PowerControlExportConfiguration): Promise<void> => {
  connectionConfig.value = configuration.connection
  powerControlConfiguration.value = configuration.powerControl
  await Promise.all([
    settingsManager.setKeyValue(POWER_CONTROL_CONNECTION_STORAGE_KEY, configuration.connection),
    settingsManager.setKeyValue(POWER_CONTROL_CONFIGURATION_STORAGE_KEY, configuration.powerControl),
  ])

  await applyConnectionConfiguration(configuration.connection)
}

const applyDiagnosticConnectionConfig = async (config: PowerControlConnectionConfig): Promise<void> => {
  connectionConfig.value = config
  await settingsManager.setKeyValue(POWER_CONTROL_CONNECTION_STORAGE_KEY, config)
  await applyConnectionConfiguration(config)
}

const testConnection = async (): Promise<void> => {
  if (!window.electronAPI) return
  const result = await window.electronAPI.powerModbusConnect()
  if (!result.ok) setTransportError(result.error.message)
  else {
    connectionStatus.value = result.value
    setTransportMessage('powerControl.connectionTestPassed', result.value)
  }
}

const testRead = async (channelId: number): Promise<void> => {
  const channel = activeChannels.value.find((configuredChannel) => configuredChannel.id === channelId)
  if (!channel) return
  const generation = lifecycleGeneration
  isTransportBusy.value = true
  try {
    const result = await window.electronAPI?.powerModbusRead({
      functionCode: channel.statusFunctionCode,
      unitId: activeConnectionConfig.value.unitId,
      address: channel.statusAddress,
      quantity: 1,
    })
    if (!result) return
    if (!result.ok) {
      setTransportError(result.error.message)
      await refreshConnectionStatus()
      return
    }
    if (generation !== lifecycleGeneration) return
    const registerValue = result.value.values[0]
    updateRuntime(channel.id, {
      actualState: registerValue === undefined ? 'unknown' : powerControlStateFromRegister(channel, registerValue),
      hasValidRead: registerValue !== undefined,
    })
    lastSuccessfulReadAt = Date.now()
    setTransportMessage('powerControl.readResult', {
      name: channel.name,
      address: channel.statusAddress,
      value: registerValue ?? t('common.unknown'),
    })
  } finally {
    if (generation === lifecycleGeneration) isTransportBusy.value = false
  }
}

onBeforeMount(() => {
  widget.value.options = {
    powerControlVersion: 1,
    collapsed: false,
    ...widget.value.options,
  }
  if (!getInternalState().expandedHeight && !isCollapsed.value) {
    getInternalState().expandedHeight = widget.value.size.height
  }
  applyCollapsedGeometry()
  activeConnectionConfig.value = { ...savedConnectionConfig() }
  powerControlConfiguration.value = savedPowerControlConfiguration()
  resetRuntime()
})

onMounted(() => {
  isSessionOwner.value = claimPowerControlSession()
  if (!isSessionOwner.value) return
  void connectAndPoll()
  pollTimer = window.setInterval(() => void pollChannels(), 1000)
})

onUnmounted(() => {
  lifecycleGeneration += 1
  if (pollTimer !== undefined) window.clearInterval(pollTimer)
  if (activePowerControlWidgetHash !== widget.value.hash) return
  activePowerControlWidgetHash = undefined
  void window.electronAPI?.powerModbusDisconnect()
})

watch(
  () => widget.value.size.height,
  (height) => {
    if (!isCollapsed.value && Number.isFinite(height) && height > 0) getInternalState().expandedHeight = height
  }
)

watch(windowHeight, () => applyCollapsedGeometry())
</script>

<style scoped>
.power-control-widget {
  container-type: inline-size;
  width: 100%;
  height: 100%;
  min-width: 320px;
  min-height: 168px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #f5f7fa;
  background: rgba(25, 31, 36, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
}

.power-control-widget.is-collapsed {
  min-height: 38px;
}

.power-control-header,
.widget-title,
.header-actions,
.channel-actions,
.channel-state,
.empty-state {
  display: flex;
  align-items: center;
}

.power-control-header {
  min-height: 38px;
  padding: 5px 8px;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.header-actions {
  min-width: 0;
  flex: 0 0 auto;
  gap: 4px;
}

.header-actions :deep(.v-btn) {
  width: 24px;
  height: 24px;
}

.header-actions :deep(.v-icon) {
  font-size: 14px;
}

.widget-title {
  min-width: 0;
  gap: 5px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.connection-state {
  padding: 1px 4px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.connection-endpoint {
  max-width: min(32cqw, 180px);
  overflow: hidden;
  color: rgba(255, 255, 255, 0.62);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-connected {
  color: #a5d6a7;
  border-color: rgba(76, 175, 80, 0.48);
}

.connection-connecting,
.connection-reconnecting {
  color: #ffe082;
  border-color: rgba(255, 224, 130, 0.38);
}

.connection-disconnected {
  color: rgba(255, 255, 255, 0.62);
}

.transport-message {
  margin: 0;
  padding: 4px 8px;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.62);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 10px;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-list {
  flex: 1 1 auto;
  overflow: auto;
}

.channel-row {
  min-height: 40px;
  padding: 2px 7px;
  display: grid;
  grid-template-columns: minmax(118px, 1fr) minmax(70px, 0.55fr) 150px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.channel-name {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-state {
  gap: 5px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  white-space: nowrap;
}

.state-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: #78909c;
}

.state-on .state-dot {
  background: #43a047;
}

.state-off .state-dot {
  background: #e53935;
}

.state-unknown .state-dot {
  background: #f9a825;
}

.state-executing {
  color: #80cbc4;
}

.channel-actions {
  width: 150px;
  justify-content: flex-end;
  gap: 6px;
}

.channel-actions :deep(.v-btn) {
  width: 70px;
  height: 27px;
  padding: 0 6px;
  font-size: 11px;
}

.channel-actions :deep(.v-btn__prepend) {
  margin-inline: 0 4px;
}

.channel-actions :deep(.v-icon) {
  font-size: 14px;
}

.empty-state {
  flex: 1;
  justify-content: center;
  gap: 7px;
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
}

.transport-message {
  margin-top: auto;
  border-bottom: 0;
}

@container (max-width: 390px) {
  .power-control-header {
    align-items: flex-start;
  }

  .channel-row {
    grid-template-columns: minmax(100px, 1fr) 150px;
    gap: 2px 8px;
    padding: 5px 7px;
  }

  .channel-state {
    grid-column: 1;
    grid-row: 2;
  }

  .channel-actions {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
}
</style>
