import { describe, expect, test } from 'vitest'

import {
  appendModbusRtuCrc,
  buildModbusReadRequest,
  buildModbusWriteRequest,
  calculateModbusRtuCrc,
  getModbusRtuRequestLength,
  getModbusRtuResponseLength,
  hasValidModbusRtuCrc,
  ModbusProtocolError,
  parseModbusReadResponse,
  parseModbusWriteResponse,
} from '@/electron/services/power-modbus/protocol'

describe('Modbus RTU protocol', () => {
  test('calculates and serializes the standard FC3 CRC16 vector', () => {
    const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

    expect(calculateModbusRtuCrc(request)).toBe(0x0a84)
    expect(Array.from(appendModbusRtuCrc(request))).toEqual([0x01, 0x03, 0x00, 0x00, 0x00, 0x01, 0x84, 0x0a])
  })

  test('encodes FC3 and parses its matching register response', () => {
    const request = { functionCode: 3 as const, unitId: 1, address: 0, quantity: 1 }
    const frame = buildModbusReadRequest(request)
    const response = appendModbusRtuCrc(Buffer.from([0x01, 0x03, 0x02, 0x00, 0x01]))

    expect(getModbusRtuRequestLength(frame)).toBe(8)
    expect(getModbusRtuResponseLength(response)).toBe(7)
    expect(parseModbusReadResponse(response, request)).toEqual({ values: [1] })
  })

  test('encodes and confirms FC5, FC6, and FC16 writes', () => {
    const fc5 = { functionCode: 5 as const, unitId: 1, address: 2, value: 1 }
    const fc6 = { functionCode: 6 as const, unitId: 1, address: 3, value: 0x1234 }
    const fc16 = { functionCode: 16 as const, unitId: 1, address: 4, values: [6, 7] }

    expect(buildModbusWriteRequest(fc5).readUInt16BE(4)).toBe(0xff00)
    expect(parseModbusWriteResponse(buildModbusWriteRequest(fc5), fc5)).toEqual({ address: 2, quantity: 1, value: 1 })
    expect(parseModbusWriteResponse(buildModbusWriteRequest(fc6), fc6)).toEqual({
      address: 3,
      quantity: 1,
      value: 0x1234,
    })
    expect(parseModbusWriteResponse(appendModbusRtuCrc(Buffer.from([1, 16, 0, 4, 0, 2])), fc16)).toEqual({
      address: 4,
      quantity: 2,
    })
  })

  test('rejects invalid CRCs and Modbus exception responses', () => {
    const request = { functionCode: 3 as const, unitId: 1, address: 0, quantity: 1 }
    const invalidFrame = Buffer.from(buildModbusReadRequest(request))
    invalidFrame[invalidFrame.length - 1] ^= 0xff
    const exception = appendModbusRtuCrc(Buffer.from([1, 0x83, 2]))

    expect(hasValidModbusRtuCrc(invalidFrame)).toBe(false)
    expect(() => parseModbusReadResponse(invalidFrame, request)).toThrow('CRC')
    expect(() => parseModbusReadResponse(exception, request)).toThrow(ModbusProtocolError)
    expect(() => parseModbusReadResponse(exception, request)).toThrow('exception 2')
  })
})
