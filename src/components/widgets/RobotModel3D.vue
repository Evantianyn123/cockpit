<template>
  <section ref="rootRef" class="robot-model" :aria-label="t('robotModel.title')" :data-widget-hash="widgetHash">
    <canvas ref="canvasRef" class="robot-model__canvas" />
    <p v-if="overlayMessage" class="robot-model__message">{{ overlayMessage }}</p>
  </section>
</template>

<script setup lang="ts">
import { useDocumentVisibility, useElementSize, useElementVisibility } from '@vueuse/core'
import {
  AmbientLight,
  Box3,
  BufferGeometry,
  DirectionalLight,
  Group,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { robotModelQuaternionFromNed } from '@/libs/robot-model-attitude'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { Widget } from '@/types/widgets'

const props = defineProps<{
  /**
   * Widget reference.
   */
  widget: Widget
}>()

const { t } = useI18n()
const vehicleStore = useMainVehicleStore()
const widgetHash = computed(() => props.widget.hash)

datalogger.registerUsage(DatalogVariable.roll)
datalogger.registerUsage(DatalogVariable.pitch)
datalogger.registerUsage(DatalogVariable.heading)

const rootRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()
const { width, height } = useElementSize(rootRef)
const isVisible = useElementVisibility(rootRef)
const documentVisibility = useDocumentVisibility()

const modelState = ref<'loading' | 'ready' | 'error' | 'webgl-unavailable'>('loading')
const hasValidAttitude = computed(() => {
  const attitude = vehicleStore.attitude
  return (
    vehicleStore.isVehicleOnline &&
    Number.isFinite(attitude.roll) &&
    Number.isFinite(attitude.pitch) &&
    Number.isFinite(attitude.yaw)
  )
})
const overlayMessage = computed(() => {
  if (modelState.value === 'webgl-unavailable') return t('robotModel.unavailable')
  if (modelState.value === 'error') return t('robotModel.unableToLoad')
  if (modelState.value === 'loading') return t('robotModel.loading')
  if (!hasValidAttitude.value) return t('robotModel.noAttitude')
  return undefined
})

const targetQuaternion = new Quaternion()
const currentQuaternion = new Quaternion()
const maxFrameIntervalMs = 1000 / 30
const smoothingDurationMs = 140

let renderer: WebGLRenderer | undefined
let scene: Scene | undefined
let camera: PerspectiveCamera | undefined
let attitudeGroup: Group | undefined
let animationFrame: number | undefined
let lastFrameTime = 0
let disposed = false

const canRender = (): boolean =>
  renderer !== undefined &&
  scene !== undefined &&
  camera !== undefined &&
  attitudeGroup !== undefined &&
  modelState.value === 'ready' &&
  hasValidAttitude.value &&
  isVisible.value &&
  documentVisibility.value === 'visible'

const scheduleRender = (): void => {
  if (!canRender() || animationFrame !== undefined) return
  animationFrame = requestAnimationFrame(renderFrame)
}

const renderFrame = (timestamp: number): void => {
  animationFrame = undefined
  if (
    !canRender() ||
    renderer === undefined ||
    scene === undefined ||
    camera === undefined ||
    attitudeGroup === undefined
  )
    return

  if (lastFrameTime > 0 && timestamp - lastFrameTime < maxFrameIntervalMs) {
    animationFrame = requestAnimationFrame(renderFrame)
    return
  }

  const elapsed = lastFrameTime === 0 ? smoothingDurationMs : timestamp - lastFrameTime
  lastFrameTime = timestamp
  currentQuaternion.slerp(targetQuaternion, Math.min(1, elapsed / smoothingDurationMs))
  attitudeGroup.quaternion.copy(currentQuaternion)
  renderer.render(scene, camera)

  if (currentQuaternion.angleTo(targetQuaternion) > 0.001) scheduleRender()
}

const updateAttitude = (): void => {
  if (!hasValidAttitude.value) return
  const attitude = vehicleStore.attitude
  targetQuaternion.copy(robotModelQuaternionFromNed(attitude.roll, attitude.pitch, attitude.yaw))
  scheduleRender()
}

const resizeRenderer = (): void => {
  if (renderer === undefined || camera === undefined || width.value <= 0 || height.value <= 0) return
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setSize(width.value, height.value, false)
  camera.aspect = width.value / height.value
  camera.updateProjectionMatrix()
  scheduleRender()
}

const disposeObject = (object: Object3D): void => {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()

  object.traverse((child) => {
    if (!(child instanceof Mesh)) return
    geometries.add(child.geometry)
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material]
    childMaterials.forEach((material) => {
      materials.add(material)
      Object.values(material).forEach((value) => {
        if (value instanceof Texture) textures.add(value)
      })
    })
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => texture.dispose())
}

const loadModel = async (): Promise<void> => {
  try {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/robot.glb`)
    if (disposed) {
      disposeObject(gltf.scene)
      return
    }

    const model = gltf.scene
    const bounds = new Box3().setFromObject(model)
    model.position.sub(bounds.getCenter(new Vector3()))
    model.rotation.y = Math.PI
    attitudeGroup?.add(model)
    currentQuaternion.copy(targetQuaternion)
    modelState.value = 'ready'
    scheduleRender()
  } catch (error) {
    console.error('Unable to load robot model.', error)
    modelState.value = 'error'
  }
}

onMounted(() => {
  if (canvasRef.value === undefined) return
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, canvas: canvasRef.value })
  } catch (error) {
    console.error('WebGL is unavailable for the robot model widget.', error)
    modelState.value = 'webgl-unavailable'
    return
  }

  scene = new Scene()
  camera = new PerspectiveCamera(34, 1, 0.1, 100)
  camera.position.set(2.4, 1.6, -3.6)
  camera.lookAt(0, 0, 0)
  scene.add(new AmbientLight(0xffffff, 1.4))

  const keyLight = new DirectionalLight(0xffffff, 2.2)
  keyLight.position.set(3, 4, -2)
  scene.add(keyLight)

  attitudeGroup = new Group()
  scene.add(attitudeGroup)
  updateAttitude()
  resizeRenderer()
  void loadModel()
})

watch([width, height], resizeRenderer)
watch([isVisible, documentVisibility], ([visible, visibility]) => {
  if (visible && visibility === 'visible') scheduleRender()
})
watch(
  [
    () => vehicleStore.isVehicleOnline,
    () => vehicleStore.attitude.roll,
    () => vehicleStore.attitude.pitch,
    () => vehicleStore.attitude.yaw,
  ],
  updateAttitude,
  { immediate: true }
)

onUnmounted(() => {
  disposed = true
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
  if (scene !== undefined) disposeObject(scene)
  renderer?.renderLists.dispose()
  renderer?.dispose()
  renderer?.forceContextLoss()
})
</script>

<style scoped>
.robot-model {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: rgb(7 21 31 / 0.72);
}

.robot-model__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.robot-model__message {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0.75rem;
  color: rgb(255 255 255 / 0.75);
  font-size: 0.8rem;
  text-align: center;
  pointer-events: none;
}
</style>
