import { getStoredLocale } from '@/composables/useLocale'

/**
 * Spoken and shown sentence after a flight-mode change.
 * @param {string} modeLabel
 * @returns {string}
 */
export const formatVehicleModeChanged = (modeLabel: string): string => {
  if (getStoredLocale() !== 'zh-CN') return `Vehicle mode changed to ${modeLabel}.`
  return `飞行模式已切换为${modeLabel}。`
}

/**
 * Spoken and shown sentence after an arm state change.
 * @param {boolean} isArmed
 * @returns {string}
 */
export const formatVehicleArmed = (isArmed: boolean): string => {
  if (getStoredLocale() !== 'zh-CN') return isArmed ? 'Vehicle armed' : 'Vehicle disarmed'
  return isArmed ? '载具已解锁' : '载具已锁定'
}

/**
 * Spoken and shown sentence after a vehicle connection change.
 * @param {boolean} isOnline
 * @returns {string}
 */
export const formatVehicleConnection = (isOnline: boolean): string => {
  if (getStoredLocale() !== 'zh-CN') return isOnline ? 'Vehicle connected' : 'Vehicle disconnected'
  return isOnline ? '载具已连接' : '载具已断开'
}

/**
 * Snackbar after remapping a joystick button.
 * @param {string | number} buttonId
 * @param {string} actionName
 * @returns {string}
 */
export const formatButtonRemapped = (buttonId: string | number, actionName: string): string => {
  if (getStoredLocale() !== 'zh-CN') return `Button ${buttonId} remapped to function '${actionName}'.`
  return `按键 ${buttonId} 已映射为「${actionName}」。`
}

/**
 * Warning when the same action is mapped to more than one axis.
 * @param {string} actionName
 * @param {string} axis
 * @returns {string}
 */
export const formatUnmappingDuplicateAxis = (actionName: string, axis: string): string => {
  if (getStoredLocale() !== 'zh-CN') {
    return `Unmapping '${actionName}' from input ${axis} layout.\n              Cannot use same action on multiple axes.`
  }
  return `已从轴 ${axis} 取消映射「${actionName}」。同一动作不能用在多根轴上。`
}

/**
 * Video player overlay while a stream is connecting or loading.
 * @param {boolean} loaded
 * @param {boolean} connecting
 * @param {string} streamInfo
 * @returns {string}
 */
export const formatVideoStreamLoading = (loaded: boolean, connecting: boolean, streamInfo: string): string => {
  if (getStoredLocale() !== 'zh-CN') {
    if (loaded) return 'Stream loaded'
    return `${connecting ? 'Connecting to' : 'Loading'} stream ${streamInfo}`.trim()
  }
  if (loaded) return '视频流已加载'
  const prefix = connecting ? '正在连接视频流' : '正在加载视频流'
  return streamInfo ? `${prefix} ${streamInfo}` : prefix
}
