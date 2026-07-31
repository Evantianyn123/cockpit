import { z } from 'zod'

import type {
  PowerChannelState,
  PowerControlChannelConfig,
  PowerControlConfiguration,
  PowerControlExportConfiguration,
  PowerControlReadBatch,
} from '@/types/power-control'

import { powerControlConnectionConfigSchema } from './connection-config'

/** Persistent storage key for the reusable multi-channel power configuration. */
export const POWER_CONTROL_CONFIGURATION_STORAGE_KEY = 'cockpit-power-control-config-v1'

/** Maximum number of independently configured power outputs. */
export const MAX_POWER_CONTROL_CHANNELS = 32

const registerAddressSchema = z.number().int().min(0).max(0xffff)
const registerValueSchema = z.number().int().min(0).max(0xffff)
const channelSchema = z
  .object({
    id: z.number().int().min(1).max(MAX_POWER_CONTROL_CHANNELS),
    name: z.string().trim().min(1, '通道名称不能为空。').max(40, '通道名称不能超过 40 个字符。'),
    enabled: z.boolean(),
    writeFunctionCode: z.union([z.literal(5), z.literal(6), z.literal(16)]),
    writeAddress: registerAddressSchema,
    onValue: registerValueSchema,
    offValue: registerValueSchema,
    statusFunctionCode: z.union([z.literal(3), z.literal(4)]),
    statusAddress: registerAddressSchema,
    statusMask: registerValueSchema,
    statusOnValue: registerValueSchema,
    statusOffValue: registerValueSchema,
  })
  .superRefine((channel, context) => {
    if (channel.writeFunctionCode === 5 && (channel.onValue > 1 || channel.offValue > 1)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'FC5 的开启和关闭值只能是 0 或 1。',
        path: ['onValue'],
      })
    }
    if ((channel.statusOnValue & channel.statusMask) === (channel.statusOffValue & channel.statusMask)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '开启和关闭期望值在掩码后不能相同。',
        path: ['statusOnValue'],
      })
    }
  })

/** Runtime validation for one persisted power channel. */
export const powerControlChannelConfigSchema = channelSchema

/** Runtime validation for the persisted multi-channel configuration. */
export const powerControlConfigurationSchema = z
  .object({
    version: z.literal(1),
    channels: z.array(channelSchema).min(1).max(MAX_POWER_CONTROL_CHANNELS),
  })
  .superRefine((configuration, context) => {
    const ids = new Set<number>()
    configuration.channels.forEach((channel, index) => {
      if (ids.has(channel.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: '通道编号不能重复。',
          path: ['channels', index, 'id'],
        })
      }
      ids.add(channel.id)
    })
  })

/** Runtime validation for the complete JSON export file. */
export const powerControlExportConfigurationSchema = z.object({
  version: z.literal(1),
  connection: powerControlConnectionConfigSchema,
  powerControl: powerControlConfigurationSchema,
})

/**
 * Creates a disabled channel template.
 * @param {number} id - One-based channel number.
 * @returns {PowerControlChannelConfig} Default channel definition.
 */
export const createPowerControlChannel = (id: number): PowerControlChannelConfig => ({
  id,
  name: `电源通道 ${id}`,
  enabled: false,
  writeFunctionCode: 6,
  writeAddress: id - 1,
  onValue: 1,
  offValue: 0,
  statusFunctionCode: 3,
  statusAddress: id - 1,
  statusMask: 0xffff,
  statusOnValue: 1,
  statusOffValue: 0,
})

/**
 * Creates the first-use eight-channel disabled template.
 * @returns {PowerControlConfiguration} Initial editable configuration.
 */
export const createDefaultPowerControlConfiguration = (): PowerControlConfiguration => ({
  version: 1,
  channels: Array.from({ length: 8 }, (_value, index) => createPowerControlChannel(index + 1)),
})

/** Default configuration retained for storage initialization. */
export const DEFAULT_POWER_CONTROL_CONFIGURATION = createDefaultPowerControlConfiguration()

/**
 * Groups adjacent status registers with the same Modbus function code.
 * @param {ReadonlyArray<PowerControlChannelConfig>} channels - Configured channels to evaluate.
 * @returns {PowerControlReadBatch[]} Minimal set of read batches for enabled channels.
 */
export const buildPowerControlReadBatches = (
  channels: readonly PowerControlChannelConfig[]
): PowerControlReadBatch[] => {
  const sorted = channels
    .filter((channel) => channel.enabled)
    .slice()
    .sort(
      (first, second) =>
        first.statusFunctionCode - second.statusFunctionCode ||
        first.statusAddress - second.statusAddress ||
        first.id - second.id
    )
  const batches: PowerControlReadBatch[] = []

  for (const channel of sorted) {
    const currentBatch = batches.at(-1)
    const currentEndAddress = currentBatch ? currentBatch.address + currentBatch.quantity - 1 : -1
    const nextEndAddress = Math.max(currentEndAddress, channel.statusAddress)
    const isAdjacent =
      currentBatch &&
      channel.statusFunctionCode === currentBatch.functionCode &&
      channel.statusAddress <= currentEndAddress + 1
    const fitsModbusReadLimit = currentBatch && nextEndAddress - currentBatch.address + 1 <= 125

    if (isAdjacent && fitsModbusReadLimit) {
      currentBatch.quantity = nextEndAddress - currentBatch.address + 1
      currentBatch.channels.push(channel)
      continue
    }

    batches.push({
      functionCode: channel.statusFunctionCode,
      address: channel.statusAddress,
      quantity: 1,
      channels: [channel],
    })
  }

  return batches
}

/**
 * Converts one confirmation register into a visible channel state.
 * @param {PowerControlChannelConfig} channel - Channel status interpretation settings.
 * @param {number} registerValue - Raw 16-bit register value returned by Modbus.
 * @returns {PowerChannelState} Confirmed state after applying the configured mask.
 */
export const powerControlStateFromRegister = (
  channel: PowerControlChannelConfig,
  registerValue: number
): PowerChannelState => {
  const maskedValue = registerValue & channel.statusMask
  if (maskedValue === (channel.statusOnValue & channel.statusMask)) return 'on'
  if (maskedValue === (channel.statusOffValue & channel.statusMask)) return 'off'
  return 'unknown'
}

/**
 * Validates a portable import object without accepting unknown format versions.
 * @param {unknown} value - JSON value read from an import file.
 * @returns {PowerControlExportConfiguration | undefined} Validated import or undefined.
 */
export const parsePowerControlExportConfiguration = (value: unknown): PowerControlExportConfiguration | undefined => {
  const parsed = powerControlExportConfigurationSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
