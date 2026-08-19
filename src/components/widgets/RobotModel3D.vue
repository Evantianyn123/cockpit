<template>
  <div class="main" :style="{ backgroundColor: widget.options.backgroundColor }">
    <canvas ref="canvasRef" class="w-full h-full block" />
    <div v-if="statusMessage" class="status-overlay">
      <p class="text-center text-white text-sm px-4">{{ statusMessage }}</p>
    </div>
  </div>
  <InteractionDialog
    v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen"
    title="3D model config"
    variant="text-only"
  >
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto -mr-2 -mt-12"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[85vw]' : 'max-w-[50vw]'"
      >
        <ExpansiblePanel no-top-divider no-bottom-divider is-expanded compact>
          <template #title>Attitude Source</template>
          <template #content>
            <div class="flex flex-col gap-y-2 py-2">
              <v-text-field
                v-for="source in attitudeSources"
                :key="source.optionKey"
                :model-value="widget.options[source.optionKey]"
                :label="source.label"
                variant="outlined"
                density="compact"
                hide-details
                @update:model-value="(value: string) => updateAttitudeSource(source.optionKey, value)"
              />
            </div>
          </template>
        </ExpansiblePanel>

        <ExpansiblePanel no-top-divider no-bottom-divider compact :is-expanded="!interfaceStore.isOnSmallScreen">
          <template #title>Model</template>
          <template #content>
            <div class="flex flex-col gap-y-3 py-2">
              <v-text-field
                :model-value="widget.options.modelUrl"
                label="Model file (.glb)"
                hint="Falls back to a built-in placeholder shape when the file is missing"
                persistent-hint
                variant="outlined"
                density="compact"
                @update:model-value="updateModelUrl"
              />
              <v-select
                :model-value="widget.options.modelForwardAxis"
                :items="forwardAxisOptions"
                label="Model nose axis"
                hint="Which local axis of the model points forward"
                persistent-hint
                variant="outlined"
                density="compact"
                @update:model-value="updateForwardAxis"
              />
              <v-checkbox
                :model-value="widget.options.showGrid"
                label="Show reference grid"
                hide-details
                class="-mt-1"
                @update:model-value="updateShowGrid"
              />
              <v-checkbox
                :model-value="widget.options.smoothMovement"
                label="Smooth attitude changes"
                hide-details
                class="-mt-3"
                @update:model-value="updateSmoothMovement"
              />
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
    <template #actions>
      <v-btn @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false">Close</v-btn>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { useElementVisibility, useWindowSize } from '@vueuse/core'
import type * as Three from 'three'
import { computed, onBeforeMount, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { useResolvedDataLakeTemplate } from '@/composables/useResolvedDataLakeTemplate'
import { type ModelForwardAxis, attitudeToModelQuaternion, isUsableAttitude } from '@/libs/robot-model-attitude'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

import ExpansiblePanel from '../ExpansiblePanel.vue'
import InteractionDialog from '../InteractionDialog.vue'

const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const attitudeSources = [
  { optionKey: 'rollVariableId', label: 'Roll variable' },
  { optionKey: 'pitchVariableId', label: 'Pitch variable' },
  { optionKey: 'yawVariableId', label: 'Yaw variable' },
]

const forwardAxisOptions = [
  { title: '-Z (glTF default)', value: '-z' },
  { title: '+Z', value: '+z' },
  { title: '+X', value: '+x' },
  { title: '-X', value: '-x' },
]

onBeforeMount(() => {
  const defaultOptions = {
    rollVariableId: '/mavlink/{{autopilotSystemId}}/1/ATTITUDE/roll',
    pitchVariableId: '/mavlink/{{autopilotSystemId}}/1/ATTITUDE/pitch',
    yawVariableId: '/mavlink/{{autopilotSystemId}}/1/ATTITUDE/yaw',
    modelUrl: '/models/robot.glb',
    modelForwardAxis: '-z',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    showGrid: true,
    smoothMovement: true,
  }
  widget.value.options = { ...defaultOptions, ...widget.value.options }
})

const rollPath = useResolvedDataLakeTemplate(() => widget.value.options.rollVariableId)
const pitchPath = useResolvedDataLakeTemplate(() => widget.value.options.pitchVariableId)
const yawPath = useResolvedDataLakeTemplate(() => widget.value.options.yawVariableId)

const { value: rollValue } = useDataLakeVariable(() => rollPath.value)
const { value: pitchValue } = useDataLakeVariable(() => pitchPath.value)
const { value: yawValue } = useDataLakeVariable(() => yawPath.value)

// The data lake hands out radians straight from MAVLink, which is also what the conversion expects.
const attitude = computed(() => ({
  roll: Number(rollValue.value),
  pitch: Number(pitchValue.value),
  yaw: Number(yawValue.value),
}))
const hasAttitude = computed(() => isUsableAttitude(attitude.value))

const canvasRef = ref<HTMLCanvasElement | undefined>()
const { width: windowWidth, height: windowHeight } = useWindowSize()
const canvasSize = computed(() => ({
  width: Math.max(1, Math.round(widget.value.size.width * windowWidth.value)),
  height: Math.max(1, Math.round(widget.value.size.height * windowHeight.value)),
}))

type SceneStatus = 'starting' | 'loading' | 'ready' | 'placeholder' | 'unsupported'
const sceneStatus = ref<SceneStatus>('starting')

const statusMessage = computed(() => {
  if (sceneStatus.value === 'unsupported') return 'This device cannot render 3D content, as WebGL is unavailable.'
  if (sceneStatus.value === 'starting' || sceneStatus.value === 'loading') return 'Loading the 3D model...'
  if (!hasAttitude.value) return 'Waiting for attitude data from the vehicle.'
  return undefined
})

const MAX_FPS = 30
const FRAME_INTERVAL_MS = 1000 / MAX_FPS
// Below this angle the remaining motion is under a pixel on screen, so the loop can stop instead of
// burning frames chasing an asymptote.
const SETTLED_RADIANS = 1e-4
const SMOOTHING_PER_FRAME = 0.2

let three: typeof Three | undefined
let renderer: Three.WebGLRenderer | undefined
let scene: Three.Scene | undefined
let camera: Three.PerspectiveCamera | undefined
let modelRoot: Three.Object3D | undefined
let grid: Three.Object3D | undefined
let targetQuaternion: Three.Quaternion | undefined
let frameHandle: number | undefined
let lastFrameTime = 0
let disposed = false

const canvasVisible = useElementVisibility(canvasRef)
const shouldRender = computed(
  () => sceneStatus.value !== 'starting' && sceneStatus.value !== 'unsupported' && canvasVisible.value
)

const disposeObject = (object: Three.Object3D): void => {
  object.traverse((child) => {
    const mesh = child as Three.Mesh
    mesh.geometry?.dispose()
    const material = mesh.material as Three.Material | Three.Material[] | undefined
    const materials = Array.isArray(material) ? material : material ? [material] : []
    materials.forEach((entry) => {
      Object.values(entry).forEach((property) => {
        if (property && typeof property === 'object' && 'isTexture' in property) {
          ;(property as Three.Texture).dispose()
        }
      })
      entry.dispose()
    })
  })
}

/**
 * A deliberately asymmetric stand-in so the operator can still read the vehicle's orientation
 * before a real GLB is supplied. Its nose points along -Z, matching the default forward axis.
 * @returns {Three.Object3D}
 */
const buildPlaceholderModel = (): Three.Object3D => {
  const lib = three as typeof Three
  const group = new lib.Group()

  const body = new lib.Mesh(
    new lib.BoxGeometry(1.1, 0.5, 1.8),
    new lib.MeshStandardMaterial({ color: 0x3f7fbf, metalness: 0.2, roughness: 0.6 })
  )
  group.add(body)

  const nose = new lib.Mesh(
    new lib.ConeGeometry(0.32, 0.7, 16),
    new lib.MeshStandardMaterial({ color: 0xf0b23c, metalness: 0.1, roughness: 0.5 })
  )
  nose.rotation.x = -Math.PI / 2
  nose.position.z = -1.25
  group.add(nose)

  const fin = new lib.Mesh(
    new lib.BoxGeometry(0.08, 0.5, 0.5),
    new lib.MeshStandardMaterial({ color: 0xd8dee9, metalness: 0.1, roughness: 0.7 })
  )
  fin.position.set(0, 0.45, 0.7)
  group.add(fin)

  const thrusterGeometry = new lib.CylinderGeometry(0.16, 0.16, 0.5, 14)
  const thrusterMaterial = new lib.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.4, roughness: 0.5 })
  ;[-0.72, 0.72].forEach((x) => {
    const thruster = new lib.Mesh(thrusterGeometry, thrusterMaterial)
    thruster.rotation.x = Math.PI / 2
    thruster.position.set(x, 0, 0.8)
    group.add(thruster)
  })

  return group
}

/**
 * Fit whatever model was supplied into the same on-screen volume and centre it on its own origin,
 * so swapping in a real GLB of any scale or offset needs no code or camera change.
 * @param {Three.Object3D} object
 * @returns {void}
 */
const normalizeModel = (object: Three.Object3D): void => {
  const lib = three as typeof Three
  const box = new lib.Box3().setFromObject(object)
  if (box.isEmpty()) return

  const size = box.getSize(new lib.Vector3())
  const largestSide = Math.max(size.x, size.y, size.z)
  if (largestSide > 0) {
    const scale = 2 / largestSide
    object.scale.setScalar(scale)
  }

  const center = box.getCenter(new lib.Vector3()).multiplyScalar(object.scale.x)
  object.position.sub(center)
}

const stopLoop = (): void => {
  if (frameHandle !== undefined) {
    cancelAnimationFrame(frameHandle)
    frameHandle = undefined
  }
}

const renderFrame = (): void => {
  if (renderer && scene && camera) renderer.render(scene, camera)
}

const step = (now: number): void => {
  frameHandle = requestAnimationFrame(step)
  if (now - lastFrameTime < FRAME_INTERVAL_MS) return
  lastFrameTime = now

  if (!modelRoot || !targetQuaternion) return

  if (widget.value.options.smoothMovement) {
    modelRoot.quaternion.slerp(targetQuaternion, SMOOTHING_PER_FRAME)
  } else {
    modelRoot.quaternion.copy(targetQuaternion)
  }

  renderFrame()

  if (modelRoot.quaternion.angleTo(targetQuaternion) < SETTLED_RADIANS) {
    modelRoot.quaternion.copy(targetQuaternion)
    renderFrame()
    stopLoop()
  }
}

const startLoop = (): void => {
  if (frameHandle !== undefined || !shouldRender.value) return
  lastFrameTime = 0
  frameHandle = requestAnimationFrame(step)
}

const applyCanvasSize = (): void => {
  if (!renderer || !camera) return
  const { width, height } = canvasSize.value
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderFrame()
}

const loadModel = async (): Promise<void> => {
  const lib = three as typeof Three
  sceneStatus.value = 'loading'

  if (modelRoot) {
    scene?.remove(modelRoot)
    disposeObject(modelRoot)
    modelRoot = undefined
  }

  let loaded: Three.Object3D | undefined
  try {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const gltf = await new GLTFLoader().loadAsync(widget.value.options.modelUrl)
    loaded = gltf.scene
  } catch {
    loaded = undefined
  }

  if (disposed) {
    if (loaded) disposeObject(loaded)
    return
  }

  modelRoot = loaded ?? buildPlaceholderModel()
  normalizeModel(modelRoot)
  scene?.add(modelRoot)

  targetQuaternion = targetQuaternion ?? new lib.Quaternion()
  modelRoot.quaternion.copy(targetQuaternion)

  sceneStatus.value = loaded ? 'ready' : 'placeholder'
  renderFrame()
  startLoop()
}

const applyGridVisibility = (): void => {
  if (!grid || !scene) return
  grid.visible = Boolean(widget.value.options.showGrid)
  renderFrame()
}

onMounted(async () => {
  if (!canvasRef.value) return

  three = await import('three')
  if (disposed) return

  try {
    renderer = new three.WebGLRenderer({ canvas: canvasRef.value, antialias: true, alpha: true })
  } catch {
    sceneStatus.value = 'unsupported'
    return
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  scene = new three.Scene()
  camera = new three.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(3.2, 2.4, 4.2)
  camera.lookAt(0, 0, 0)

  scene.add(new three.AmbientLight(0xffffff, 1.6))
  const keyLight = new three.DirectionalLight(0xffffff, 2.2)
  keyLight.position.set(4, 6, 3)
  scene.add(keyLight)

  grid = new three.GridHelper(8, 8, 0x5f6b7a, 0x39424e)
  grid.position.y = -1.4
  scene.add(grid)
  applyGridVisibility()

  targetQuaternion = new three.Quaternion()
  applyCanvasSize()
  await loadModel()
})

onUnmounted(() => {
  disposed = true
  stopLoop()
  if (modelRoot) disposeObject(modelRoot)
  if (grid) disposeObject(grid)
  scene?.clear()
  renderer?.dispose()
  // Frees the GPU-side context instead of waiting for the browser to collect the canvas.
  renderer?.forceContextLoss()
  renderer = undefined
  scene = undefined
  camera = undefined
  modelRoot = undefined
  grid = undefined
})

watch([attitude, hasAttitude, () => widget.value.options.modelForwardAxis], () => {
  if (!targetQuaternion || !hasAttitude.value) return
  const { x, y, z, w } = attitudeToModelQuaternion(
    attitude.value,
    widget.value.options.modelForwardAxis as ModelForwardAxis
  )
  targetQuaternion.set(x, y, z, w)
  startLoop()
})

watch(canvasSize, applyCanvasSize)

watch(shouldRender, (isRenderable) => {
  if (isRenderable) {
    renderFrame()
    startLoop()
  } else {
    stopLoop()
  }
})

const updateAttitudeSource = (optionKey: string, value: string): void => {
  widget.value.options[optionKey] = value
  logUserAction(`Changed the 3D model widget ${optionKey} to "${value}"`)
}

const updateModelUrl = (value: string): void => {
  widget.value.options.modelUrl = value
  logUserAction(`Changed the 3D model file to "${value}"`)
  loadModel()
}

const updateForwardAxis = (value: ModelForwardAxis): void => {
  widget.value.options.modelForwardAxis = value
  logUserAction(`Changed the 3D model nose axis to "${value}"`)
}

const updateShowGrid = (value: boolean | null): void => {
  widget.value.options.showGrid = Boolean(value)
  logUserAction(`${widget.value.options.showGrid ? 'Showed' : 'Hid'} the 3D model reference grid`)
  applyGridVisibility()
}

const updateSmoothMovement = (value: boolean | null): void => {
  widget.value.options.smoothMovement = Boolean(value)
  logUserAction(`${widget.value.options.smoothMovement ? 'Enabled' : 'Disabled'} 3D model attitude smoothing`)
}
</script>

<style scoped>
.main {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 120px;
  min-height: 120px;
  overflow: hidden;
}

.status-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
</style>
