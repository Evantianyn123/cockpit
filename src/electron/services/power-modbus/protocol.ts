import type {
  ModbusReadRequest,
  ModbusReadResponse,
  ModbusWriteRequest,
  ModbusWriteResponse,
} from '@/types/power-modbus'

const CRC_SIZE = 2

/** Modbus protocol validation failure with an optional slave exception code. */
export class ModbusProtocolError extends Error {
  /**
   * Creates a protocol validation failure.
   * @param {string} message - Failure description.
   * @param {number | undefined} exceptionCode - Optional Modbus exception code.
   */
  public constructor(message: string, public readonly exceptionCode?: number) {
    super(message)
  }
}

const ensureIntegerInRange = (value: number, name: string, minimum: number, maximum: number): void => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}.`)
  }
}

const ensureUnitId = (unitId: number): void => ensureIntegerInRange(unitId, 'Unit ID', 1, 247)

const ensureAddress = (address: number): void => ensureIntegerInRange(address, 'Register address', 0, 0xffff)

const ensureRegisterValue = (value: number): void => ensureIntegerInRange(value, 'Register value', 0, 0xffff)

/**
 * Calculates the Modbus RTU CRC16 value for an ADU without its CRC bytes.
 * @param {Uint8Array} data - The Modbus RTU bytes to calculate.
 * @returns {number} CRC16 value before little-endian serialization.
 */
export const calculateModbusRtuCrc = (data: Uint8Array): number => {
  let crc = 0xffff

  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? (crc >> 1) ^ 0xa001 : crc >> 1
    }
  }

  return crc & 0xffff
}

/**
 * Adds a little-endian Modbus RTU CRC16 to an ADU.
 * @param {Uint8Array} data - The Modbus RTU bytes without CRC.
 * @returns {Buffer} Complete Modbus RTU frame.
 */
export const appendModbusRtuCrc = (data: Uint8Array): Buffer => {
  const frame = Buffer.alloc(data.length + CRC_SIZE)
  frame.set(data)
  frame.writeUInt16LE(calculateModbusRtuCrc(data), data.length)
  return frame
}

/**
 * Checks whether a Modbus RTU frame contains a valid CRC16.
 * @param {Uint8Array} frame - Complete Modbus RTU frame.
 * @returns {boolean} True when the frame is long enough and the CRC matches.
 */
export const hasValidModbusRtuCrc = (frame: Uint8Array): boolean => {
  if (frame.length < 4) return false
  const expected = frame[frame.length - 2] | (frame[frame.length - 1] << 8)
  return calculateModbusRtuCrc(frame.subarray(0, -CRC_SIZE)) === expected
}

/**
 * Builds an FC3 or FC4 Modbus RTU read request.
 * @param {ModbusReadRequest} request - Holding or input register read definition.
 * @returns {Buffer} Complete Modbus RTU request frame.
 */
export const buildModbusReadRequest = (request: ModbusReadRequest): Buffer => {
  ensureUnitId(request.unitId)
  ensureAddress(request.address)
  ensureIntegerInRange(request.quantity, 'Register quantity', 1, 125)

  const payload = Buffer.alloc(6)
  payload[0] = request.unitId
  payload[1] = request.functionCode
  payload.writeUInt16BE(request.address, 2)
  payload.writeUInt16BE(request.quantity, 4)
  return appendModbusRtuCrc(payload)
}

/**
 * Builds an FC5, FC6, or FC16 Modbus RTU write request.
 * @param {ModbusWriteRequest} request - Register write definition.
 * @returns {Buffer} Complete Modbus RTU request frame.
 */
export const buildModbusWriteRequest = (request: ModbusWriteRequest): Buffer => {
  ensureUnitId(request.unitId)
  ensureAddress(request.address)

  if (request.functionCode === 16) {
    ensureIntegerInRange(request.values.length, 'Register quantity', 1, 123)
    request.values.forEach((value) => ensureRegisterValue(value))

    const payload = Buffer.alloc(7 + request.values.length * 2)
    payload[0] = request.unitId
    payload[1] = request.functionCode
    payload.writeUInt16BE(request.address, 2)
    payload.writeUInt16BE(request.values.length, 4)
    payload[6] = request.values.length * 2
    request.values.forEach((value, index) => payload.writeUInt16BE(value, 7 + index * 2))
    return appendModbusRtuCrc(payload)
  }

  ensureRegisterValue(request.value)
  if (request.functionCode === 5 && request.value !== 0 && request.value !== 1) {
    throw new RangeError('FC5 values must be 0 or 1.')
  }

  const payload = Buffer.alloc(6)
  payload[0] = request.unitId
  payload[1] = request.functionCode
  payload.writeUInt16BE(request.address, 2)
  payload.writeUInt16BE(request.functionCode === 5 && request.value === 1 ? 0xff00 : request.value, 4)
  return appendModbusRtuCrc(payload)
}

/**
 * Gets the expected length of a complete RTU response based on its leading bytes.
 * @param {Uint8Array} data - Receive buffer that starts with an RTU response.
 * @returns {number | undefined} Frame length when enough header bytes are available.
 */
export const getModbusRtuResponseLength = (data: Uint8Array): number | undefined => {
  if (data.length < 2) return undefined

  const functionCode = data[1]
  if ((functionCode & 0x80) !== 0) return 5
  if (functionCode === 3 || functionCode === 4) {
    return data.length < 3 ? undefined : 5 + data[2]
  }
  if (functionCode === 5 || functionCode === 6 || functionCode === 16) return 8
  return undefined
}

/**
 * Gets the expected length of a complete RTU request based on its leading bytes.
 * @param {Uint8Array} data - Receive buffer that starts with an RTU request.
 * @returns {number | undefined} Frame length when enough header bytes are available.
 */
export const getModbusRtuRequestLength = (data: Uint8Array): number | undefined => {
  if (data.length < 2) return undefined

  const functionCode = data[1]
  if (functionCode === 3 || functionCode === 4 || functionCode === 5 || functionCode === 6) return 8
  if (functionCode === 16) return data.length < 7 ? undefined : 9 + data[6]
  return undefined
}

const assertExpectedResponse = (frame: Uint8Array, unitId: number, functionCode: number): void => {
  if (!hasValidModbusRtuCrc(frame)) throw new ModbusProtocolError('Response CRC validation failed.')
  if (frame[0] !== unitId) throw new ModbusProtocolError(`Unexpected response unit ID: ${frame[0]}.`)
  if (frame[1] === (functionCode | 0x80)) {
    throw new ModbusProtocolError(`Modbus exception ${frame[2]} for function ${functionCode}.`, frame[2])
  }
  if (frame[1] !== functionCode) throw new ModbusProtocolError(`Unexpected response function code: ${frame[1]}.`)
}

/**
 * Parses a successful FC3 or FC4 Modbus RTU response.
 * @param {Uint8Array} frame - Complete Modbus RTU response frame.
 * @param {ModbusReadRequest} request - Original read request.
 * @returns {ModbusReadResponse} Register values returned by the slave.
 */
export const parseModbusReadResponse = (frame: Buffer, request: ModbusReadRequest): ModbusReadResponse => {
  assertExpectedResponse(frame, request.unitId, request.functionCode)
  const byteCount = frame[2]
  if (byteCount !== request.quantity * 2 || frame.length !== byteCount + 5) {
    throw new ModbusProtocolError('Read response byte count does not match the request.')
  }

  return {
    values: Array.from({ length: request.quantity }, (_, index) => frame.readUInt16BE(3 + index * 2)),
  }
}

/**
 * Parses a successful FC5, FC6, or FC16 Modbus RTU response.
 * @param {Uint8Array} frame - Complete Modbus RTU response frame.
 * @param {ModbusWriteRequest} request - Original write request.
 * @returns {ModbusWriteResponse} Address and confirmed write value or quantity.
 */
export const parseModbusWriteResponse = (frame: Buffer, request: ModbusWriteRequest): ModbusWriteResponse => {
  assertExpectedResponse(frame, request.unitId, request.functionCode)
  if (frame.length !== 8) throw new ModbusProtocolError('Write response has an invalid length.')

  const address = frame.readUInt16BE(2)
  if (address !== request.address) throw new ModbusProtocolError(`Unexpected response address: ${address}.`)

  if (request.functionCode === 16) {
    const quantity = frame.readUInt16BE(4)
    if (quantity !== request.values.length) throw new ModbusProtocolError(`Unexpected response quantity: ${quantity}.`)
    return { address, quantity }
  }

  const wireValue = frame.readUInt16BE(4)
  const value = request.functionCode === 5 ? (wireValue === 0xff00 ? 1 : 0) : wireValue
  if (value !== request.value) throw new ModbusProtocolError(`Unexpected response value: ${value}.`)
  return { address, quantity: 1, value }
}
