import { describe, expect, test } from 'vitest'

import {
  buildPowerControlReadBatches,
  createPowerControlChannel,
  DEFAULT_POWER_CONTROL_CONFIGURATION,
  parsePowerControlExportConfiguration,
  powerControlConfigurationSchema,
  powerControlStateFromRegister,
} from '@/libs/power-control/configuration'

describe('power control configuration', () => {
  test('starts with eight disabled editable channels', () => {
    expect(DEFAULT_POWER_CONTROL_CONFIGURATION.channels).toHaveLength(8)
    expect(DEFAULT_POWER_CONTROL_CONFIGURATION.channels.every((channel) => !channel.enabled)).toBe(true)
    expect(DEFAULT_POWER_CONTROL_CONFIGURATION.channels.map((channel) => channel.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  test('rejects a coil command that uses non-boolean values', () => {
    const channel = { ...createPowerControlChannel(1), enabled: true, writeFunctionCode: 5 as const, onValue: 2 }
    const result = powerControlConfigurationSchema.safeParse({ version: 1, channels: [channel] })

    expect(result.success).toBe(false)
  })

  test('merges adjacent registers only when function code and read limit allow it', () => {
    const first = { ...createPowerControlChannel(1), enabled: true, statusAddress: 0 }
    const second = { ...createPowerControlChannel(2), enabled: true, statusAddress: 1 }
    const duplicate = { ...createPowerControlChannel(3), enabled: true, statusAddress: 1 }
    const inputRegister = {
      ...createPowerControlChannel(4),
      enabled: true,
      statusFunctionCode: 4 as const,
      statusAddress: 1,
    }
    const distant = { ...createPowerControlChannel(5), enabled: true, statusAddress: 125 }
    const disabled = { ...createPowerControlChannel(6), enabled: false, statusAddress: 2 }

    expect(buildPowerControlReadBatches([first, second, duplicate, inputRegister, distant, disabled])).toEqual([
      { functionCode: 3, address: 0, quantity: 2, channels: [first, second, duplicate] },
      { functionCode: 3, address: 125, quantity: 1, channels: [distant] },
      { functionCode: 4, address: 1, quantity: 1, channels: [inputRegister] },
    ])
  })

  test('derives the actual state after applying the configured bit mask', () => {
    const channel = {
      ...createPowerControlChannel(1),
      statusMask: 0x0004,
      statusOnValue: 0x0004,
      statusOffValue: 0,
    }

    expect(powerControlStateFromRegister(channel, 0x0005)).toBe('on')
    expect(powerControlStateFromRegister(channel, 0x0002)).toBe('off')
    expect(powerControlStateFromRegister(channel, 0x0006)).toBe('on')
  })

  test('accepts a versioned export with the shared formal connection configuration', () => {
    const exported = {
      version: 1,
      connection: { host: 'gateway.example', port: 502, unitId: 1, requestTimeoutMs: 1000 },
      powerControl: { version: 1, channels: [createPowerControlChannel(1)] },
    }

    expect(parsePowerControlExportConfiguration(exported)).toEqual(exported)
    expect(parsePowerControlExportConfiguration({ ...exported, version: 2 })).toBeUndefined()
  })
})
