import { beforeEach, describe, expect, test, vi } from 'vitest'

import { Type as VehicleType } from '@/libs/vehicle/vehicle'

const getStoredLocale = vi.fn(() => 'zh-CN')

vi.mock('@/composables/useLocale', () => ({
  getStoredLocale: (): string => getStoredLocale(),
}))

const { actionDisplayName } = await import('@/libs/i18n/action-display-name')
const { flightModeLabel } = await import('@/libs/i18n/flight-mode-labels')

describe('flightModeLabel', () => {
  beforeEach(() => {
    getStoredLocale.mockReturnValue('zh-CN')
  })

  test('keeps English when locale is en-US', () => {
    getStoredLocale.mockReturnValue('en-US')
    expect(flightModeLabel('ALT_HOLD', VehicleType.Sub, false)).toBe('ALT_HOLD')
  })

  test('maps Sub ALT_HOLD to depth hold', () => {
    expect(flightModeLabel('ALT_HOLD', VehicleType.Sub, false)).toBe('深度保持')
  })

  test('maps Copter ALT_HOLD to altitude hold', () => {
    expect(flightModeLabel('ALT_HOLD', VehicleType.Copter, false)).toBe('高度保持')
  })

  test('maps PX4 SIMPLE', () => {
    expect(flightModeLabel('SIMPLE', undefined, true)).toBe('简易模式')
  })
})

describe('actionDisplayName', () => {
  beforeEach(() => {
    getStoredLocale.mockReturnValue('zh-CN')
  })

  test('translates pre-registered ArduPilot mode actions without changing the suffix type', () => {
    expect(actionDisplayName('Alt Hold Mode (ArduPilot Sub)')).toBe('深度保持模式（ArduPilot Sub）')
    expect(actionDisplayName('Fly By Wire A Mode (ArduPilot Plane)')).toBe('线控 A模式（ArduPilot Plane）')
  })

  test('translates MAVLink Mode * names from its own table', () => {
    expect(actionDisplayName('Mode depth hold')).toBe('模式：深度保持')
  })

  test('leaves unknown user action names unchanged', () => {
    expect(actionDisplayName('My custom HTTP ping')).toBe('My custom HTTP ping')
  })
})
