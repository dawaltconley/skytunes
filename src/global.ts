import * as Interface from './types/skytunes'
import { getLST } from './utilities'

class StarSorter extends Array<Interface.Star> {
  #ref: Interface.Star[] = []
  #visible: Interface.Star[] = []
  #hidden: Interface.Star[] = []
  // #circumpolar: Interface.Star[] = []
  // #wontRise: Interface.Star[] = []

  constructor(stars: Interface.Star[]) {
    super()
    this.push(...stars) // maybe return only visible
    this.#ref = stars.reduce((indexed, star) => {
      indexed[star.ref] = star
      return indexed
    }, [] as Interface.Star[])

    this.recalculateVisible()

    Object.setPrototypeOf(this, StarSorter.prototype)
  }

  getStar(ref: number): Interface.Star {
    return this.#ref[ref]
  }

  get visible(): Interface.Star[] {
    return this.#visible
  }

  setVisible(star: Interface.Star) {
    this.visible[star.ref] = star
    delete this.#hidden[star.ref]
  }

  // TODO get rid of speed as argument
  setInvisible(star: Interface.Star, speed: number) {
    this.#hidden[star.ref] = star
    delete this.#visible[star.ref]

    // if star.highTransit < 0 ? or if star.horizonTransit !== NaN
    // star.hourAngle is probably ~90deg to 180deg or -180deg to ~-90deg
    // need difference between that angle and horizonTransit ~90deg
    // hourAngle + 180deg = hourAngle of 0 - 360deg, increasing the closer it gets to meridian
    // hourAngle - 180deg = hourAngle of -3
    let ha = star.hourAngle
    if (ha > 0) ha -= Math.PI * 2
    let angleToRise = Math.abs(star.horizonTransit) + ha
    let msToRise = (angleToRise * (-43200000 / Math.PI)) / speed

    setTimeout(this.setVisible.bind(this, star), msToRise - 1000)
  }

  recalculateVisible(props: Partial<Interface.GlobalContext> = {}) {
    this.#visible = new Array(this.#ref.length)
    this.#hidden = new Array(this.#ref.length)

    for (let star of this) {
      if (star.highTransit < 0) continue
      if (star.altitude > 0) {
        this.setVisible(star)
      } else {
        this.setInvisible(star, props.speed)
      }
    }

    return this.visible
  }

  // assuming no empty elements in visible array
  // fastest way to remove elements that have become no longer visible
  eachVisible(callback: (star: Interface.Star) => void) {
    const stillVisible: Interface.Star[] = []
    for (let star of this.#visible) {
      callback(star)
      if (star.altitude > 0)
        stillVisible.push(star)
      else
        this.setInvisible(star)
    }
    this.#visible = stillVisible
  }
}

class GlobalContext extends EventTarget implements Interface.GlobalContext {
  date: Date = new Date()
  long: number = 0
  lat: number = 0
  lst: number = 0
  sinLat: number = 0
  cosLat: number = 1

  stars: Interface.Star[] = []
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
    this.stars = stars ?? this.stars
    this.canvas = canvas ?? this.canvas
    this.speed = speed ?? this.speed

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
}

export default new GlobalContext()
