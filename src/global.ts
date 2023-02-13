// interface StateListeners {
//
// }

// type SettingKeys = keyof GlobalContext
//
// let foo: SettingKeys
//
// foo =

// type StateListeners = Record<Pick<GlobalContext, 'date'>, () => void>

// type Listenable = 'date' | 'long' | 'lat' | 'lst' | 'sinLat' | 'cosLat' | 'speed'

// interface Listeners {
//   date: (updated: Date) => void
//   [prop: 'long' | 'lat' | 'lst' | 'sinLat' | 'cosLat' | 'speed']: (updated: number) => void
// }

// type GetListeners<Type, Listeners> = {
//   [Property in keyof Type as Extract<Property, Listeners>]+?: (
//     updated: Type[Property]
//   ) => void
// }

// type GlobalListeners = GetListeners<
//   GlobalContext,
//   keyof Settings
// >

// type GlobalListeners = {
//   [Property in keyof Settings]+?: (updated: Settings[Property]) => void
//   // } & {
//   //   any: Partial<Settings>
// }

// type Listener<Key> = (updated: Settings[Key]) => void

// let test: GetListeners<Interface.GlobalContext, 'date' | 'long'> = {
//   // foo: 'bar',
//   date: (updated: Date) => {
//     console.log(updated)
//   },
//   long: (updated: number) => {
//     console.log(updated)
//   },
// }

// I want to do two things with the GlobalContext, which may need to be separated
// 1. I want to emit events on state change
//    and listen to those events from other components
// 2. I want to use side effects to calculate certain values only when needed
//    particularly lst and sinLat/cosLat
//
// this second thing could maybe be handled in the StarManager class...
//
// I think the move is to only use GlobalContext for properties that can be updated in the UI
// and handle their side-effects separately
//
// only exception is that i want to have a global `now` time,
// influenced by speed, that all components can read.
// can calculate this from start date and speed,
// only emiting update events when either is changed

const mutableProperties = ['date', 'long', 'lat', 'speed', 'audio'] as const

type Settings = Pick<GlobalContext, (typeof mutableProperties)[number]>

const isMutableProperty = (
  p: string
): p is (typeof mutableProperties)[number] =>
  mutableProperties.includes(p as (typeof mutableProperties)[number])

interface UpdateEvent<P extends PropertyKey> extends CustomEvent {
  detail: Partial<Settings> & Pick<Settings, Extract<keyof Settings, P>>
}

// type UpdateEvent<T extends PropertyKey> = {
//   detail: Partial<Settings> //  & Pick<Settings, Extract<keyof Settings, T>>
// } & CustomEvent
//
// function (a: UpdateEvent<'st'>) {
//   console.log(a.detail)
// }

// type Listener<K in keyof Settings> = Settings[K]

// ideally: have a listen function which takes two arguments:
// 1) an array of properties to listen to
class GlobalContext extends EventTarget implements Settings {
  date: Date = new Date()
  long: number = 0
  lat: number = 0

  audio: AudioContext
  speed: number = 1

  constructor() {
    super()
    this.audio = new AudioContext({ latencyHint: 'interactive' })
    this.update = this.update.bind(this)

    // dispatches 'update' and 'update.[property]' events whenever a property is changed
    return new Proxy(this, {
      get(target, property) {
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
      set(target, property, value) {
        if (isMutableProperty(property.toString())) {
          target.update({ [property.toString()]: value })
          return true
        }
        return Reflect.set(target, property, value)
      },
    })
  }

  /**
   * updates multiple settings at once
   * @param options - an object representing new values to be assigned to each setting
   * @return an object containing only those settings with new values that were updated
   */
  update(options: Partial<Settings>): Partial<Settings> {
    const updated: Partial<Settings> = Object.fromEntries(
      Object.entries(options).filter(
        // filter out update options that haven't changed
        ([p, value]) => value !== this[p as keyof Settings]
      )
    )
    const event: CustomEventInit = { detail: updated }

    Object.assign(this, updated)
    this.dispatchEvent(new CustomEvent('update', event))
    Object.entries(updated).forEach(([property]) => {
      this.dispatchEvent(new CustomEvent(`update.${property}`, event))
    })

    return updated
  }

  listen<P extends keyof Settings | 'update'>(
    property: P,
    listener: (event: UpdateEvent<P>) => void
  ) {
    if (property === 'update') {
      this.addEventListener('update', listener as EventListener)
    } else {
      this.addEventListener(`update.${property}`, listener as EventListener)
    }
  }

  // listen( listeners: GlobalListeners): void {
  //   // if (typeof listeners === 'function') {
  //   Object.entries(listeners).forEach(([property, listener]) => {
  //     this.addEventListener('update', ((event: CustomEvent) => {
  //       listener(event.detail[property])
  //     }) as EventListener)
  //     this.addEventListener(`update.${property}`, ((event: CustomEvent) => {
  //       listener(event.detail[property])
  //     }) as EventListener)
  //   })
  // }
}

// new GlobalContext().listen({
//   date: newDate => {
//     console.log(newDate)
//   },
// })

// p = new Proxy(new Test(), {
//   set(target, property, value) {
//     if (!(property in target)) return false
//     console.log(`setting ${property}`)
//     target[property] = value
//     return true
//   },
// })

export default new GlobalContext()
export type { GlobalContext }
