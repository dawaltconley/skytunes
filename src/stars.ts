import type * as Interface from './types/skytunes'
import { CacheItem } from './cache'
import { getLST } from './utilities'

class TimeAndPlace implements Interface.TimeAndPlace {
  constructor(
    date: Date = new Date(),
    longitude: number = 0,
    latitude: number = 0
  ) {
    this.date = date
    this.long = longitude
    this.lat = latitude
  }

  // should be start / end date
  #date = new CacheItem(() => new Date())
  get date(): Date {
    return this.#date.get()
  }
  set date(d: Date) {
    this.#date.set(d)
  }

  #long = new CacheItem(() => 0)
  get long(): number {
    return this.#long.get()
  }
  set long(n: number) {
    this.#long.set(n)
  }

  #lat = new CacheItem(() => 0)
  get lat(): number {
    return this.#lat.get()
  }
  set lat(n: number) {
    this.#lat.set(n)
  }

  #lst = new CacheItem(
    () => getLST(this.date, this.long),
    [this.#date, this.#long]
  )
  get lst(): number {
    return this.#lst.get()
  }

  #sinLat = new CacheItem(() => Math.sin(this.lat), [this.#lat])
  get sinLat() {
    return this.#sinLat.get()
  }

  #cosLat = new CacheItem(() => Math.cos(this.lat), [this.#lat])
  get cosLat() {
    return this.#cosLat.get()
  }

  cache = Object.freeze({
    date: this.#date,
    long: this.#long,
    lat: this.#lat,
    lst: this.#lst,
    sinLat: this.#sinLat,
    cosLat: this.#cosLat,
  })

  update(options: Partial<{ date: Date; long: number; lat: number }>) {
    let { date, long, lat } = options
    if (date !== undefined) this.date = date
    if (long !== undefined) this.long = long
    if (lat !== undefined) this.lat = lat
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
}

class StarSynth extends EventTarget {
  readonly context: AudioContext
  readonly analyser: AnalyserNode
  readonly queueBuffer: number
  #oscillator?: OscillatorNode
  #gain?: GainNode
  #queued?: number
  #isPlaying: boolean = false

  #startedEvent = new CustomEvent('started', { detail: this })
  #endedEvent = new CustomEvent('ended', { detail: this })

  constructor(context: AudioContext, options: StarSynthOptions = {}) {
    const { queueBuffer = 1 } = options
    super()
    this.context = context
    this.analyser = new AnalyserNode(context, {
      fftSize: 32,
    })

    this.queueBuffer = queueBuffer
  }

  get oscillator(): OscillatorNode | undefined {
    return this.#oscillator
  }

  get gain(): GainNode | undefined {
    return this.#gain
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

    this.#queued = setTimeout(() => {
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

      // on started
      this.#queued = setTimeout(() => {
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
      })

      this.#oscillator
        .connect(this.#gain)
        .connect(this.analyser)
        .connect(context.destination)
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

class Star implements Interface.Star {
  static pov = new TimeAndPlace()

  readonly ref: number
  readonly ra: number
  readonly dec: number
  readonly mag: number

  #sinDec: number
  #cosDec: number

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
  }

  #hourAngle = new CacheItem(() => {
    let hourAngle = (Star.pov.lst - this.ra) % (2 * Math.PI)
    if (hourAngle < 0) hourAngle += 2 * Math.PI
    if (hourAngle > Math.PI) hourAngle -= 2 * Math.PI
    return hourAngle
  }, [Star.pov.cache.lst])
  get hourAngle(): number {
    return this.#hourAngle.get()
  }

  #altitude = new CacheItem(
    () =>
      Math.asin(
        this.#sinDec * Star.pov.sinLat +
          this.#cosDec * Star.pov.cosLat * Math.cos(this.hourAngle)
      ),
    [this.#hourAngle, Star.pov.cache.sinLat, Star.pov.cache.cosLat]
  )
  get altitude(): number {
    return this.#altitude.get()
  }

  #azimuth = new CacheItem(() => {
    let azimuth = Math.acos(
      (this.#sinDec - Math.sin(this.altitude) * Star.pov.sinLat) /
        (Math.cos(this.altitude) * Star.pov.cosLat)
    )
    if (this.hourAngle > 0) azimuth = Math.PI * 2 - azimuth
    return azimuth
  }, [
    this.#hourAngle,
    this.#altitude,
    Star.pov.cache.sinLat,
    Star.pov.cache.cosLat,
  ])
  get azimuth(): number {
    return this.#azimuth.get()
  }

  #theta = new CacheItem(() => Math.PI / 2 - this.azimuth, [this.#azimuth])
  get theta() {
    return this.#theta.get()
  }

  #rho = new CacheItem(() => Math.cos(this.altitude), [this.#altitude])
  get rho() {
    return this.#rho.get()
  }

  #highTransit = new CacheItem(
    () => Math.asin(Math.cos(this.dec - Star.pov.lat)),
    [Star.pov.cache.lat]
  )
  get highTransit() {
    return this.#highTransit.get()
  }

  #lowTransit = new CacheItem(
    () => Math.asin(-Math.cos(this.dec + Star.pov.lat)),
    [Star.pov.cache.lat]
  )
  get lowTransit() {
    return this.#lowTransit.get()
  }

  #horizonTransit = new CacheItem(
    () => Math.PI - Math.acos(Math.tan(this.dec) * Math.tan(Star.pov.lat)),
    [Star.pov.cache.lat]
  )
  get horizonTransit() {
    return this.#horizonTransit.get()
  }

  #angleToRise = new CacheItem(() => {
    let ha = this.hourAngle
    if (ha > 0) ha = Math.PI * 2 - ha
    return Math.abs(ha) - Math.abs(this.horizonTransit)
  }, [this.#hourAngle, this.#horizonTransit])
  get angleToRise() {
    return this.#angleToRise.get()
  }

  cache = Object.freeze({
    hourAngle: this.#hourAngle,
    altitude: this.#altitude,
    azimuth: this.#azimuth,
    theta: this.#theta,
    rho: this.#rho,
    highTransit: this.#highTransit,
    lowTransit: this.#lowTransit,
    horizonTransit: this.#horizonTransit,
    angleToRise: this.#angleToRise,
  })

  timeToAngle(target: number): number {
    return (target - this.hourAngle) * (43200000 / Math.PI)
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

class StarArray extends Array<Star> {
  static get pov() {
    return Star.pov
  }

  #ref: Star[] = []
  #visible: Star[] = []
  #nextToRise: Star[] = []

  constructor(...stars: Star[]) {
    super(...stars)
    this.#ref = stars.reduce((indexed, star) => {
      indexed[star.ref] = star
      return indexed
    }, [] as Star[])
    this.updateVisible()

    Object.setPrototypeOf(this, StarArray.prototype)
  }

  getStar(ref: Star['ref']): Star {
    return this.#ref[ref]
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
    this.#nextToRise = []
  }

  /**
   * recalculates the internal list of visible stars
   * this is slower than StarArray.unsetVisible, but recalculates visibility immediately
   */
  updateVisible() {
    this.eachStar(() => {})
  }

  /**
   * mark a star as hidden (below the horizon)
   * uses a binary search algorithm to insert it in an array of hidden stars
   * reverse sorted by the order in which they will rise
   */
  queueRise(star: Star) {
    // ignore stars that never rise
    if (star.highTransit < 0) return

    // handle an empty nextToRise array
    if (this.#nextToRise.length === 0) {
      this.#nextToRise.push(star)
      return
    }

    // binary search stars to find insertion point
    let target = star.angleToRise
    let left = 0
    let right = this.#nextToRise.length - 1
    let insert

    while (true) {
      let i = (((1 + right - left) / 2) | 0) + left // equivalent to Math.ceil((right - left) / 2) + left
      let star = this.#nextToRise[i]
      if (star.angleToRise > target) {
        // search right
        if (right - left < 2) {
          insert = i + 1
          break
        }
        left = i + 1
      } else {
        // search left
        if (right === left) {
          insert = i
          break
        }
        right = i - 1
      }
    }

    this.#nextToRise.splice(insert, 0, star)
  }

  /** mimics StarArray.forEach but recalculates the visibility of all stars while looping */
  eachStar(...[callback, thisArg]: Parameters<Array<Star>['forEach']>) {
    this.#visible = []
    this.#nextToRise = []

    this.forEach((star, i, array) => {
      callback.call(thisArg, star, i, array)
      if (star.altitude > 0) {
        this.#visible.push(star)
      } else {
        this.queueRise(star)
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

    // loop through the current list of visible stars
    // execute callback on any that are still visible
    // insert the rest into #nextToRise ordered array
    for (let star of this.#visible.length ? this.#visible : this) {
      if (star.altitude > 0) {
        callback(star)
        stillVisible.push(star)
      } else {
        this.queueRise(star)
      }
    }

    // reverse iterate the #nextToRise array
    // if a star has risen, execute callback mark it as visible, and continue
    // break on the first star that is still under the horizon
    for (let i = this.#nextToRise.length - 1; i > -1; i--) {
      let star = this.#nextToRise[i]
      if (star.altitude > 0) {
        callback(star)
        stillVisible.push(star)
        this.#nextToRise.pop()
      } else {
        break
      }
    }

    // update list of visible stars
    this.#visible = stillVisible
  }
}

export { Star, StarSynth, StarArray, TimeAndPlace, noteFromAltitude }
