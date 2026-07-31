import type { enUS } from './en-US'

type StringMessageTree<T> = {
  [Key in keyof T]: T[Key] extends string ? string : StringMessageTree<T[Key]>
}

export type AppMessages = StringMessageTree<typeof enUS>
