import { getStoredLocale } from '@/composables/useLocale'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'

import { flightModeLabel } from './flight-mode-labels'
import { translateRuntimeText } from './runtime-translate'

const ARDUPILOT_MODE_ACTION = /^(.+) Mode \(ArduPilot (Sub|Copter|Plane|Rover)\)$/

const mavlinkModeLabels: Record<string, string> = {
  'Mode manual': '模式：手动',
  'Mode stabilize': '模式：姿态保持',
  'Mode depth hold': '模式：深度保持',
  'Mode poshold': '模式：位置保持',
  'Mode auto': '模式：自动',
  'Mode circle': '模式：绕圈',
  'Mode guided': '模式：引导',
  'Mode acro': '模式：角速度控制',
  'Mode surftrak': '模式：离底定高',
}

const vehicleTypeFromActionSuffix: Record<string, VehicleType> = {
  Sub: VehicleType.Sub,
  Copter: VehicleType.Copter,
  Plane: VehicleType.Plane,
  Rover: VehicleType.Rover,
}

/**
 * Display name for a persisted protocol action name. Never used as a storage key.
 * @param {string} name
 * @returns {string}
 */
export const actionDisplayName = (name: string): string => {
  if (getStoredLocale() !== 'zh-CN' || !name) return name

  const mavlinkLabel = mavlinkModeLabels[name]
  if (mavlinkLabel) return mavlinkLabel

  const match = name.match(ARDUPILOT_MODE_ACTION)
  if (match) {
    const modeKey = match[1].toUpperCase().replace(/ /g, '_')
    const suffix = match[2]
    const vehicleType = vehicleTypeFromActionSuffix[suffix]
    const modeLabel = flightModeLabel(modeKey, vehicleType, false)
    return `${modeLabel}模式（ArduPilot ${suffix}）`
  }

  return translateRuntimeText(name)
}
