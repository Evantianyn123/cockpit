import { describe, expect, test } from 'vitest'

import {
  type AttitudeQuaternion,
  type ModelForwardAxis,
  type NedAttitude,
  attitudeToModelQuaternion,
  isUsableAttitude,
} from '@/libs/robot-model-attitude'
import { radians } from '@/libs/utils'

/**
 * Rotate a direction by a quaternion, so tests can assert where the model actually ends up
 * pointing instead of asserting opaque quaternion components.
 * @param {AttitudeQuaternion} q
 * @param {number[]} vector
 * @returns {number[]}
 */
const rotate = (q: AttitudeQuaternion, [x, y, z]: number[]): number[] => {
  const tx = 2 * (q.y * z - q.z * y)
  const ty = 2 * (q.z * x - q.x * z)
  const tz = 2 * (q.x * y - q.y * x)
  return [
    x + q.w * tx + (q.y * tz - q.z * ty),
    y + q.w * ty + (q.z * tx - q.x * tz),
    z + q.w * tz + (q.x * ty - q.y * tx),
  ]
}

/**
 * Where the model's nose points in world coordinates, for a model whose given local axis is forward.
 * @param {NedAttitude} attitude
 * @param {ModelForwardAxis} forwardAxis
 * @returns {number[]}
 */
const noseDirection = (attitude: NedAttitude, forwardAxis: ModelForwardAxis = '-z'): number[] => {
  const localForward = {
    '-z': [0, 0, -1],
    '+z': [0, 0, 1],
    '+x': [1, 0, 0],
    '-x': [-1, 0, 0],
  }[forwardAxis]
  return rotate(attitudeToModelQuaternion(attitude, forwardAxis), localForward)
}

const expectDirection = (actual: number[], expected: number[]): void => {
  actual.forEach((component, index) => expect(component).toBeCloseTo(expected[index], 6))
}

const level = { roll: 0, pitch: 0, yaw: 0 }

describe('attitudeToModelQuaternion', () => {
  test('a level, north-facing vehicle needs no rotation', () => {
    const q = attitudeToModelQuaternion(level)
    expectDirection([q.x, q.y, q.z, q.w], [0, 0, 0, 1])
  })

  test('yaw turns the nose toward Three.js +X, since east maps to right', () => {
    expectDirection(noseDirection({ ...level, yaw: radians(90) }), [1, 0, 0])
    expectDirection(noseDirection({ ...level, yaw: radians(180) }), [0, 0, 1])
    expectDirection(noseDirection({ ...level, yaw: radians(270) }), [-1, 0, 0])
  })

  test('pitching up lifts the nose toward Three.js +Y', () => {
    expectDirection(noseDirection({ ...level, pitch: radians(90) }), [0, 1, 0])
    expectDirection(noseDirection({ ...level, pitch: radians(-90) }), [0, -1, 0])
  })

  test('rolling right drops the starboard side, leaving the nose untouched', () => {
    const q = attitudeToModelQuaternion({ ...level, roll: radians(90) })
    // The model's local +X is its starboard side when it faces -Z.
    expectDirection(rotate(q, [1, 0, 0]), [0, -1, 0])
    expectDirection(rotate(q, [0, 0, -1]), [0, 0, -1])
  })

  test('yaw is continuous across the 0/360 wrap', () => {
    const atZero = attitudeToModelQuaternion(level)
    const atFullTurn = attitudeToModelQuaternion({ ...level, yaw: radians(360) })
    // A quaternion and its negation are the same rotation, so compare the rotation they produce.
    expectDirection(rotate(atZero, [0, 0, -1]), rotate(atFullTurn, [0, 0, -1]))
  })

  test('every attitude yields a unit quaternion, including the pitch-90 gimbal case', () => {
    const attitudes = [
      level,
      { roll: radians(90), pitch: radians(90), yaw: radians(90) },
      { roll: radians(-180), pitch: radians(-90), yaw: radians(45) },
      { roll: radians(30), pitch: radians(-60), yaw: radians(200) },
    ]
    attitudes.forEach((attitude) => {
      const q = attitudeToModelQuaternion(attitude)
      expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 6)
    })
  })

  test('the forward axis option redirects the nose without changing the attitude', () => {
    const yawedEast = { ...level, yaw: radians(90) }
    ;(['-z', '+z', '+x', '-x'] as ModelForwardAxis[]).forEach((axis) => {
      expectDirection(noseDirection(yawedEast, axis), [1, 0, 0])
    })
  })
})

describe('isUsableAttitude', () => {
  test('accepts a fully populated attitude', () => {
    expect(isUsableAttitude(level)).toBe(true)
  })

  test('rejects missing, partial and non-finite attitudes', () => {
    expect(isUsableAttitude(undefined)).toBe(false)
    expect(isUsableAttitude({ roll: 0, pitch: 0 })).toBe(false)
    expect(isUsableAttitude({ roll: 0, pitch: 0, yaw: NaN })).toBe(false)
    expect(isUsableAttitude({ roll: Infinity, pitch: 0, yaw: 0 })).toBe(false)
  })
})
