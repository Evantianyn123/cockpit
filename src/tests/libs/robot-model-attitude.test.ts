import { Quaternion, Vector3 } from 'three'
import { expect, test } from 'vitest'

import { robotModelQuaternionFromNed } from '@/libs/robot-model-attitude'

const precision = 6

test('converts level NED attitude to the Three.js identity rotation', () => {
  const quaternion = robotModelQuaternionFromNed(0, 0, 0)

  expect(quaternion.angleTo(new Quaternion())).toBeCloseTo(0, precision)
})

test('turns Three.js forward toward starboard for a positive NED yaw', () => {
  const quaternion = robotModelQuaternionFromNed(0, 0, Math.PI / 2)
  const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion)

  expect(forward.x).toBeCloseTo(1, precision)
  expect(forward.y).toBeCloseTo(0, precision)
  expect(forward.z).toBeCloseTo(0, precision)
})

test('maps positive NED roll and pitch into the Three.js scene axes', () => {
  const rollQuaternion = robotModelQuaternionFromNed(Math.PI / 2, 0, 0)
  const pitchQuaternion = robotModelQuaternionFromNed(0, Math.PI / 2, 0)
  const rightAfterRoll = new Vector3(1, 0, 0).applyQuaternion(rollQuaternion)
  const forwardAfterPitch = new Vector3(0, 0, -1).applyQuaternion(pitchQuaternion)

  expect(rightAfterRoll.y).toBeCloseTo(-1, precision)
  expect(forwardAfterPitch.y).toBeCloseTo(1, precision)
})

test('keeps equivalent zero and full-turn yaw rotations continuous', () => {
  const zeroYaw = robotModelQuaternionFromNed(0, 0, 0)
  const fullTurnYaw = robotModelQuaternionFromNed(0, 0, Math.PI * 2)

  expect(Math.abs(zeroYaw.dot(fullTurnYaw))).toBeCloseTo(1, precision)
})
