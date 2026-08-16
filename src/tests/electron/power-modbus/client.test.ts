import { EventEmitter } from 'events'
import { type Socket, createConnection } from 'net'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { ModbusRtuTcpClient } from '@/electron/services/power-modbus/client'

vi.mock('net', () => ({ createConnection: vi.fn() }))

const createConnectionMock = vi.mocked(createConnection)
let client: ModbusRtuTcpClient | undefined

const createPendingSocket = (): Socket => {
  const socket = new EventEmitter() as unknown as Socket
  Object.assign(socket, {
    destroyed: false,
    writable: true,
    destroy: vi.fn(() => {
      const emitter = socket as unknown as EventEmitter
      emitter.emit('close')
      return socket
    }),
    setKeepAlive: vi.fn(),
    setNoDelay: vi.fn(),
  })
  return socket
}

afterEach(async () => {
  await client?.disconnect()
  client = undefined
  createConnectionMock.mockReset()
})

describe('ModbusRtuTcpClient connection lifecycle', () => {
  test('reports a bounded connection timeout before socket close handling', async () => {
    createConnectionMock.mockReturnValue(createPendingSocket())
    client = new ModbusRtuTcpClient({
      host: '127.0.0.1',
      port: 1502,
      requestTimeoutMs: 10,
      reconnectDelayMs: 1000,
    })

    await expect(client.connect()).resolves.toEqual({
      ok: false,
      error: { code: 'TIMEOUT', message: 'Power Modbus TCP connection timed out.' },
    })
    expect(client.status.state).toBe('reconnecting')
  })
})
