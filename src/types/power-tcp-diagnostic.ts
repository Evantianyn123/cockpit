/** Persistent TCP endpoint used by power-control diagnostics and later Modbus configuration. */
export interface PowerControlConnectionConfig {
  /** TCP Server address without a URI scheme. */
  host: string
  /** TCP Server port. */
  port: number
  /** Default Modbus RTU slave address reserved for M3. */
  unitId: number
  /** Connection and request timeout reserved for M3. */
  requestTimeoutMs: number
}

/** Observable state of the raw TCP diagnostic connection. */
export type PowerTcpDiagnosticState = 'disconnected' | 'connecting' | 'connected'

/** Serializable failure categories returned by the raw TCP diagnostic service. */
export type PowerTcpDiagnosticErrorCode =
  | 'BAD_REQUEST'
  | 'CONNECTION_FAILED'
  | 'DISCONNECTED'
  | 'OFFLINE'
  | 'SEND_FAILED'

/** Serializable TCP diagnostic failure. */
export interface PowerTcpDiagnosticError {
  /** Failure category. */
  code: PowerTcpDiagnosticErrorCode
  /** Human-readable diagnostic detail. */
  message: string
}

/** Result returned by TCP diagnostic IPC operations. */
export type PowerTcpDiagnosticResult<T> =
  | {
      /** Operation completed successfully. */
      ok: true
      /** Result value. */
      value: T
    }
  | {
      /** Operation failed. */
      ok: false
      /** Serializable error information. */
      error: PowerTcpDiagnosticError
    }

/** Current endpoint and state of the TCP diagnostic connection. */
export interface PowerTcpDiagnosticStatus {
  /** Connection lifecycle state. */
  state: PowerTcpDiagnosticState
  /** Active or last requested server host. */
  host: string
  /** Active or last requested server port. */
  port: number
  /** Most recent connection failure. */
  lastError?: string
}

/** One event forwarded from the main-process diagnostic socket. */
export interface PowerTcpDiagnosticEvent {
  /** Event type. */
  type: 'connected' | 'sent' | 'received' | 'disconnected' | 'error'
  /** Event time in milliseconds since the Unix epoch. */
  timestamp: number
  /** Raw bytes associated with sent or received events. */
  data?: number[]
  /** Detail associated with error or disconnect events. */
  message?: string
}

/** Successful send metadata. */
export interface PowerTcpDiagnosticSendResponse {
  /** Number of bytes accepted by the TCP socket. */
  bytesSent: number
}
