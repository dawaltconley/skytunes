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
//   Interface.GlobalContext,
//   'date' | 'long' | 'lat' | 'lst' | 'sinLat' | 'cosLat' | 'speed'
// >

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

class GlobalContext extends EventTarget {
  date: Date = new Date()
  long: number = 0
  lat: number = 0

  audio: AudioContext
  speed: number = 1

  constructor() {
    super()
    this.update = this.update.bind(this)
    this.update({ date: new Date(), long: 0, lat: 0 })
    this.audio = new AudioContext()
  }

  update(options: Partial<GlobalContext>) {
    let { date, long, lat, speed } = options
    this.date = date ?? this.date ?? new Date()
    this.long = long ?? this.long
    this.lat = lat ?? this.lat
    this.speed = speed ?? this.speed

    if (date ?? long ?? lat ?? speed ?? false) {
      const updateEvent = new CustomEvent('update', {
        detail: options,
      })
      this.dispatchEvent(updateEvent)
    }
  }
  // TODO type should be more specific; only listen to a subset of global keys
  // listen(listeners: GlobalListeners) {
  //   return new Proxy(this, {
  //     set(target, property: string, value) {
  //       const callback = listeners[property]
  //       if (!callback) return false
  //
  //       callback.call(this, value)
  //       target[property] = value
  //       return true
  //     },
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
