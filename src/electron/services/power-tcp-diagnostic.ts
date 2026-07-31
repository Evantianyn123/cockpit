import { type Socket, createConnection } from 'net'

import type {
  PowerControlConnectionConfig,
  PowerTcpDiagnosticErrorCode,
  PowerTcpDiagnosticEvent,
  PowerTcpDiagnosticResult,
  PowerTcpDiagnosticSendResponse,
  PowerTcpDiagnosticStatus,
} from '@/types/power-tcp-diagnostic'

import { DEFAULT_POWER_CONTROL_CONNECTION_CONFIG } from '../../libs/power-control/connection-config'

/** Callback that receives raw socket lifecycle and payload events. */
export type PowerTcpDiagnosticEventListener = (event: PowerTcpDiagnosticEvent) => void

/**
 * Holds the socket and promise resolver for one pending TCP connection.
 */
interface PendingConnection {
  /**
   * Socket that is waiting to connect.
   */
  socket: Socket
  /**
   * Resolves the IPC-visible connection result once.
   */
  settle: (result: PowerTcpDiagnosticResult<PowerTcpDiagnosticStatus>) => void
}

const failure = <T>(code: PowerTcpDiagnosticErrorCode, message: string): PowerTcpDiagnosticResult<T> => ({
  ok: false,
  error: { code, message },
})

/** Manages one manually controlled raw TCP diagnostic connection. */
export class PowerTcpDiagnosticClient {
  private connectionConfig: PowerControlConnectionConfig = { ...DEFAULT_POWER_CONTROL_CONNECTION_CONFIG }

  private state: PowerTcpDiagnosticStatus['state'] = 'disconnected'

  private lastError: string | undefined

  private socket: Socket | undefined

  private pendingConnection: PendingConnection | undefined

  /**
   * Creates a raw TCP diagnostic client.
   * @param {PowerTcpDiagnosticEventListener} eventListener - Receiver for serializable socket events.
   */
  public constructor(private readonly eventListener: PowerTcpDiagnosticEventListener = () => undefined) {}

  /**
   * Gets the current diagnostic endpoint status without sending data.
   * @returns {PowerTcpDiagnosticStatus} Current TCP diagnostic status.
   */
  public get status(): PowerTcpDiagnosticStatus {
    return {
      state: this.state,
      host: this.connectionConfig.host,
      port: this.connectionConfig.port,
      ...(this.lastError ? { lastError: this.lastError } : {}),
    }
  }

  /**
   * Opens one raw TCP client connection, replacing any existing diagnostic socket.
   * @param {PowerControlConnectionConfig} config - Validated TCP endpoint configuration.
   * @returns {Promise<PowerTcpDiagnosticResult<PowerTcpDiagnosticStatus>>} Connected status or a connection error.
   */
  public async connect(
    config: PowerControlConnectionConfig
  ): Promise<PowerTcpDiagnosticResult<PowerTcpDiagnosticStatus>> {
    await this.disconnect()
    this.connectionConfig = { ...config }
    this.state = 'connecting'
    this.lastError = undefined

    const socket = createConnection({ host: config.host, port: config.port })
    this.socket = socket
    socket.setNoDelay(true)

    return new Promise((resolve) => {
      let settled = false
      const connectionTimeout = setTimeout(() => {
        socket.destroy(new Error(`TCP connection timed out after ${config.requestTimeoutMs} ms.`))
      }, config.requestTimeoutMs)
      const settle = (result: PowerTcpDiagnosticResult<PowerTcpDiagnosticStatus>): void => {
        if (settled) return
        settled = true
        clearTimeout(connectionTimeout)
        if (this.pendingConnection?.socket === socket) this.pendingConnection = undefined
        resolve(result)
      }
      this.pendingConnection = { socket, settle }

      socket.once('connect', () => {
        if (socket !== this.socket) return
        this.state = 'connected'
        this.lastError = undefined
        this.emit({ type: 'connected', timestamp: Date.now() })
        settle({ ok: true, value: this.status })
      })
      socket.on('data', (data: Buffer) => this.handleData(socket, data))
      socket.on('error', (error) => {
        const wasConnecting = this.state === 'connecting'
        const message = this.handleError(socket, error)
        if (wasConnecting) settle(failure('CONNECTION_FAILED', message))
      })
      socket.on('close', () => {
        const wasConnecting = this.state === 'connecting'
        const message = this.handleClose(socket)
        if (wasConnecting && message) settle(failure('CONNECTION_FAILED', message))
      })
    })
  }

  /**
   * Deliberately closes the active diagnostic socket without reconnecting.
   * @returns {Promise<PowerTcpDiagnosticResult<PowerTcpDiagnosticStatus>>} Disconnected status.
   */
  public async disconnect(): Promise<PowerTcpDiagnosticResult<PowerTcpDiagnosticStatus>> {
    const socket = this.socket
    const wasActive = this.state !== 'disconnected' || socket !== undefined
    this.socket = undefined
    this.state = 'disconnected'
    this.lastError = undefined

    const pendingConnection = this.pendingConnection
    this.pendingConnection = undefined
    pendingConnection?.settle(failure('DISCONNECTED', 'TCP diagnostic connection was closed.'))
    if (socket && !socket.destroyed) socket.destroy()
    if (wasActive) this.emit({ type: 'disconnected', timestamp: Date.now(), message: '连接已断开。' })
    return { ok: true, value: this.status }
  }

  /**
   * Sends one raw payload through the active diagnostic socket.
   * @param {number[]} data - Validated bytes to send.
   * @returns {Promise<PowerTcpDiagnosticResult<PowerTcpDiagnosticSendResponse>>} Bytes written or an error.
   */
  public send(data: number[]): Promise<PowerTcpDiagnosticResult<PowerTcpDiagnosticSendResponse>> {
    const socket = this.socket
    if (this.state !== 'connected' || !socket || socket.destroyed || !socket.writable) {
      return Promise.resolve(failure('OFFLINE', 'TCP diagnostic connection is not available.'))
    }

    return new Promise((resolve) => {
      try {
        socket.write(Buffer.from(data), (error) => {
          if (error) {
            const message = this.handleError(socket, error)
            resolve(failure('SEND_FAILED', message))
            return
          }
          this.emit({ type: 'sent', timestamp: Date.now(), data: [...data] })
          resolve({ ok: true, value: { bytesSent: data.length } })
        })
      } catch (error) {
        const message = this.handleError(socket, error)
        resolve(failure('SEND_FAILED', message))
      }
    })
  }

  /**
   * Forwards each received TCP chunk without interpreting it as a Modbus frame.
   * @param {Socket} socket - Socket that received the bytes.
   * @param {Buffer} data - Raw incoming TCP bytes.
   * @returns {void}
   */
  private handleData(socket: Socket, data: Buffer): void {
    if (socket !== this.socket || this.state !== 'connected') return

    for (let offset = 0; offset < data.length; offset += 4096) {
      this.emit({ type: 'received', timestamp: Date.now(), data: Array.from(data.subarray(offset, offset + 4096)) })
    }
  }

  /**
   * Transitions an active socket to a failed disconnected state.
   * @param {Socket} socket - Socket that reported the error.
   * @param {unknown} error - Native socket failure.
   * @returns {string} Serializable error detail.
   */
  private handleError(socket: Socket, error: unknown): string {
    if (socket !== this.socket) return this.errorMessage(error)

    const message = this.errorMessage(error)
    this.lastError = message
    this.socket = undefined
    this.state = 'disconnected'
    this.emit({ type: 'error', timestamp: Date.now(), message })
    this.emit({ type: 'disconnected', timestamp: Date.now(), message })
    if (!socket.destroyed) socket.destroy()
    return message
  }

  /**
   * Transitions an active socket closed by its peer to a disconnected state.
   * @param {Socket} socket - Socket that closed.
   * @returns {string | undefined} Disconnect detail when the socket was active.
   */
  private handleClose(socket: Socket): string | undefined {
    if (socket !== this.socket) return undefined

    const message = this.lastError ?? 'TCP diagnostic server closed the connection.'
    this.lastError = message
    this.socket = undefined
    this.state = 'disconnected'
    this.emit({ type: 'disconnected', timestamp: Date.now(), message })
    return message
  }

  /**
   * Delivers a serializable event to the owning Electron service.
   * @param {PowerTcpDiagnosticEvent} event - Lifecycle or payload event.
   * @returns {void}
   */
  private emit(event: PowerTcpDiagnosticEvent): void {
    this.eventListener(event)
  }

  /**
   * Converts a thrown value into a stable diagnostic message.
   * @param {unknown} error - Native socket failure value.
   * @returns {string} Human-readable error detail.
   */
  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
