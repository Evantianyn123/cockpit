import { getStoredLocale } from '@/composables/useLocale'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'

const subLabels: Record<string, string> = {
  MANUAL: '手动',
  STABILIZE: '姿态保持',
  ACRO: '角速度控制',
  ALT_HOLD: '深度保持',
  POSHOLD: '位置保持',
  SURFTRAK: '离底定高',
  SURFACE: '自动上浮',
  AUTO: '自动',
  GUIDED: '引导',
  CIRCLE: '绕圈',
  MOTOR_DETECT: '电机检测',
}

const copterLabels: Record<string, string> = {
  STABILIZE: '姿态保持',
  ACRO: '角速度控制',
  ALT_HOLD: '高度保持',
  LOITER: '悬停',
  POSHOLD: '位置保持',
  LAND: '降落',
  RTL: '返航',
  SMART_RTL: '智能返航',
  AUTO: '自动',
  GUIDED: '引导',
  CIRCLE: '绕圈',
  DRIFT: '协调转向',
  SPORT: '运动',
  FLIP: '翻转',
  AUTOTUNE: '自动调参',
  BRAKE: '刹车',
  THROW: '抛飞',
  AVOID_ADSB: 'ADS-B 避让',
  GUIDED_NOGPS: '无 GPS 引导',
  FLOWHOLD: '光流悬停',
  FOLLOW: '跟随',
  ZIGZAG: '之字形',
  SYSTEMID: '系统辨识',
  AUTOROTATE: '自转',
  AUTO_RTL: '自动返航',
  TURTLE: '翻正',
}

const roverLabels: Record<string, string> = {
  MANUAL: '手动',
  ACRO: '速率控制',
  STEERING: '转向',
  HOLD: '驻停',
  LOITER: '定点保持',
  FOLLOW: '跟随',
  SIMPLE: '简易航向',
  DOCK: '自动对接',
  CIRCLE: '绕圈',
  AUTO: '自动',
  RTL: '返航',
  SMART_RTL: '智能返航',
  GUIDED: '引导',
  INITIALISING: '初始化中',
}

const planeLabels: Record<string, string> = {
  MANUAL: '手动',
  STABILIZE: '姿态保持',
  ACRO: '角速度控制',
  CIRCLE: '绕圈',
  TRAINING: '训练',
  FLY_BY_WIRE_A: '线控 A',
  FLY_BY_WIRE_B: '线控 B',
  CRUISE: '巡航',
  AUTOTUNE: '自动调参',
  AUTO: '自动',
  RTL: '返航',
  LOITER: '盘旋',
  TAKEOFF: '起飞',
  GUIDED: '引导',
  QSTABILIZE: '垂起姿态保持',
  QHOVER: '垂起悬停',
  QLOITER: '垂起盘旋',
  QLAND: '垂起降落',
  QRTL: '垂起返航',
  QAUTOTUNE: '垂起自动调参',
  QACRO: '垂起角速度控制',
  THERMAL: '热气流滑翔',
  LOITER_ALT_QLAND: '盘旋后垂起降落',
  INITIALISING: '初始化中',
  AVOID_ADSB: 'ADS-B 避让',
}

const px4Labels: Record<string, string> = {
  MANUAL: '手动',
  ALTCTL: '高度控制',
  POSCTL: '位置控制',
  AUTO: '自动',
  ACRO: '角速度控制',
  OFFBOARD: '外部控制',
  STABILIZED: '姿态保持',
  RATTITUDE_LEGACY: '速率姿态（旧）',
  SIMPLE: '简易模式',
  TERMINATION: '终止',
}

const ardupilotLabels: Partial<Record<VehicleType, Record<string, string>>> = {
  [VehicleType.Sub]: subLabels,
  [VehicleType.Copter]: copterLabels,
  [VehicleType.Rover]: roverLabels,
  [VehicleType.Plane]: planeLabels,
}

/**
 * Display label for a persisted English flight-mode key.
 * @param {string} modeKey
 * @param {VehicleType | undefined} vehicleType
 * @param {boolean} isPx4
 * @returns {string}
 */
export const flightModeLabel = (modeKey: string, vehicleType: VehicleType | undefined, isPx4: boolean): string => {
  if (getStoredLocale() !== 'zh-CN' || !modeKey) return modeKey
  const table = isPx4 ? px4Labels : vehicleType ? ardupilotLabels[vehicleType] : undefined
  return table?.[modeKey] ?? modeKey
}
