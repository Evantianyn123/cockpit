import { describe, expect, test } from 'vitest'

import {
  DEFAULT_POWER_CONTROL_CONNECTION_CONFIG,
  parseHexPayload,
  powerControlConnectionConfigSchema,
} from '@/libs/power-control/connection-config'

describe('power-control connection configuration', () => {
  test('accepts IPv4, host names, and IPv6 without a URI scheme', () => {
    expect(powerControlConnectionConfigSchema.parse(DEFAULT_POWER_CONTROL_CONNECTION_CONFIG)).toEqual(
      DEFAULT_POWER_CONTROL_CONNECTION_CONFIG
    )
    expect(
      powerControlConnectionConfigSchema.parse({ ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG, host: 'sscom.local' }).host
    ).toBe('sscom.local')
    expect(
      powerControlConnectionConfigSchema.parse({ ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG, host: '[::1]' }).host
    ).toBe('::1')
  })

  test('rejects invalid TCP endpoint fields', () => {
    expect(
      powerControlConnectionConfigSchema.safeParse({
        ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG,
        host: 'tcp://127.0.0.1',
      }).success
    ).toBe(false)
    expect(
      powerControlConnectionConfigSchema.safeParse({ ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG, port: 0 }).success
    ).toBe(false)
    expect(
      powerControlConnectionConfigSchema.safeParse({ ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG, unitId: 248 }).success
    ).toBe(false)
  })
})

describe('parseHexPayload', () => {
  test('parses SSCOM-compatible separators and prefixes', () => {
    expect(parseHexPayload('0x01, 03 0A')).toEqual({ ok: true, value: [0x01, 0x03, 0x0a] })
  })

  test('rejects incomplete and invalid payloads', () => {
    expect(parseHexPayload('01 0')).toMatchObject({ ok: false })
    expect(parseHexPayload('01 GG')).toMatchObject({ ok: false })
    expect(parseHexPayload('')).toMatchObject({ ok: false })
  })
})
