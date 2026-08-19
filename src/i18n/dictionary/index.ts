import { commonDictionary } from '@/i18n/dictionary/common'
import { configurationDictionary } from '@/i18n/dictionary/configuration'
import { joystickDictionary } from '@/i18n/dictionary/joystick'
import { menuDictionary } from '@/i18n/dictionary/menu'
import { messagesDictionary } from '@/i18n/dictionary/messages'
import { missionDictionary } from '@/i18n/dictionary/mission'
import { videoDictionary } from '@/i18n/dictionary/video'
import { widgetsDictionary } from '@/i18n/dictionary/widgets'

/** Flat runtime dictionary keyed by normalized English source text. */
export const runtimeDictionary: Readonly<Record<string, string>> = Object.freeze({
  ...menuDictionary,
  ...configurationDictionary,
  ...missionDictionary,
  ...videoDictionary,
  ...joystickDictionary,
  ...widgetsDictionary,
  ...messagesDictionary,
  ...commonDictionary,
})
