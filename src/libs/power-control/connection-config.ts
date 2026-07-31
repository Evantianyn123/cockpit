import { z } from 'zod'

import type { PowerControlConnectionConfig } from '@/types/power-tcp-diagnostic'

/** Persistent setting shared by TCP diagnostics, M3 configuration, and M4 commissioning. */
export const POWER_CONTROL_CONNECTION_STORAGE_KEY = 'cockpit-power-control-connection-v1'

/** Safe default that does not overlap with the M2 development Modbus simulator. */
export const DEFAULT_POWER_CONTROL_CONNECTION_CONFIG: PowerControlConnectionConfig = {
  host: '127.0.0.1',
  port: 1600,
  unitId: 1,
  requestTimeoutMs: 1000,
}

const hostSchema = z
  .string()
  .trim()
  .transform((value) => (value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value))
  .pipe(
    z
      .string()
      .min(1, 'TCP Server 地址不能为空。')
      .max(253, 'TCP Server 地址过长。')
      .refine((value) => !value.includes('://'), 'TCP Server 地址不能包含协议前缀。')
      .refine((value) => !/[\\/\s]/.test(value), 'TCP Server 地址格式无效。')
  )

/** Runtime validation for the persistent power-control TCP endpoint. */
export const powerControlConnectionConfigSchema = z.object({
  host: hostSchema,
  port: z.number().int().min(1, '端口必须在 1 到 65535 之间。').max(65535, '端口必须在 1 到 65535 之间。'),
  unitId: z.number().int().min(1, '从站地址必须在 1 到 247 之间。').max(247, '从站地址必须在 1 到 247 之间。'),
  requestTimeoutMs: z
    .number()
    .int()
    .min(100, '超时必须在 100 到 10000 毫秒之间。')
    .max(10000, '超时必须在 100 到 10000 毫秒之间。'),
})

/** Result of parsing a user-entered hexadecimal byte sequence. */
export type HexPayloadParseResult =
  | {
      /**
       * Indicates that every input character was parsed into a byte.
       */
      ok: true
      /**
       * Parsed raw bytes.
       */
      value: number[]
    }
  | {
      /**
       * Indicates that the input is not a valid byte sequence.
       */
      ok: false
      /**
       * User-facing validation message.
       */
      error: string
    }

/**
 * Parses an SSCOM-compatible hexadecimal byte sequence.
 * @param {string} input - Hexadecimal text with optional spaces, commas, and 0x prefixes.
 * @returns {HexPayloadParseResult} Parsed bytes or a validation error.
 */
export const parseHexPayload = (input: string): HexPayloadParseResult => {
  const compact = input.replace(/0x/gi, '').replace(/[\s,]/g, '')
  if (compact.length === 0) return { ok: false, error: '请输入 HEX 数据。' }
  if (compact.length % 2 !== 0) return { ok: false, error: 'HEX 数据必须由完整字节组成。' }
  if (!/^[\da-f]+$/i.test(compact)) return { ok: false, error: 'HEX 数据包含无效字符。' }

  const bytes = Array.from({ length: compact.length / 2 }, (_, index) =>
    Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16)
  )
  if (bytes.length > 1024) return { ok: false, error: '单次发送最多 1024 字节。' }
  return { ok: true, value: bytes }
}

/**
 * Formats raw bytes for compact diagnostic display.
 * @param {number[]} data - Raw bytes.
 * @returns {string} Uppercase hexadecimal bytes separated by spaces.
 */
export const formatHexPayload = (data: readonly number[]): string =>
  data.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')
