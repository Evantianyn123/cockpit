<template>
  <teleport to="body">
    <v-dialog :model-value="modelValue" max-width="720" @update:model-value="updateVisible">
      <v-card class="tcp-diagnostic-dialog" theme="dark">
        <v-card-title class="tcp-diagnostic-title">
          <span>TCP Server 连接测试</span>
          <span class="connection-state" :class="`connection-${diagnosticStatus.state}`">
            {{ connectionStateLabels[diagnosticStatus.state] }}
          </span>
          <v-btn v-tooltip.bottom="'关闭'" icon="mdi-close" size="small" variant="text" @click="closeDialog" />
        </v-card-title>

        <v-card-text class="tcp-diagnostic-content">
          <div class="tcp-config-grid">
            <v-text-field
              v-model="draftConfig.host"
              label="TCP Server 地址"
              density="compact"
              variant="outlined"
              hide-details
              :disabled="isBusy"
              @keydown.enter.prevent="connect"
            />
            <v-text-field
              v-model.number="draftConfig.port"
              label="端口"
              type="number"
              min="1"
              max="65535"
              density="compact"
              variant="outlined"
              hide-details
              :disabled="isBusy"
              @keydown.enter.prevent="connect"
            />
          </div>

          <div class="tcp-config-meta">
            从站地址 {{ draftConfig.unitId }}，超时 {{ draftConfig.requestTimeoutMs }} ms
          </div>

          <div class="tcp-connection-actions">
            <v-btn
              color="primary"
              prepend-icon="mdi-lan-connect"
              size="small"
              :loading="isBusy"
              :disabled="isBusy"
              @click="connect"
            >
              保存并应用
            </v-btn>
            <v-btn
              prepend-icon="mdi-lan-disconnect"
              size="small"
              variant="outlined"
              :disabled="isBusy || !isConnected"
              @click="disconnect"
            >
              断开
            </v-btn>
            <span class="tcp-active-endpoint">当前目标：{{ diagnosticStatus.host }}:{{ diagnosticStatus.port }}</span>
          </div>

          <p v-if="formError" class="tcp-form-error" role="alert">{{ formError }}</p>

          <div class="tcp-send-area">
            <v-textarea
              v-model="hexPayload"
              label="发送 HEX 数据"
              placeholder="01 03 00 00 00 01 84 0A"
              rows="2"
              auto-grow
              density="compact"
              variant="outlined"
              hide-details
              :disabled="isBusy || !isConnected"
            />
            <v-btn
              color="primary"
              prepend-icon="mdi-send"
              size="small"
              :disabled="isBusy || !isConnected || !parsedPayload.ok"
              @click="send"
            >
              发送
            </v-btn>
          </div>
          <p v-if="hexPayload && !parsedPayload.ok" class="tcp-form-error" role="alert">{{ parsedPayload.error }}</p>

          <section class="tcp-log-section" aria-label="TCP 数据收发日志">
            <div class="tcp-log-heading">
              <span>收发日志</span>
              <v-btn
                v-tooltip.bottom="'清空日志'"
                icon="mdi-delete-sweep"
                size="x-small"
                variant="text"
                @click="logs = []"
              />
            </div>
            <div class="tcp-log" role="log">
              <p v-if="logs.length === 0" class="tcp-empty-log">等待连接和数据收发。</p>
              <div v-for="entry in logs" :key="entry.id" class="tcp-log-entry" :class="`tcp-log-${entry.type}`">
                <span>{{ formatTime(entry.timestamp) }}</span>
                <span>{{ logTypeLabels[entry.type] }}</span>
                <span class="tcp-log-payload">{{ formatLogPayload(entry) }}</span>
              </div>
            </div>
          </section>
        </v-card-text>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import {
  DEFAULT_POWER_CONTROL_CONNECTION_CONFIG,
  formatHexPayload,
  parseHexPayload,
  POWER_CONTROL_CONNECTION_STORAGE_KEY,
  powerControlConnectionConfigSchema,
} from '@/libs/power-control/connection-config'
import { settingsManager } from '@/libs/settings-management'
import { isElectron } from '@/libs/utils'
import type {
  PowerControlConnectionConfig,
  PowerTcpDiagnosticEvent,
  PowerTcpDiagnosticStatus,
} from '@/types/power-tcp-diagnostic'

/**
 * One entry rendered in the raw TCP diagnostic history.
 */
interface TcpLogEntry {
  /**
   * Stable key for incremental rendering.
   */
  id: number
  /**
   * Socket lifecycle or raw byte direction.
   */
  type: PowerTcpDiagnosticEvent['type']
  /**
   * Local time when the event was received.
   */
  timestamp: number
  /**
   * Raw payload for send and receive events.
   */
  data?: number[]
  /**
   * Human-readable lifecycle or error detail.
   */
  message?: string
}

const props = defineProps<{
  /**
   * Controls whether the dialog is shown.
   */
  modelValue: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', visible: boolean): void
}>()

const connectionConfig = useBlueOsStorage<PowerControlConnectionConfig>(
  POWER_CONTROL_CONNECTION_STORAGE_KEY,
  DEFAULT_POWER_CONTROL_CONNECTION_CONFIG
)
const draftConfig = ref<PowerControlConnectionConfig>({ ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG })
const diagnosticStatus = ref<PowerTcpDiagnosticStatus>({
  state: 'disconnected',
  host: DEFAULT_POWER_CONTROL_CONNECTION_CONFIG.host,
  port: DEFAULT_POWER_CONTROL_CONNECTION_CONFIG.port,
})
const hexPayload = ref('')
const logs = ref<TcpLogEntry[]>([])
const formError = ref<string | undefined>()
const isBusy = ref(false)
let nextLogId = 0
let removeEventListener: (() => void) | undefined

const connectionStateLabels: Record<PowerTcpDiagnosticStatus['state'], string> = {
  connected: '已连接',
  connecting: '连接中',
  disconnected: '未连接',
}
const logTypeLabels: Record<PowerTcpDiagnosticEvent['type'], string> = {
  connected: '连接',
  sent: '发送',
  received: '接收',
  disconnected: '断开',
  error: '错误',
}
const parsedPayload = computed(() => parseHexPayload(hexPayload.value))
const isConnected = computed(() => diagnosticStatus.value.state === 'connected')

const formatLogPayload = (entry: TcpLogEntry): string =>
  entry.data ? `${entry.data.length} 字节  ${formatHexPayload(entry.data)}` : entry.message ?? ''

const savedConfig = (): PowerControlConnectionConfig => {
  const parsed = powerControlConnectionConfigSchema.safeParse(connectionConfig.value)
  return parsed.success ? parsed.data : { ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG }
}

const addLog = (event: PowerTcpDiagnosticEvent): void => {
  logs.value.push({ id: nextLogId++, ...event })
  if (logs.value.length > 200) logs.value.splice(0, logs.value.length - 200)
}

const refreshStatus = async (): Promise<void> => {
  if (!isElectron() || !window.electronAPI) return
  diagnosticStatus.value = await window.electronAPI.powerTcpDiagnosticGetStatus()
}

const saveAndApplyConfig = (): PowerControlConnectionConfig | undefined => {
  const parsed = powerControlConnectionConfigSchema.safeParse(draftConfig.value)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message ?? 'TCP Server 配置无效。'
    return undefined
  }

  const nextConfig = parsed.data
  connectionConfig.value = nextConfig
  void settingsManager.setKeyValue(POWER_CONTROL_CONNECTION_STORAGE_KEY, nextConfig)
  draftConfig.value = { ...nextConfig }
  formError.value = undefined
  return nextConfig
}

const connect = async (): Promise<void> => {
  if (!isElectron() || !window.electronAPI) return
  const config = saveAndApplyConfig()
  if (!config) return

  isBusy.value = true
  const result = await window.electronAPI.powerTcpDiagnosticConnect(config)
  if (!result.ok) formError.value = result.error.message
  else diagnosticStatus.value = result.value
  await refreshStatus()
  isBusy.value = false
}

const disconnect = async (): Promise<void> => {
  if (!isElectron() || !window.electronAPI) return

  isBusy.value = true
  const result = await window.electronAPI.powerTcpDiagnosticDisconnect()
  if (!result.ok) formError.value = result.error.message
  else diagnosticStatus.value = result.value
  isBusy.value = false
}

const send = async (): Promise<void> => {
  if (!isElectron() || !window.electronAPI || !parsedPayload.value.ok) return

  isBusy.value = true
  const result = await window.electronAPI.powerTcpDiagnosticSend(parsedPayload.value.value)
  if (!result.ok) formError.value = result.error.message
  else {
    formError.value = undefined
    hexPayload.value = ''
  }
  await refreshStatus()
  isBusy.value = false
}

const closeDialog = async (): Promise<void> => {
  await disconnect()
  emit('update:modelValue', false)
}

const updateVisible = (visible: boolean): void => {
  if (!visible) {
    void closeDialog()
    return
  }
  emit('update:modelValue', true)
}

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    draftConfig.value = { ...savedConfig() }
    formError.value = undefined
    void refreshStatus()
  },
  { immediate: true }
)

onMounted(() => {
  if (!isElectron() || !window.electronAPI) return
  removeEventListener = window.electronAPI.onPowerTcpDiagnosticEvent((event) => {
    addLog(event)
    void refreshStatus()
  })
})

onUnmounted(() => {
  removeEventListener?.()
  void disconnect()
})
</script>

<style scoped>
.tcp-diagnostic-dialog {
  border-radius: 8px;
}

.tcp-diagnostic-title,
.tcp-connection-actions,
.tcp-log-heading {
  display: flex;
  align-items: center;
}

.tcp-diagnostic-title {
  gap: 8px;
  font-size: 16px;
}

.tcp-diagnostic-title .v-btn {
  margin-left: auto;
}

.connection-state {
  padding: 2px 6px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 600;
}

.connection-connected {
  border-color: rgba(76, 175, 80, 0.48);
  color: #a5d6a7;
}

.connection-connecting {
  border-color: rgba(255, 224, 130, 0.38);
  color: #ffe082;
}

.tcp-diagnostic-content {
  display: grid;
  gap: 10px;
}

.tcp-config-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px;
  gap: 8px;
}

.tcp-config-meta,
.tcp-active-endpoint,
.tcp-form-error,
.tcp-empty-log,
.tcp-log-entry {
  font-size: 11px;
}

.tcp-config-meta,
.tcp-active-endpoint,
.tcp-empty-log {
  color: rgba(255, 255, 255, 0.62);
}

.tcp-connection-actions {
  gap: 8px;
}

.tcp-active-endpoint {
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tcp-form-error {
  margin: 0;
  color: #ef9a9a;
}

.tcp-send-area {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
}

.tcp-log-section {
  min-height: 176px;
  display: grid;
  gap: 4px;
}

.tcp-log-heading {
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  font-weight: 600;
}

.tcp-log {
  height: 160px;
  padding: 6px;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.18);
  font-family: Consolas, 'Courier New', monospace;
}

.tcp-empty-log {
  margin: 0;
}

.tcp-log-entry {
  display: grid;
  grid-template-columns: 64px 34px minmax(0, 1fr);
  gap: 6px;
  line-height: 18px;
}

.tcp-log-sent {
  color: #80cbc4;
}

.tcp-log-received {
  color: #bbdefb;
}

.tcp-log-error {
  color: #ef9a9a;
}

.tcp-log-disconnected {
  color: #ffe082;
}

.tcp-log-payload {
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .tcp-config-grid,
  .tcp-send-area {
    grid-template-columns: 1fr;
  }

  .tcp-connection-actions {
    flex-wrap: wrap;
  }

  .tcp-active-endpoint {
    width: 100%;
    margin-left: 0;
  }
}
</style>
