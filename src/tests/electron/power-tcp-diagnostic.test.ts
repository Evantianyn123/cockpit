import { type Server, type Socket, createServer } from 'net'
import { afterEach, describe, expect, test } from 'vitest'

import { PowerTcpDiagnosticClient } from '@/electron/services/power-tcp-diagnostic'
import type { PowerTcpDiagnosticEvent } from '@/types/power-tcp-diagnostic'

let server: Server | undefined
let client: PowerTcpDiagnosticClient | undefined

afterEach(async () => {
  await client?.disconnect()
  await closeServer(server)
  client = undefined
  server = undefined
})

const waitFor = async (predicate: () => boolean, timeoutMs = 500): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for TCP diagnostic event.')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

const closeServer = async (target: Server | undefined): Promise<void> => {
  if (!target?.listening) return
  await new Promise<void>((resolve, reject) => target.close((error) => (error ? reject(error) : resolve())))
}

const startServer = async (handler: (socket: Socket) => void): Promise<number> => {
  server = createServer(handler)
  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject)
    server!.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('TCP test server did not provide a port.')
  return address.port
}

describe('PowerTcpDiagnosticClient', () => {
  test('sends and receives raw bytes through a TCP server', async () => {
    const events: PowerTcpDiagnosticEvent[] = []
    let receivedByServer = Buffer.alloc(0)
    const port = await startServer((socket) => {
      socket.on('data', (data) => {
        receivedByServer = Buffer.concat([receivedByServer, data])
        socket.write(Buffer.from([0xaa, 0x55]))
        socket.write(Buffer.from([0x01]))
      })
    })
    client = new PowerTcpDiagnosticClient((event) => events.push(event))

    await expect(client.connect({ host: '127.0.0.1', port, unitId: 1, requestTimeoutMs: 100 })).resolves.toMatchObject({
      ok: true,
      value: { state: 'connected', port },
    })
    await expect(client.send([0x01, 0x03, 0x00])).resolves.toEqual({ ok: true, value: { bytesSent: 3 } })

    await waitFor(
      () => events.filter((event) => event.type === 'received').flatMap((event) => event.data ?? []).length === 3
    )
    expect([...receivedByServer]).toEqual([0x01, 0x03, 0x00])
    expect(events.filter((event) => event.type === 'received').flatMap((event) => event.data ?? [])).toEqual([
      0xaa, 0x55, 0x01,
    ])
    expect(events.some((event) => event.type === 'sent')).toBe(true)
  })

  test('reports an unavailable server without reconnecting automatically', async () => {
    const events: PowerTcpDiagnosticEvent[] = []
    const port = await startServer(() => undefined)
    await closeServer(server)
    client = new PowerTcpDiagnosticClient((event) => events.push(event))

    await expect(client.connect({ host: '127.0.0.1', port, unitId: 1, requestTimeoutMs: 100 })).resolves.toMatchObject({
      ok: false,
      error: { code: 'CONNECTION_FAILED' },
    })
    expect(client.status.state).toBe('disconnected')
    expect(events.some((event) => event.type === 'error')).toBe(true)
  })

  test('replaces the active connection when a new endpoint is applied', async () => {
    const events: PowerTcpDiagnosticEvent[] = []
    const firstPort = await startServer(() => undefined)
    const secondServer = createServer()
    await new Promise<void>((resolve, reject) => {
      secondServer.once('error', reject)
      secondServer.listen(0, '127.0.0.1', resolve)
    })
    const secondAddress = secondServer.address()
    if (!secondAddress || typeof secondAddress === 'string')
      throw new Error('Second TCP test server did not provide a port.')

    client = new PowerTcpDiagnosticClient((event) => events.push(event))
    try {
      await expect(
        client.connect({ host: '127.0.0.1', port: firstPort, unitId: 1, requestTimeoutMs: 100 })
      ).resolves.toMatchObject({ ok: true, value: { port: firstPort } })
      await expect(
        client.connect({ host: '127.0.0.1', port: secondAddress.port, unitId: 1, requestTimeoutMs: 100 })
      ).resolves.toMatchObject({ ok: true, value: { port: secondAddress.port } })
      expect(client.status.port).toBe(secondAddress.port)
      expect(events.filter((event) => event.type === 'disconnected')).toHaveLength(1)
    } finally {
      await client?.disconnect()
      await new Promise<void>((resolve, reject) => secondServer.close((error) => (error ? reject(error) : resolve())))
    }
  })

  test('changes to disconnected when the server closes the socket', async () => {
    const events: PowerTcpDiagnosticEvent[] = []
    const port = await startServer((socket) => socket.destroy())
    client = new PowerTcpDiagnosticClient((event) => events.push(event))

    await expect(client.connect({ host: '127.0.0.1', port, unitId: 1, requestTimeoutMs: 100 })).resolves.toMatchObject({
      ok: true,
      value: { state: 'connected' },
    })
    await waitFor(() => client?.status.state === 'disconnected')
    expect(events.some((event) => event.type === 'disconnected')).toBe(true)
  })
})
