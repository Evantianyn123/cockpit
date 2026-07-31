export type ModbusReadFunctionCode = 3 | 4

export type ModbusWriteFunctionCode = 5 | 6 | 16

export type ModbusFunctionCode = ModbusReadFunctionCode | ModbusWriteFunctionCode

export type PowerModbusConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export type PowerModbusErrorCode =
  | 'BAD_REQUEST'
  | 'BAD_RESPONSE'
  | 'CONNECTION_FAILED'
  | 'DISCONNECTED'
  | 'EXCEPTION'
  | 'OFFLINE'
  | 'TIMEOUT'

/**
 *
 */
export interface PowerModbusError {
  /**
   *
   */
  code: PowerModbusErrorCode
  /**
   *
   */
  message: string
  /**
   *
   */
  exceptionCode?: number
}

export type PowerModbusResult<T> =
  | {
      /**
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee *
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
       */
      ok: true
      /**
oooooooooo *
oooooooooo
       */
      value: T
    }
  | {
      /**
vvvvvvvvvvvvvvv *
vvvvvvvvvvvvvvv
       */
      ok: false
      /**
ooooooooooo *
ooooooooooo
       */
      error: PowerModbusError
    }

/**
 *
 */
export interface PowerModbusConnectionStatus {
  /**
   *
   */
  state: PowerModbusConnectionState
  /**
   *
   */
  host: string
  /**
   *
   */
  port: number
  /**
   *
   */
  lastError?: string
}

/**
 *
 */
export interface ModbusReadRequest {
  /**
   *
   */
  functionCode: ModbusReadFunctionCode
  /**
   *
   */
  unitId: number
  /**
   *
   */
  address: number
  /**
   *
   */
  quantity: number
}

/**
 *
 */
export interface ModbusWriteSingleRequest {
  /**
   *
   */
  functionCode: 5 | 6
  /**
   *
   */
  unitId: number
  /**
   *
   */
  address: number
  /**
   *
   */
  value: number
}

/**
 *
 */
export interface ModbusWriteMultipleRequest {
  /**
   *
   */
  functionCode: 16
  /**
   *
   */
  unitId: number
  /**
   *
   */
  address: number
  /**
   *
   */
  values: number[]
}

export type ModbusWriteRequest = ModbusWriteSingleRequest | ModbusWriteMultipleRequest

/**
 *
 */
export interface ModbusReadResponse {
  /**
   *
   */
  values: number[]
}

/**
 *
 */
export interface ModbusWriteResponse {
  /**
   *
   */
  address: number
  /**
   *
   */
  quantity: number
  /**
   *
   */
  value?: number
}
