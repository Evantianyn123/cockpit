import { Euler, Matrix4, Quaternion } from 'three'

const nedToThree = new Matrix4().set(0, 1, 0, 0, 0, 0, -1, 0, -1, 0, 0, 0, 0, 0, 0, 1)
const threeToNed = nedToThree.clone().invert()

/**
 * Converts an aircraft NED roll, pitch and yaw attitude into the Three.js scene coordinate system.
 * @param {number} roll - Vehicle roll in radians.
 * @param {number} pitch - Vehicle pitch in radians.
 * @param {number} yaw - Vehicle yaw in radians.
 * @returns {Quaternion} Quaternion for the Three.js scene coordinate system.
 */
export const robotModelQuaternionFromNed = (roll: number, pitch: number, yaw: number): Quaternion => {
  const nedRotation = new Matrix4().makeRotationFromQuaternion(
    new Quaternion().setFromEuler(new Euler(roll, pitch, yaw, 'ZYX'))
  )
  return new Quaternion().setFromRotationMatrix(nedRotation.premultiply(nedToThree).multiply(threeToNed)).normalize()
}
