import { defineStore } from 'pinia'
import { watch } from 'vue'

import { MavAutopilot } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { flightModeLabel } from '@/libs/i18n/flight-mode-labels'
import { formatVehicleArmed, formatVehicleConnection, formatVehicleModeChanged } from '@/libs/i18n/runtime-templates'
import { getVehicleTypeFromMavType } from '@/libs/vehicle/ardupilot/common'
import { useAlertStore } from '@/stores/alert'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { Alert, AlertLevel } from '@/types/alert'

export const useVehicleAlerterStore = defineStore('vehicle-alerter', () => {
  const vehicleStore = useMainVehicleStore()
  const alertStore = useAlertStore()

  watch(vehicleStore.statusText, () => {
    if (!vehicleStore.statusText.text) return
    alertStore.pushAlert(new Alert(vehicleStore.statusText.severity, vehicleStore.statusText.text))
  })

  watch(
    () => vehicleStore.mode,
    (mode) => {
      const isPx4 = vehicleStore.firmwareType === MavAutopilot.MAV_AUTOPILOT_PX4
      const vehicleType = vehicleStore.vehicleType ? getVehicleTypeFromMavType(vehicleStore.vehicleType) : undefined
      const modeLabel = flightModeLabel(mode, vehicleType, isPx4)
      alertStore.pushAlert(new Alert(AlertLevel.Info, formatVehicleModeChanged(modeLabel)))
    }
  )

  watch(
    () => vehicleStore.isArmed,
    (isArmedNow) => {
      alertStore.pushAlert(new Alert(AlertLevel.Info, formatVehicleArmed(isArmedNow)))
    }
  )

  watch(
    () => vehicleStore.isVehicleOnline,
    (isOnlineNow) => {
      const alertLevel = isOnlineNow ? AlertLevel.Success : AlertLevel.Error
      alertStore.pushAlert(new Alert(alertLevel, formatVehicleConnection(isOnlineNow)))
    }
  )
})
