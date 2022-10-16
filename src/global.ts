import * as Interface from './types/skytunes'
import { getLST } from './utilities'

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

class GlobalContext extends EventTarget implements Interface.GlobalContext {
  date: Date = new Date()
  long: number = 0
  lat: number = 0
  lst: number = 0
  sinLat: number = 0
  cosLat: number = 1

  stars: Interface.Star[] = []
  starsRef: Interface.Star[] = []

  canvas?: Interface.SkyCanvas
  audio: AudioContext
  speed: number = 1

  constructor() {
    super()
    this.update = this.update.bind(this)
    this.update({ date: new Date(), long: 0, lat: 0 })
    this.audio = new AudioContext()
  }

  update(options: Partial<Interface.GlobalContext>) {
    let { date, long, lat, stars, canvas, speed } = options
    this.date = date ?? this.date ?? new Date()
    this.long = long ?? this.long
    this.lat = lat ?? this.lat
    this.canvas = canvas ?? this.canvas
    this.speed = speed ?? this.speed

    if (stars !== undefined) {
      this.stars = stars
      this.starsRef = stars.reduce((indexed, star) => {
        indexed[star.ref] = star
        return indexed
      }, [] as Interface.Star[])

      // this.starsInvisible = []
      // this.starsVisible = stars.filter()
    }

    if (date !== undefined || long !== undefined) {
      this.lst = getLST(this.date, this.long)
    }

    if (lat !== undefined) {
      this.sinLat = Math.sin(this.lat)
      this.cosLat = Math.cos(this.lat)
    }

    const updateEvent = new CustomEvent('update', {
      detail: options,
    })
    this.dispatchEvent(updateEvent)
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

export default new GlobalContext()
