import { type Socket, createConnection } from 'net'

import type {
  ModbusReadRequest,
  ModbusReadResponse,
  ModbusWriteRequest,
  ModbusWriteResponse,
  PowerModbusConnectionState,
  PowerModbusConnectionStatus,
  PowerModbusErrorCode,
  PowerModbusResult,
} from '@/types/power-modbus'

import {
  buildModbusReadRequest,
  buildModbusWriteRequest,
  getModbusRtuResponseLength,
  hasValidModbusRtuCrc,
  ModbusProtocolError,
  parseModbusReadResponse,
  parseModbusWriteResponse,
} from './protocol'

/** Configuration for one persistent Modbus RTU-over-TCP client. */
export interface ModbusRtuTcpClientOptions {
  /** TCP server host. */
  host: string
  /** TCP server port. */
  port: number
  /** Maximum wait for one Modbus response. */
  requestTimeoutMs?: number
  /** Delay before opening a replacement socket. */
  reconnectDelayMs?: number
}

/** One queued frame and the response parser that owns it. */
interface PendingRequest<T> {
  /** Delivers the final serializable result. */
  resolve: (result: PowerModbusResult<T>) => void
  /** Decodes a CRC-validated Modbus frame. */
  parse: (frame: Buffer) => T
  /** Cancels the response timeout once settled. */
  timer?: ReturnType<typeof setTimeout>
}

const failure = <T>(code: PowerModbusErrorCode, message: string, exceptionCode?: number): PowerModbusResult<T> => ({
  ok: false,
  error: { code, message, exceptionCode },
})

/** Manages one persistent RTU-over-TCP session and serializes every Modbus request. */
export class ModbusRtuTcpClient {
  private readonly host: string

  private readonly port: number

  private readonly requestTimeoutMs: number

  private readonly reconnectDelayMs: number

  private connectionState: PowerModbusConnectionState = 'disconnected'

  private lastError: string | undefined

  private socket: Socket | undefined

  private receiveBuffer = Buffer.alloc(0)

  private connectionPromise: Promise<PowerModbusResult<PowerModbusConnectionStatus>> | undefined

  private reconnectTimer: ReturnType<typeof setTimeout> | undefined

  private reconnectEnabled = false

  private pendingRequest: PendingRequest<unknown> | undefined

  private readonly requestQueue: Array<() => void> = []

  /**
   * Creates a Modbus RTU client for a fixed TCP endpoint.
   * @param {ModbusRtuTcpClientOptions} options - Connection and timing options.
   */
  public constructor(options: ModbusRtuTcpClientOptions) {
    this.host = options.host
    this.port = options.port
    this.requestTimeoutMs = options.requestTimeoutMs ?? 1000
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1000
  }

  /**
   * Connects to the configured TCP endpoint and enables automatic reconnects.
   * @returns {Promise<PowerModbusResult<PowerModbusConnectionStatus>>} Connection result.
   */
  public connect(): Promise<PowerModbusResult<PowerModbusConnectionStatus>> {
    this.reconnectEnabled = true

    if (this.connectionState === 'connected') return Promise.resolve({ ok: true, value: this.status })
    if (this.connectionPromise) return this.connectionPromise

    this.clearReconnectTimer()
    const connection = this.openConnection(false)
    this.connectionPromise = connection
    void connection.finally(() => {
      if (this.connectionPromise === connection) this.connectionPromise = undefined
    })
    return connection
  }

  /**
   * Disconnects deliberately and cancels pending automatic reconnect attempts.
   * @returns {Promise<PowerModbusResult<PowerModbusConnectionStatus>>} Final disconnected status.
   */
  public async disconnect(): Promise<PowerModbusResult<PowerModbusConnectionStatus>> {
    this.reconnectEnabled = false
    this.clearReconnectTimer()
    this.connectionPromise = undefined
    this.rejectAllRequests('DISCONNECTED', 'Power Modbus connection was closed.')
    this.receiveBuffer = Buffer.alloc(0)

    const socket = this.socket
    this.socket = undefined
    this.setConnectionState('disconnected')
    if (socket && !socket.destroyed) socket.destroy()
    return { ok: true, value: this.status }
  }

  /**
   * Gets the latest transport status without sending a Modbus frame.
   * @returns {PowerModbusConnectionStatus} Current endpoint status.
   */
  public get status(): PowerModbusConnectionStatus {
    return {
      state: this.connectionState,
      host: this.host,
      port: this.port,
      ...(this.lastError ? { lastError: this.lastError } : {}),
    }
  }

  /**
   * Sends an FC3 or FC4 request after the session is connected.
   * @param {ModbusReadRequest} request - Register read definition.
   * @returns {Promise<PowerModbusResult<ModbusReadResponse>>} Parsed register values or a transport/protocol error.
   */
  public read(request: ModbusReadRequest): Promise<PowerModbusResult<ModbusReadResponse>> {
    try {
      return this.enqueue(buildModbusReadRequest(request), (frame) => parseModbusReadResponse(frame, request))
    } catch (error) {
      return Promise.resolve(failure('BAD_REQUEST', this.errorMessage(error)))
    }
  }

  /**
   * Sends an FC5, FC6, or FC16 request after the session is connected.
   * @param {ModbusWriteRequest} request - Register write definition.
   * @returns {Promise<PowerModbusResult<ModbusWriteResponse>>} Parsed confirmation or a transport/protocol error.
   */
  public write(request: ModbusWriteRequest): Promise<PowerModbusResult<ModbusWriteResponse>> {
    try {
      return this.enqueue(buildModbusWriteRequest(request), (frame) => parseModbusWriteResponse(frame, request))
    } catch (error) {
      return Promise.resolve(failure('BAD_REQUEST', this.errorMessage(error)))
    }
  }

  /**
   * Opens a replacement socket and attaches its receive and failure handlers.
   * @param {boolean} reconnecting - Whether this attempt follows a lost connection.
   * @returns {Promise<PowerModbusResult<PowerModbusConnectionStatus>>} Connection result.
   */
  private openConnection(reconnecting: boolean): Promise<PowerModbusResult<PowerModbusConnectionStatus>> {
    this.setConnectionState(reconnecting ? 'reconnecting' : 'connecting')
    this.receiveBuffer = Buffer.alloc(0)

    return new Promise((resolve) => {
      const socket = createConnection({ host: this.host, port: this.port })
      this.socket = socket
      socket.setNoDelay(true)
      socket.setKeepAlive(true, this.reconnectDelayMs)

      let settled = false
      const connectionTimeout = setTimeout(() => {
        const error = new Error('Power Modbus TCP connection timed out.')
        settle(failure('TIMEOUT', error.message))
        this.handleConnectionLoss(socket, error, 'TIMEOUT')
      }, this.requestTimeoutMs)
      const settle = (result: PowerModbusResult<PowerModbusConnectionStatus>): void => {
        if (settled) return
        settled = true
        clearTimeout(connectionTimeout)
        resolve(result)
      }

      socket.once('connect', () => {
        if (socket !== this.socket) return
        this.lastError = undefined
        this.setConnectionState('connected')
        settle({ ok: true, value: this.status })
      })
      socket.once('error', (error) => settle(failure('CONNECTION_FAILED', this.errorMessage(error))))
      socket.once('close', () =>
        settle(failure('CONNECTION_FAILED', this.lastError ?? 'Power Modbus TCP connection closed.'))
      )
      socket.on('data', (data: Buffer) => this.handleData(socket, data))
      socket.on('error', (error) => this.handleConnectionLoss(socket, error))
      socket.on('close', () => this.handleConnectionLoss(socket, new Error('Power Modbus TCP connection closed.')))
    })
  }

  /**
   * Adds a valid request to the serialized transport queue.
   * @param {Buffer} frame - Complete RTU request frame.
   * @param {(response: Buffer) => T} parse - Function that validates and parses the response frame.
   * @returns {Promise<PowerModbusResult<T>>} Parsed response or a transport error.
   */
  private enqueue<T>(frame: Buffer, parse: (response: Buffer) => T): Promise<PowerModbusResult<T>> {
    if (this.connectionState !== 'connected' || !this.socket || this.socket.destroyed) {
      return Promise.resolve(failure('OFFLINE', 'Power Modbus TCP connection is not available.'))
    }

    return new Promise((resolve) => {
      this.requestQueue.push(() => {
        const pending: PendingRequest<T> = { resolve, parse }
        this.pendingRequest = pending as PendingRequest<unknown>
        pending.timer = setTimeout(() => {
          if (this.pendingRequest !== pending) return
          this.handleConnectionLoss(this.socket, new Error('Power Modbus request timed out.'), 'TIMEOUT')
        }, this.requestTimeoutMs)

        const socket = this.socket
        if (!socket || socket.destroyed || !socket.writable) {
          this.settlePending(pending, failure('OFFLINE', 'Power Modbus TCP connection is not writable.'))
          return
        }

        socket.write(frame, (error) => {
          if (error) this.handleConnectionLoss(socket, error)
        })
      })
      this.processNextRequest()
    })
  }

  /**
   * Starts the next queued request when no response is pending.
   * @returns {void}
   */
  private processNextRequest(): void {
    if (this.pendingRequest || this.requestQueue.length === 0) return
    const nextRequest = this.requestQueue.shift()
    nextRequest?.()
  }

  /**
   * Buffers TCP data and resolves the single request that owns the response.
   * @param {Socket} socket - Socket that received the bytes.
   * @param {Buffer} data - New TCP payload.
   * @returns {void}
   */
  private handleData(socket: Socket, data: Buffer): void {
    if (socket !== this.socket || !this.pendingRequest) return
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data])

    while (this.receiveBuffer.length >= 4 && this.pendingRequest) {
      const frameLength = getModbusRtuResponseLength(this.receiveBuffer)
      if (frameLength === undefined) {
        this.receiveBuffer = this.receiveBuffer.subarray(1)
        continue
      }
      if (this.receiveBuffer.length < frameLength) return

      const frame = this.receiveBuffer.subarray(0, frameLength)
      if (!hasValidModbusRtuCrc(frame)) {
        this.receiveBuffer = this.receiveBuffer.subarray(1)
        continue
      }
      this.receiveBuffer = this.receiveBuffer.subarray(frameLength)

      const pending = this.pendingRequest
      try {
        this.settlePending(pending, { ok: true, value: pending.parse(frame) })
      } catch (error) {
        const protocolError = error instanceof ModbusProtocolError ? error : undefined
        this.settlePending(
          pending,
          failure(
            protocolError?.exceptionCode === undefined ? 'BAD_RESPONSE' : 'EXCEPTION',
            this.errorMessage(error),
            protocolError?.exceptionCode
          )
        )
      }
    }
  }

  /**
   * Clears the active timeout, resolves one request, then advances the queue.
   * @param {PendingRequest<T>} pending - Request currently awaiting a response.
   * @param {PowerModbusResult<T>} result - Result to return to the renderer.
   * @returns {void}
   */
  private settlePending<T>(pending: PendingRequest<T>, result: PowerModbusResult<T>): void {
    if (this.pendingRequest !== pending) return
    if (pending.timer) clearTimeout(pending.timer)
    this.pendingRequest = undefined
    pending.resolve(result)
    this.processNextRequest()
  }

  /**
   * Drops a failed socket, rejects in-flight requests, and schedules a reconnect when enabled.
   * @param {Socket | undefined} socket - Socket that reported the failure.
   * @param {unknown} error - Native transport or timeout error.
   * @param {PowerModbusErrorCode} code - Serializable failure category.
   * @returns {void}
   */
  private handleConnectionLoss(
    socket: Socket | undefined,
    error: unknown,
    code: PowerModbusErrorCode = 'OFFLINE'
  ): void {
    if (socket && socket !== this.socket) return

    this.lastError = this.errorMessage(error)
    const activeSocket = this.socket
    this.socket = undefined
    this.receiveBuffer = Buffer.alloc(0)
    this.rejectAllRequests(code, this.lastError)
    if (activeSocket && !activeSocket.destroyed) activeSocket.destroy()

    if (this.reconnectEnabled) {
      this.setConnectionState('reconnecting')
      this.scheduleReconnect()
    } else {
      this.setConnectionState('disconnected')
    }
  }

  /**
   * Rejects the active request and drains the serialized queue.
   * @param {PowerModbusErrorCode} code - Serializable failure category.
   * @param {string} message - Diagnostic message to return to callers.
   * @returns {void}
   */
  private rejectAllRequests(code: PowerModbusErrorCode, message: string): void {
    const pending = this.pendingRequest
    if (pending) this.settlePending(pending, failure(code, message))

    while (this.requestQueue.length > 0) {
      const queuedRequest = this.requestQueue.shift()
      queuedRequest?.()
      const queuedPending = this.pendingRequest
      if (queuedPending) this.settlePending(queuedPending, failure(code, message))
    }
  }

  /**
   * Schedules one delayed reconnect attempt.
   * @returns {void}
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.reconnectEnabled) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      if (!this.reconnectEnabled || this.connectionState === 'connected') return

      const connection = this.openConnection(true)
      this.connectionPromise = connection
      void connection.finally(() => {
        if (this.connectionPromise === connection) this.connectionPromise = undefined
        if (this.connectionState !== 'connected') this.scheduleReconnect()
      })
    }, this.reconnectDelayMs)
  }

  /**
   * Cancels a scheduled reconnect attempt.
   * @returns {void}
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
  }

  /**
   * Records the externally visible transport state.
   * @param {PowerModbusConnectionState} state - New connection state.
   * @returns {void}
   */
  private setConnectionState(state: PowerModbusConnectionState): void {
    this.connectionState = state
  }

  /**
   * Converts an unknown throw value into a serializable message.
   * @param {unknown} error - Error value returned by a dependency.
   * @returns {string} Human-readable error message.
   */
  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
