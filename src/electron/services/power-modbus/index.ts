import { ipcMain } from 'electron'
import { z } from 'zod'

import type {
  ModbusReadRequest,
  ModbusWriteRequest,
  PowerModbusConnectionStatus,
  PowerModbusResult,
} from '@/types/power-modbus'
import type { PowerControlConnectionConfig } from '@/types/power-tcp-diagnostic'

import {
  DEFAULT_POWER_CONTROL_CONNECTION_CONFIG,
  powerControlConnectionConfigSchema,
} from '../../../libs/power-control/connection-config'
import { ModbusRtuTcpClient } from './client'

const byteSchema = z.number().int().min(1).max(247)
const addressSchema = z.number().int().min(0).max(0xffff)
const registerValueSchema = z.number().int().min(0).max(0xffff)
const readRequestSchema = z.object({
  functionCode: z.union([z.literal(3), z.literal(4)]),
  unitId: byteSchema,
  address: addressSchema,
  quantity: z.number().int().min(1).max(125),
})
const writeRequestSchema = z.union([
  z.object({
    functionCode: z.literal(5),
    unitId: byteSchema,
    address: addressSchema,
    value: z.union([z.literal(0), z.literal(1)]),
  }),
  z.object({ functionCode: z.literal(6), unitId: byteSchema, address: addressSchema, value: registerValueSchema }),
  z.object({
    functionCode: z.literal(16),
    unitId: byteSchema,
    address: addressSchema,
    values: z.array(registerValueSchema).min(1).max(123),
  }),
])

const invalidRequest = <T>(message: string): PowerModbusResult<T> => ({
  ok: false,
  error: { code: 'BAD_REQUEST', message },
})

let activeConnectionConfig: PowerControlConnectionConfig = { ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG }

const createPowerModbusClient = (config: PowerControlConnectionConfig): ModbusRtuTcpClient =>
  new ModbusRtuTcpClient({
    host: config.host,
    port: config.port,
    requestTimeoutMs: config.requestTimeoutMs,
  })

export let powerModbusClient = createPowerModbusClient(activeConnectionConfig)

/**
 * Replaces the managed Modbus client after a validated connection configuration is applied.
 * @param {PowerControlConnectionConfig} config - New persistent TCP endpoint and timeout.
 * @returns {Promise<PowerModbusResult<PowerModbusConnectionStatus>>} Disconnected status for the new endpoint.
 */
export const configurePowerModbusService = async (
  config: PowerControlConnectionConfig
): Promise<PowerModbusResult<PowerModbusConnectionStatus>> => {
  await powerModbusClient.disconnect()
  activeConnectionConfig = { ...config }
  powerModbusClient = createPowerModbusClient(activeConnectionConfig)
  return { ok: true, value: powerModbusClient.status }
}

/** Registers the IPC API used by the desktop-only power control Widget. */
export const setupPowerModbusService = (): void => {
  ipcMain.handle('power-modbus-configure', (_event, config: unknown) => {
    const parsed = powerControlConnectionConfigSchema.safeParse(config)
    return parsed.success
      ? configurePowerModbusService(parsed.data)
      : invalidRequest<PowerModbusConnectionStatus>('电源控制连接配置无效。')
  })
  ipcMain.handle('power-modbus-connect', () => powerModbusClient.connect())
  ipcMain.handle('power-modbus-disconnect', () => powerModbusClient.disconnect())
  ipcMain.handle('power-modbus-get-status', () => powerModbusClient.status)
  ipcMain.handle('power-modbus-read', (_event, request: unknown) => {
    const parsed = readRequestSchema.safeParse(request)
    return parsed.success
      ? powerModbusClient.read(parsed.data as ModbusReadRequest)
      : invalidRequest('Invalid Modbus read request.')
  })
  ipcMain.handle('power-modbus-write', (_event, request: unknown) => {
    const parsed = writeRequestSchema.safeParse(request)
    return parsed.success
      ? powerModbusClient.write(parsed.data as ModbusWriteRequest)
      : invalidRequest('Invalid Modbus write request.')
  })
}

/**
 * Closes the managed Modbus transport during Electron shutdown.
 * @returns {Promise<PowerModbusResult<unknown>>} Final connection state.
 */
export const closePowerModbusService = (): Promise<PowerModbusResult<unknown>> => powerModbusClient.disconnect()
