import { type WebContents, ipcMain } from 'electron'
import { z } from 'zod'

import type { PowerTcpDiagnosticResult } from '@/types/power-tcp-diagnostic'

import { powerControlConnectionConfigSchema } from '../../libs/power-control/connection-config'
import { PowerTcpDiagnosticClient } from './power-tcp-diagnostic'

const byteArraySchema = z.array(z.number().int().min(0).max(255)).min(1).max(1024)

let eventTarget: WebContents | undefined

const tcpDiagnosticClient = new PowerTcpDiagnosticClient((event) => {
  if (eventTarget && !eventTarget.isDestroyed()) eventTarget.send('power-tcp-diagnostic-event', event)
})

const invalidRequest = <T>(message: string): PowerTcpDiagnosticResult<T> => ({
  ok: false,
  error: { code: 'BAD_REQUEST', message },
})

/** Registers IPC handlers for the desktop-only raw TCP diagnostic connection. */
export const setupPowerTcpDiagnosticService = (): void => {
  ipcMain.handle('power-tcp-diagnostic-connect', (event, config: unknown) => {
    const parsed = powerControlConnectionConfigSchema.safeParse(config)
    if (!parsed.success) return invalidRequest('TCP Server 配置无效。')
    eventTarget = event.sender
    return tcpDiagnosticClient.connect(parsed.data)
  })
  ipcMain.handle('power-tcp-diagnostic-disconnect', () => tcpDiagnosticClient.disconnect())
  ipcMain.handle('power-tcp-diagnostic-get-status', () => tcpDiagnosticClient.status)
  ipcMain.handle('power-tcp-diagnostic-send', (_event, data: unknown) => {
    const parsed = byteArraySchema.safeParse(data)
    return parsed.success ? tcpDiagnosticClient.send(parsed.data) : invalidRequest('TCP HEX 数据无效。')
  })
}

/**
 * Closes the raw TCP diagnostic connection during Electron shutdown.
 * @returns {Promise<PowerTcpDiagnosticResult<unknown>>} Final diagnostic transport status.
 */
export const closePowerTcpDiagnosticService = (): Promise<PowerTcpDiagnosticResult<unknown>> =>
  tcpDiagnosticClient.disconnect()
