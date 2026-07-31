import type { ModbusReadFunctionCode, ModbusWriteFunctionCode } from '@/types/power-modbus'
import type { PowerControlConnectionConfig } from '@/types/power-tcp-diagnostic'

/** Serializable state confirmed from a configured status register. */
export type PowerChannelState = 'on' | 'off' | 'unknown' | 'offline'

/** One independently configurable power output. */
export interface PowerControlChannelConfig {
  /** Stable one-based identifier used by the Widget runtime. */
  id: number
  /** Operator-facing channel name. */
  name: string
  /** Disabled channels are retained in configuration but never read or written. */
  enabled: boolean
  /** Modbus function code used for the requested power state. */
  writeFunctionCode: ModbusWriteFunctionCode
  /** Coil or holding-register address used for the command. */
  writeAddress: number
  /** Value sent for an on request. */
  onValue: number
  /** Value sent for an off request. */
  offValue: number
  /** Modbus function code used to read the confirmation register. */
  statusFunctionCode: ModbusReadFunctionCode
  /** Register address used to confirm the actual state. */
  statusAddress: number
  /** Bit mask applied to the confirmation register. */
  statusMask: number
  /** Masked value that means the power output is on. */
  statusOnValue: number
  /** Masked value that means the power output is off. */
  statusOffValue: number
}

/** Persisted multi-channel configuration used by the Power Control Widget. */
export interface PowerControlConfiguration {
  /** Configuration format version for future migration. */
  version: 1
  /** Ordered power channel definitions. */
  channels: PowerControlChannelConfig[]
}

/** Portable JSON configuration exported from the Power Control settings dialog. */
export interface PowerControlExportConfiguration {
  /** Portable configuration format version. */
  version: 1
  /** Shared TCP Server connection settings. */
  connection: PowerControlConnectionConfig
  /** Power channel definitions. */
  powerControl: PowerControlConfiguration
}

/** One Modbus read request that covers one or more adjacent status registers. */
export interface PowerControlReadBatch {
  /** Read function code common to this contiguous batch. */
  functionCode: ModbusReadFunctionCode
  /** First holding or input register in the batch. */
  address: number
  /** Number of registers read in the batch. */
  quantity: number
  /** Enabled channels whose status register is included in the batch. */
  channels: PowerControlChannelConfig[]
}
