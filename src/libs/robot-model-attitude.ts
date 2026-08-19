/**
 * Vehicle attitude as delivered by the MAVLink ATTITUDE message: intrinsic Z-Y-X (yaw, then pitch,
 * then roll) Euler angles in radians, in the aeronautical NED frame (X north, Y east, Z down).
 */
export interface NedAttitude {
  /** Rotation about the body north/forward axis, in radians. */
  roll: number
  /** Rotation about the body east/right axis, in radians. */
  pitch: number
  /** Rotation about the body down axis, in radians. */
  yaw: number
}

/** A unit quaternion in Three.js coordinates (X right, Y up, Z toward the viewer). */
export interface AttitudeQuaternion {
  /** Vector part along Three.js X. */
  x: number
  /** Vector part along Three.js Y. */
  y: number
  /** Vector part along Three.js Z. */
  z: number
  /** Scalar part. */
  w: number
}

/**
 * Which local axis of the loaded model points along the vehicle's nose. glTF assets are not
 * consistent about this, so it has to be stated per model rather than assumed.
 */
export type ModelForwardAxis = '-z' | '+z' | '+x' | '-x'

/** A direction in Three.js coordinates. */
interface Vector3Tuple {
  /** Component along Three.js X. */
  x: number
  /** Component along Three.js Y. */
  y: number
  /** Component along Three.js Z. */
  z: number
}

/** A direction in the aeronautical NED frame. */
interface NedVector {
  /** Component along north. */
  north: number
  /** Component along east. */
  east: number
  /** Component along down. */
  down: number
}

/** The vehicle's own axes, expressed in Three.js world coordinates. */
interface BodyAxes {
  /** Direction the nose points. */
  forward: Vector3Tuple
  /** Direction the starboard side points. */
  right: Vector3Tuple
  /** Direction the top of the vehicle points. */
  up: Vector3Tuple
}

/**
 * NED is right-handed as north x east = down, and so is Three.js, so this basis swap is a proper
 * rotation: east becomes right, up becomes up, and north points into the screen, which is where a
 * default Three.js camera looks.
 * @param {NedVector} vector
 * @returns {Vector3Tuple}
 */
const nedToThree = ({ north, east, down }: NedVector): Vector3Tuple => ({ x: east, y: -down, z: -north })

const negate = ({ x, y, z }: Vector3Tuple): Vector3Tuple => ({ x: -x, y: -y, z: -z })

/**
 * Resolve the vehicle's body axes into Three.js world coordinates. The three returned vectors are
 * the columns of Rz(yaw)·Ry(pitch)·Rx(roll) after the NED-to-Three.js basis swap.
 * @param {NedAttitude} attitude
 * @returns {BodyAxes}
 */
const bodyAxesInThreeFrame = ({ roll, pitch, yaw }: NedAttitude): BodyAxes => {
  const sinRoll = Math.sin(roll)
  const cosRoll = Math.cos(roll)
  const sinPitch = Math.sin(pitch)
  const cosPitch = Math.cos(pitch)
  const sinYaw = Math.sin(yaw)
  const cosYaw = Math.cos(yaw)

  const forwardNed: NedVector = {
    north: cosPitch * cosYaw,
    east: cosPitch * sinYaw,
    down: -sinPitch,
  }
  const rightNed: NedVector = {
    north: sinRoll * sinPitch * cosYaw - cosRoll * sinYaw,
    east: sinRoll * sinPitch * sinYaw + cosRoll * cosYaw,
    down: sinRoll * cosPitch,
  }
  const downNed: NedVector = {
    north: cosRoll * sinPitch * cosYaw + sinRoll * sinYaw,
    east: cosRoll * sinPitch * sinYaw - sinRoll * cosYaw,
    down: cosRoll * cosPitch,
  }

  return {
    forward: nedToThree(forwardNed),
    right: nedToThree(rightNed),
    up: negate(nedToThree(downNed)),
  }
}

/**
 * Map the body axes onto the model's own local axes. Each case keeps the triad right-handed, so
 * that local X x local Y = local Z, which is what a rotation matrix requires.
 * @param {BodyAxes} axes
 * @param {ModelForwardAxis} forwardAxis
 * @returns {Vector3Tuple[]} The model's local X, Y and Z axes in world coordinates.
 */
const localAxesForModel = ({ forward, right, up }: BodyAxes, forwardAxis: ModelForwardAxis): Vector3Tuple[] => {
  switch (forwardAxis) {
    case '+z':
      return [negate(right), up, forward]
    case '+x':
      return [forward, up, right]
    case '-x':
      return [negate(forward), up, negate(right)]
    default:
      return [right, up, negate(forward)]
  }
}

/**
 * Extract a unit quaternion from a rotation matrix given by its column vectors, branching on the
 * largest diagonal term so the divisor never approaches zero.
 * @param {Vector3Tuple} colX
 * @param {Vector3Tuple} colY
 * @param {Vector3Tuple} colZ
 * @returns {AttitudeQuaternion}
 */
const quaternionFromBasis = (colX: Vector3Tuple, colY: Vector3Tuple, colZ: Vector3Tuple): AttitudeQuaternion => {
  const m11 = colX.x
  const m21 = colX.y
  const m31 = colX.z
  const m12 = colY.x
  const m22 = colY.y
  const m32 = colY.z
  const m13 = colZ.x
  const m23 = colZ.y
  const m33 = colZ.z

  const trace = m11 + m22 + m33

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    return { x: (m32 - m23) * s, y: (m13 - m31) * s, z: (m21 - m12) * s, w: 0.25 / s }
  }

  if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33)
    return { x: 0.25 * s, y: (m12 + m21) / s, z: (m13 + m31) / s, w: (m32 - m23) / s }
  }

  if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33)
    return { x: (m12 + m21) / s, y: 0.25 * s, z: (m23 + m32) / s, w: (m13 - m31) / s }
  }

  const s = 2 * Math.sqrt(1 + m33 - m11 - m22)
  return { x: (m13 + m31) / s, y: (m23 + m32) / s, z: 0.25 * s, w: (m21 - m12) / s }
}

/**
 * Convert a MAVLink NED attitude into the orientation to apply to the loaded model in Three.js.
 * A level, north-facing vehicle with a `-z` model yields the identity quaternion.
 * @param {NedAttitude} attitude Roll, pitch and yaw in radians, as they arrive from MAVLink.
 * @param {ModelForwardAxis} forwardAxis Which local axis of the model points along the nose.
 * @returns {AttitudeQuaternion}
 */
export const attitudeToModelQuaternion = (
  attitude: NedAttitude,
  forwardAxis: ModelForwardAxis = '-z'
): AttitudeQuaternion => {
  const [localX, localY, localZ] = localAxesForModel(bodyAxesInThreeFrame(attitude), forwardAxis)
  return quaternionFromBasis(localX, localY, localZ)
}

/**
 * Whether every attitude component is a usable finite number. The data lake hands out `undefined`
 * until the first ATTITUDE message arrives, and a partially populated attitude would otherwise be
 * rendered as a level vehicle, which reads as valid telemetry to the operator.
 * @param {Partial<NedAttitude> | undefined} attitude
 * @returns {boolean}
 */
export const isUsableAttitude = (attitude: Partial<NedAttitude> | undefined): attitude is NedAttitude =>
  attitude !== undefined &&
  [attitude.roll, attitude.pitch, attitude.yaw].every((angle) => typeof angle === 'number' && Number.isFinite(angle))
