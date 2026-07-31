<template>
  <section class="power-control-widget" aria-label="电源控制">
    <header class="power-control-header">
      <div class="widget-title">
        <v-icon icon="mdi-power-plug" size="16" />
        <span>电源控制</span>
        <span class="integration-label">正式配置</span>
      </div>
      <div class="header-actions">
        <v-btn
          v-if="isElectron()"
          v-tooltip.bottom="'电源控制设置'"
          icon="mdi-cog-outline"
          size="x-small"
          variant="text"
          @click.stop="settingsDialogOpen = true"
        />
        <v-btn
          v-if="isElectron()"
          v-tooltip.bottom="'原始 TCP 连接测试'"
          icon="mdi-lan-connect"
          size="x-small"
          variant="text"
          @click.stop="tcpTestDialogOpen = true"
        />
        <span class="connection-state" :class="`connection-${connectionStatus.state}`">
          {{ connectionStateLabels[connectionStatus.state] }}
        </span>
      </div>
    </header>

    <div class="connection-details">
      {{ connectionStatus.host }}:{{ connectionStatus.port }} · 从站 {{ activeConnectionConfig.unitId }} ·
      {{ activeChannels.length }} 路已启用
    </div>

    <div v-if="activeChannels.length === 0" class="empty-state">
      <v-icon icon="mdi-power-settings" size="18" />
      <span>尚未启用电源通道。</span>
    </div>
    <div v-else class="channel-list">
      <div
        v-for="channel in activeChannels"
        :key="channel.id"
        class="channel-row"
        :data-power-state="displayedState(channel)"
      >
        <div class="channel-identity">
          <span class="channel-number">{{ String(channel.id).padStart(2, '0') }}</span>
          <span class="channel-name">{{ channel.name }}</span>
        </div>

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
            :aria-label="`${channel.name}开启`"
            @click.stop="requestState(channel, 'on')"
          >
            开启
          </v-btn>
          <v-btn
            prepend-icon="mdi-power-off"
            :color="runtimeFor(channel).actualState === 'off' ? '#c62828' : undefined"
            :variant="runtimeFor(channel).actualState === 'off' ? 'flat' : 'outlined'"
            size="small"
            :disabled="isActionDisabled(channel)"
            :aria-label="`${channel.name}关闭`"
            @click.stop="requestState(channel, 'off')"
          >
            关闭
          </v-btn>
        </div>
      </div>
    </div>

    <p class="transport-message" :title="transportMessage">{{ transportMessage }}</p>
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
    <PowerTcpConnectionTestDialog v-if="isElectron()" v-model="tcpTestDialogOpen" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, onUnmounted, ref, toRefs } from 'vue'

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
const transportMessage = ref('正在加载正式电源控制配置。')
const isTransportBusy = ref(false)
const settingsDialogOpen = ref(false)
const tcpTestDialogOpen = ref(false)
const stateMeta: Record<PowerDisplayedState, string> = {
  on: '已开启',
  off: '已关闭',
  unknown: '未知',
  offline: '离线',
  executing: '执行中',
}
const connectionStateLabels: Record<PowerModbusConnectionStatus['state'], string> = {
  connected: '在线',
  connecting: '连接中',
  disconnected: '离线',
  reconnecting: '重连中',
}

let pollTimer: ReturnType<typeof window.setInterval> | undefined
let lifecycleGeneration = 0
let lastSuccessfulReadAt = 0

const activeChannels = computed(() => powerControlConfiguration.value.channels.filter((channel) => channel.enabled))

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
      lastError: '电源控制仅支持 Cockpit 桌面版。',
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
    transportMessage.value = '尚未启用电源通道。'
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
      transportMessage.value = result.error.message
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
  transportMessage.value = `已读回 ${batches.length} 组状态寄存器。`
  return true
}

const pollChannels = async (): Promise<void> => {
  if (isTransportBusy.value) return
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
    transportMessage.value = result.error.message
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
    transportMessage.value = '电源控制仅支持 Cockpit 桌面版。'
    return
  }

  if (!(await configureConnection(activeConnectionConfig.value))) return
  const result = await window.electronAPI.powerModbusConnect()
  if (!result.ok) transportMessage.value = result.error.message
  else connectionStatus.value = result.value
  await pollChannels()
}

const requestState = async (channel: PowerControlChannelConfig, command: PowerCommand): Promise<void> => {
  if (isActionDisabled(channel) || !window.electronAPI) return

  const generation = lifecycleGeneration
  isTransportBusy.value = true
  updateRuntime(channel.id, { pendingCommand: command })
  transportMessage.value = `正在向 ${channel.name} 发送${command === 'on' ? '开启' : '关闭'}指令。`
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
      transportMessage.value = writeResult.error.message
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

  lifecycleGeneration += 1
  resetRuntime()
  isTransportBusy.value = true
  try {
    if (!(await configureConnection(configuration.connection))) return
    const result = await window.electronAPI!.powerModbusConnect()
    if (!result.ok) transportMessage.value = result.error.message
    else {
      connectionStatus.value = result.value
      transportMessage.value = '配置已应用，正在读取状态寄存器。'
      await readConfiguredChannels(lifecycleGeneration)
    }
  } finally {
    isTransportBusy.value = false
  }
}

const testConnection = async (): Promise<void> => {
  if (!window.electronAPI) return
  const result = await window.electronAPI.powerModbusConnect()
  if (!result.ok) transportMessage.value = result.error.message
  else {
    connectionStatus.value = result.value
    transportMessage.value = `连接测试通过：${result.value.host}:${result.value.port}`
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
      transportMessage.value = result.error.message
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
    transportMessage.value = `${channel.name} 只读测试：寄存器 ${channel.statusAddress} = ${registerValue ?? '无数据'}`
  } finally {
    if (generation === lifecycleGeneration) isTransportBusy.value = false
  }
}

onBeforeMount(() => {
  widget.value.options = {
    powerControlVersion: 1,
    ...widget.value.options,
  }
  activeConnectionConfig.value = { ...savedConnectionConfig() }
  powerControlConfiguration.value = savedPowerControlConfiguration()
  resetRuntime()
})

onMounted(() => {
  void connectAndPoll()
  pollTimer = window.setInterval(() => void pollChannels(), 1000)
})

onUnmounted(() => {
  lifecycleGeneration += 1
  if (pollTimer !== undefined) window.clearInterval(pollTimer)
  void window.electronAPI?.powerModbusDisconnect()
})
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

.power-control-header,
.widget-title,
.header-actions,
.channel-identity,
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

.integration-label,
.connection-state {
  padding: 1px 4px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
}

.integration-label {
  color: #ffe082;
  border-color: rgba(255, 224, 130, 0.38);
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

.connection-details,
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
  min-height: 44px;
  padding: 2px 7px;
  display: grid;
  grid-template-columns: minmax(118px, 1fr) minmax(80px, 0.65fr) 150px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.channel-identity {
  min-width: 0;
  gap: 7px;
}

.channel-number {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
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
  width: 72px;
  height: 29px;
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

  .integration-label {
    display: none;
  }

  .channel-row {
    grid-template-columns: minmax(100px, 1fr) 150px;
    gap: 2px 8px;
    padding: 5px 7px;
  }

  .channel-state {
    grid-column: 1;
    grid-row: 2;
    padding-left: 31px;
  }

  .channel-actions {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
}
</style>
