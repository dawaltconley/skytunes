import * as Interface from './types/skytunes'
import globalContext from './global'

class Star implements Interface.Star {
  static context = globalContext

  ref: number
  ra: number
  dec: number
  mag: number
  hourAngle: number = 0
  altitude: number = 0
  azimuth: number = 0
  lastAzimuth: number = 0
  highTransit: number = 0
  lowTransit: number = 0

  #sinDec: number
  #cosDec: number
  #queuedSynth: number | null = null

  constructor(
    harvardReferenceNumber: number,
    rightAscension: number,
    declination: number,
    magnitude: number
  ) {
    this.ref = harvardReferenceNumber
    this.ra = rightAscension
    this.dec = declination
    this.mag = magnitude

    this.#sinDec = Math.sin(declination)
    this.#cosDec = Math.cos(declination)

    this.recalculate = this.recalculate.bind(this)
    this.recalculate({
      date: Star.context.date,
      long: Star.context.long,
      lat: Star.context.lat,
    })
    Star.context.addEventListener('update', ((event: CustomEvent) => {
      this.recalculate(event.detail as Partial<Interface.GlobalContext>)
    }) as EventListener)
  }

  recalculate({
    date,
    long,
    lat,
    speed,
  }: Partial<Interface.GlobalContext>): Star {
    // the hour angle can be used to calculate when the star will cross the meridian
    // negative hour angles = moving away from meridian
    // positive hour angles = moving towards the meridian
    // an hour angle of zero occurs when the star passes the meridian
    if (date !== undefined || long !== undefined) {
      this.hourAngle = (Star.context.lst - this.ra) % (2 * Math.PI)
      if (this.hourAngle > Math.PI) this.hourAngle -= 2 * Math.PI
    }

    if (lat !== undefined) {
      // source: https://kalobs.org/more/altitudes-at-transit/
      this.highTransit = Math.asin(Math.cos(this.dec - Star.context.lat))
      this.lowTransit = Math.asin(-Math.cos(this.dec + Star.context.lat))
    }

    // queue a synth for when the star transits
    if (
      this.highTransit > 0 &&
      (this.#queuedSynth === null || speed !== undefined || long !== undefined)
    ) {
      if (this.#queuedSynth) clearTimeout(this.#queuedSynth)

      if (this.hourAngle < 0) {
        console.log('queueing transit')
        let queueTime = Math.floor(this.nextTransit) - 1000
        this.#queuedSynth = setTimeout(() => {
          let transit = this.nextTransit
          if (transit < 0) {
            this.#queuedSynth = null
            return
          }
          this.playSynth(transit / 1000)
          setTimeout(() => {
            this.#queuedSynth = null
          }, Math.ceil(transit))
        }, queueTime)
      }
    }

    // can potentially abort after altitude if under the horizon
    this.altitude = Math.asin(
      this.#sinDec * Star.context.sinLat +
        this.#cosDec * Star.context.cosLat * Math.cos(this.hourAngle)
    )

    this.lastAzimuth = this.azimuth
    this.azimuth = Math.acos(
      (this.#sinDec - Math.sin(this.altitude) * Star.context.sinLat) /
        (Math.cos(this.altitude) * Star.context.cosLat)
    )

    if (this.hourAngle > 0) {
      this.azimuth = Math.PI * 2 - this.azimuth
    }

    return this
  }

  get theta() {
    return Math.PI / 2 - this.azimuth
  }

  get rho() {
    return Math.cos(this.altitude)
  }

  /** time to the next high transit in milliseconds */
  get nextTransit() {
    return (this.hourAngle * (-43200000 / Math.PI)) / Star.context.speed
  }

  playSynth(start: number = 0): Star {
    const ctx = Star.context.audio
    const speedAdjust = 10 / Star.context.speed
    const play = ctx.currentTime + start
    // let note = (Math.PI / 2 - Math.abs(this.highTransit - Math.PI / 2)) / (Math.PI / 2)
    let note = 1 - Math.abs(1 - this.highTransit / (Math.PI / 2))
    note = 40 + note * 360

    let oscillator = ctx.createOscillator()
    oscillator.frequency.setValueAtTime(note, 0)

    let [attack, decay, sustain, release, stop] = [
      0.05,
      0.2 * speedAdjust,
      0.5 * speedAdjust,
      5 * speedAdjust,
      0.1 + 6 * speedAdjust,
    ]

    let gainNode = ctx.createGain()
    gainNode.gain
      .setValueAtTime(0, play)
      .linearRampToValueAtTime(0.3, play + attack)
      .linearRampToValueAtTime(0.2, play + decay)
      .setValueAtTime(0.2, play + sustain)
      .linearRampToValueAtTime(0, play + release)

    oscillator.connect(gainNode).connect(ctx.destination)
    oscillator.start(play)
    oscillator.stop(play + release + 1)

    return this
  }
}

export { Star }
