import type * as Interface from './types/skytunes'
import { MinHeap } from '@datastructures-js/heap'
import { getLST } from './utilities'

const PI2 = Math.PI * 2

class TimeAndPlace implements Interface.TimeAndPlace {
  readonly date: Date
  readonly long: number
  readonly lat: number
  readonly lst: number
  readonly sinLat: number
  readonly cosLat: number

  constructor(
    date: Date = new Date(),
    longitude: number = 0,
    latitude: number = 0
  ) {
    this.date = date
    this.long = longitude
    this.lat = latitude
    this.lst = getLST(date, longitude)
    this.sinLat = Math.sin(latitude)
    this.cosLat = Math.cos(latitude)
  }

  isEqual(other: TimeAndPlace): boolean {
    return (
      this.date.getTime() === other.date.getTime() &&
      this.long === other.long &&
      this.lat === other.lat
    )
  }
}

interface Envelope {
  attack: number
  decay: number
  sustain: number
  release: number
}

interface StarSynthOptions {
  /**
   * maximum seconds to schedule a new AudioNode ahead of play time
   * the longer the buffer, the more AudioNodes connected at any given time
   */
  queueBuffer?: number
  output?: AudioNode
}

class StarSynth extends EventTarget {
  readonly context: AudioContext
  readonly queueBuffer: number
  #oscillator?: OscillatorNode
  #gain?: GainNode
  #analyser?: AnalyserNode
  #queued?: number
  #isPlaying: boolean = false
  output: AudioNode

  #startedEvent = new CustomEvent('started', { detail: this })
  #endedEvent = new CustomEvent('ended', { detail: this })

  constructor(
    context: AudioContext,
    { queueBuffer = 1, output = context.destination }: StarSynthOptions = {}
  ) {
    super()
    this.context = context
    this.queueBuffer = queueBuffer
    this.output = output
  }

  get oscillator(): OscillatorNode | undefined {
    return this.#oscillator
  }

  get gain(): GainNode | undefined {
    return this.#gain
  }

  get analyser(): AnalyserNode | undefined {
    return this.#analyser
  }

  get isQueued(): boolean {
    return this.#queued !== undefined
  }

  get isPlaying(): boolean {
    return this.#isPlaying
  }

  /**
   * play a synth
   * @return the AudioContext time at which the synth stops
   */
  play(
    note: number,
    {
      envelope,
      amp = 1,
      start = 0,
    }: { envelope: Envelope; amp?: number; start?: number }
  ): void {
    const { context } = this
    const play = context.currentTime + start
    let { attack, decay, sustain, release } = envelope
    attack = play + attack
    decay = attack + decay
    release = decay + release

    this.#queued = window.setTimeout(() => {
      // skip playing if missed queue (can happen when changing speed)
      if (play < context.currentTime) return this.cancel()

      this.#oscillator = new OscillatorNode(context, {
        frequency: note,
      })
      this.#gain = new GainNode(context, { gain: 0 })
      this.#gain.gain
        .setValueAtTime(0, play)
        .linearRampToValueAtTime(amp, attack)
        .linearRampToValueAtTime(amp * sustain, decay)
        .linearRampToValueAtTime(0, release)
      this.#analyser = new AnalyserNode(context, {
        fftSize: 32,
      })

      // on started
      this.#queued = window.setTimeout(() => {
        this.dispatchEvent(this.#startedEvent)
        this.#queued = undefined
        this.#isPlaying = true
      }, (play - context.currentTime) * 1000)

      // on ended
      this.#oscillator.addEventListener('ended', () => {
        this.dispatchEvent(this.#endedEvent)
        this.#isPlaying = false
        // remove references to prevent subsequent calls to the cancelled objects
        this.#oscillator = undefined
        this.#gain = undefined
        this.#analyser = undefined
      })

      this.#oscillator
        .connect(this.#gain)
        .connect(this.#analyser)
        .connect(this.output)
      this.#oscillator.start(play)
      this.#oscillator.stop(release + 0.1)
    }, Math.floor((start - this.queueBuffer) * 1000))
  }

  cancel(when?: number) {
    const { context } = this
    const start = context.currentTime + (when ?? 0)

    clearTimeout(this.#queued)
    this.#queued = undefined
    this.#gain?.gain
      .linearRampToValueAtTime(0, start + 0.2)
      .cancelScheduledValues(start + 0.21)
    this.#oscillator?.stop(start + 0.4)
  }
}

const noteFromAltitude = (
  altitude: number,
  min: number,
  max: number
): number => {
  let scale = 1 - Math.abs(1 - altitude / (Math.PI / 2))
  return min + scale * (max - min)
}

const ampFromMagnitude = (
  magnitude: number,
  options: {
    min?: number
    max?: number
    brightest?: number
    dimmest?: number
  } = {}
): number => {
  const { min = 0, max = 1, brightest = 0, dimmest = 8 } = options
  let range = dimmest - brightest
  let scale = (dimmest - magnitude) / range
  return min + scale * (max - min)
}

type StarCache = {
  -readonly [K in keyof Star]?: Star[K]
}

class Star implements Interface.Star {
  static pov = new TimeAndPlace()

  readonly ref: number
  readonly ra: number
  readonly dec: number
  readonly mag: number

  readonly sinDec: number
  readonly cosDec: number

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

    this.sinDec = Math.sin(declination)
    this.cosDec = Math.cos(declination)
  }

  #cache: StarCache = {}

  /**
   * the hour angle measures the position in the stars arc through the sky
   * it can be used to calculate when the star will cross the meridian
   * negative hour angles = moving towards the meridian
   * positive hour angles = moving away from meridian
   * an hour angle of zero occurs when the star passes the meridian
   * @see {@link https://en.wikipedia.org/wiki/Hour_angle}
   */
  get hourAngle(): number {
    return (this.#cache.hourAngle ??= getHourAngle(this, Star.pov))
  }

  /**
   * the angle of the star's elevation from the horizon
   * @see {@link https://en.wikipedia.org/wiki/Horizontal_coordinate_system}
   */
  get altitude(): number {
    return (this.#cache.altitude ??= getAltitude(
      this,
      Star.pov,
      this.hourAngle
    ))
  }

  /**
   * the angle from the meridian to the star's position above the horizon
   * @see {@link https://en.wikipedia.org/wiki/Horizontal_coordinate_system}
   */
  get azimuth(): number {
    return (this.#cache.azimuth ??= getAzimuth(
      this,
      Star.pov,
      this.hourAngle,
      this.altitude
    ))
  }

  /**
   * the angle of the star from celestial north
   * @see {@link https://boyce-astro.org/wp-content/uploads/BRIEF-Video-Lesson-ASTROMETRY-Theta-and-Rho.pdf}
   */
  get theta(): number {
    return Math.PI * 0.5 - this.azimuth
  }

  /**
   * the flat distance of the star from the zenith
   * @see {@link https://boyce-astro.org/wp-content/uploads/BRIEF-Video-Lesson-ASTROMETRY-Theta-and-Rho.pdf}
   */
  get rho(): number {
    return Math.cos(this.altitude)
  }

  /**
   * the altitude when the star makes its high meridian transit
   * @see {@link  https://kalobs.org/more/altitudes-at-transit/}
   */
  get highTransit(): number {
    return (this.#cache.highTransit ??= getHighTransit(this, Star.pov))
  }

  /**
   * the altitude when the star makes its low meridian transit
   * @see {@link  https://kalobs.org/more/altitudes-at-transit/}
   */
  get lowTransit(): number {
    return (this.#cache.lowTransit ??= getLowTransit(this, Star.pov))
  }

  /**
   * the hour angle at which a star will cross the horizon
   * same for setting and rising, but the rising hour angle is negative
   * will be NaN for stars that don't cross the horizon
   */
  get horizonTransit(): number {
    return (this.#cache.horizonTransit ??= getHorizonTransit(this, Star.pov))
  }

  /** angle from where the star crosses the horizon */
  get angleToRise(): number {
    return (this.#cache.angleToRise ??= getAngleToRise(
      this,
      Star.pov,
      this.horizonTransit,
      this.hourAngle
    ))
  }

  timeToAngle(target: number): number {
    return (target - this.hourAngle) * (43200000 / Math.PI)
  }

  #lst?: number
  #lat?: number
  update(pov: TimeAndPlace): Star {
    if (pov.lst !== this.#lst) {
      this.#lst = pov.lst
      this.#cache.hourAngle = undefined
      this.#cache.altitude = undefined
      this.#cache.azimuth = undefined
      this.#cache.angleToRise = undefined
    }
    if (pov.lat !== this.#lat) {
      this.#lat = pov.lat
      this.#cache.altitude = undefined
      this.#cache.azimuth = undefined

      this.#cache.highTransit = undefined
      this.#cache.lowTransit = undefined
      this.#cache.horizonTransit = undefined
      this.#cache.angleToRise = undefined
    }
    return this
  }

  /** log data about the star's current position */
  log() {
    let { ref, hourAngle, altitude, azimuth, theta, rho } = this
    const toDegrees = (r: number) => (r * 180) / Math.PI
    console.log({
      ref,
      hourAngle: toDegrees(hourAngle),
      altitude: toDegrees(altitude),
      azimuth: toDegrees(azimuth),
      theta,
      rho,
    })
  }
}

export function getHourAngle(
  star: Interface.Star,
  pov: Interface.TimeAndPlace
): number {
  let hourAngle = (pov.lst - star.ra) % PI2
  if (hourAngle < 0) hourAngle += PI2
  if (hourAngle > Math.PI) hourAngle -= PI2
  return hourAngle
}

export function getAltitude(
  star: Interface.Star,
  pov: Interface.TimeAndPlace,
  hourAngle = getHourAngle(star, pov)
): number {
  return Math.asin(
    star.sinDec * pov.sinLat + star.cosDec * pov.cosLat * Math.cos(hourAngle)
  )
}

export function getAzimuth(
  star: Interface.Star,
  pov: Interface.TimeAndPlace,
  hourAngle = getHourAngle(star, pov),
  altitude = getAltitude(star, pov, hourAngle)
): number {
  let azimuth = Math.acos(
    (star.sinDec - Math.sin(altitude) * pov.sinLat) /
      (Math.cos(altitude) * pov.cosLat)
  )
  if (hourAngle > 0) azimuth = PI2 - azimuth
  return azimuth
}

export function getHighTransit(
  star: Interface.Star,
  pov: Interface.TimeAndPlace
): number {
  return Math.asin(star.cosDec * pov.cosLat + star.sinDec * pov.sinLat)
}

export function getLowTransit(
  star: Interface.Star,
  pov: Interface.TimeAndPlace
): number {
  return Math.asin(-(star.cosDec * pov.cosLat + star.sinDec * pov.sinLat))
}

export function getHorizonTransit(
  { dec }: Interface.Star,
  { lat }: Interface.TimeAndPlace
): number {
  return Math.PI - Math.acos(Math.tan(dec) * Math.tan(lat))
}

export function getAngleToRise(
  star: Interface.Star,
  pov: Interface.TimeAndPlace,
  horizonTransit = getHorizonTransit(star, pov),
  hourAngle = getHourAngle(star, pov)
): number {
  let ha = hourAngle
  if (ha > 0) ha = PI2 - ha
  return Math.abs(ha) - Math.abs(horizonTransit)
}

class StarArray extends Array<Star> {
  static get pov() {
    return Star.pov
  }

  readonly brightest: Star
  readonly dimmest: Star
  #ref: Star[] = []
  #visible: Star[] = []
  #hidden = new MinHeap<Star>(star => star.update(Star.pov).angleToRise)

  constructor(...stars: Star[]) {
    super(...stars)
    this.brightest = stars[0]
    this.dimmest = stars[0]
    for (const star of stars) {
      this.#ref[star.ref] = star
      if (star.mag < this.brightest.mag) this.brightest = star
      if (star.mag > this.dimmest.mag) this.dimmest = star
    }
    this.updateVisible()

    Object.setPrototypeOf(this, StarArray.prototype)
  }

  getStar(ref: Star['ref']): Star {
    return this.#ref[ref]
  }

  /**
   * Returns sets of duplicate entries, which represent binary stars.
   */
  getBinary(): Star[][] {
    const map = this.reduce((map, star) => {
      const key = `${star.ra},${star.dec}`
      return map.set(key, map.get(key)?.concat(star) || [star])
    }, new Map<string, Star[]>())
    return Array.from(map.values()).filter(stars => stars.length > 1)
  }

  /**
   * list of currently visible stars
   * returns an empty array if unknown
   */
  get visible(): Star[] {
    return this.#visible
  }

  /**
   * deletes the internal list of visible stars
   * this forces a full recalculation on the next eachVisible loop
   */
  unsetVisible() {
    this.#visible = []
    this.#hidden.clear()
  }

  /**
   * recalculates the internal list of visible stars
   * this is slower than StarArray.unsetVisible, but recalculates visibility immediately
   */
  updateVisible() {
    this.eachStar(() => {})
  }

  /** mimics StarArray.forEach but recalculates the visibility of all stars while looping */
  eachStar(...[callback, thisArg]: Parameters<Array<Star>['forEach']>) {
    this.unsetVisible()

    this.forEach((star, i, array) => {
      star.update(Star.pov)
      callback.call(thisArg, star, i, array)
      if (star.altitude > 0) {
        this.#visible.push(star)
      } else if (star.highTransit > 0) {
        this.#hidden.push(star)
      }
    })
  }

  /**
   * iterate through only the visible stars
   * updates the internal list of visible stars while executing
   * @param callback - function to be executed on each visible star
   */
  eachVisible(callback: (star: Star) => void) {
    // create new array to track visible stars
    const stillVisible: Star[] = []

    // safeguard against adding duplicate stars to the heap
    if (this.#visible.length === 0) {
      this.#hidden.clear()
    }

    while ((this.#hidden.top()?.update(Star.pov)?.altitude || 0) > 0) {
      const next = this.#hidden.pop()!
      callback(next)
      stillVisible.push(next)
    }

    // loop through the current list of visible stars
    // execute callback on any that are still visible
    // insert the rest into the #hidden heap
    for (let star of this.#visible.length ? this.#visible : this) {
      star.update(Star.pov)
      if (star.altitude > 0) {
        callback(star)
        stillVisible.push(star)
      } else if (star.highTransit > 0) {
        this.#hidden.push(star)
      }
    }

    // update list of visible stars
    this.#visible = stillVisible
  }
}

export {
  Star,
  StarSynth,
  StarArray,
  TimeAndPlace,
  noteFromAltitude,
  ampFromMagnitude,
}
