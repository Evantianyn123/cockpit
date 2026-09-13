<template>
  <div>
    <Dropdown
      :model-value="currentMode"
      :options="modeOptions"
      name-key="name"
      value-key="value"
      class="min-w-[128px]"
      @update:model-value="onModeSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { MavAutopilot } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { flightModeLabel } from '@/libs/i18n/flight-mode-labels'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { getVehicleTypeFromMavType } from '@/libs/vehicle/ardupilot/common'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import Dropdown from '../Dropdown.vue'

datalogger.registerUsage(DatalogVariable.mode)
const vehicleStore = useMainVehicleStore()
const currentMode = ref()

const modeOptions = computed(() => {
  const isPx4 = vehicleStore.firmwareType === MavAutopilot.MAV_AUTOPILOT_PX4
  const vehicleType = vehicleStore.vehicleType ? getVehicleTypeFromMavType(vehicleStore.vehicleType) : undefined
  return vehicleStore.modesAvailable().map((value) => ({
    name: flightModeLabel(value, vehicleType, isPx4),
    value,
  }))
})

const onModeSelected = (newMode: unknown): void => {
  currentMode.value = newMode
  if (newMode === undefined || newMode === vehicleStore.mode) return
  logUserAction(`Changed flight mode to '${newMode}'`)
  vehicleStore.setFlightMode(newMode as string)
}

// eslint-disable-next-line no-undef
let modeUpdateInterval: NodeJS.Timer | undefined = undefined
onMounted(() => (modeUpdateInterval = setInterval(() => (currentMode.value = vehicleStore.mode), 500)))
onUnmounted(() => clearInterval(modeUpdateInterval))
</script>
