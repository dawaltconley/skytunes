import type * as Interface from './types/skytunes'
import type { SkyCanvas } from './draw'
import globalContext from './global'
import { CacheItem } from './cache'
import { getLST } from './utilities'
import colors from 'tailwindcss/colors'

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
    this.date = date ?? this.date
    this.long = long ?? this.long
    this.lat = lat ?? this.lat
  }
}

interface Envelope {
  attack: number
  decay: number
  sustain: number
  release: number
}

// class EnvNode extends GainNode {
//   env: Envelope
//   amp: number = 1
//   constructor(
//     context: AudioContext,
//     { env, amp = 1, start }: { env: Envelope; amp?: number; start?: number }
//   ) {
//     super(context)
//     this.env = env
//     this.amp = amp
//
//     if (start !== undefined) this.start(start)
//   }
//
//   start(when: number = 0) {
//     this.gain.cancelScheduledValues(0)
//     let { attack, decay, sustain, release } = this.env
//     attack = when + attack
//     decay = attack + decay
//     release = decay + release
//     this.gain
//       .setValueAtTime(0, when)
//       .linearRampToValueAtTime(this.amp, attack)
//       .linearRampToValueAtTime(this.amp * sustain, decay)
//       .linearRampToValueAtTime(0, release)
//   }
// }

interface EnvOscillatorOptions extends OscillatorOptions {
  env: Envelope
  amp?: number
}

// nice about this:
// 1. extending gives direct access to the 'ended' event
// 2. extending gives direct access to the stop method
//
// problems
// 1.
class EnvOscillatorNode extends OscillatorNode {
  env: Envelope
  amp: number = 1
  constructor(
    context: AudioContext,
    { env, amp = 1, ...options }: EnvOscillatorOptions
  ) {
    super(context, options)
    this.env = env
    this.amp = amp
    // this.start()
    ;(window as any).context = context
    ;(window as any).envNode = this
  }

  start(when?: number, speed: number = 1) {
    const { context, amp } = this
    const start = context.currentTime + (when ?? 0)
    // console.log(context, context.currentTime, amp)
    let { attack, decay, sustain, release } = this.env
    attack = start + attack
    decay = attack + decay * speed
    release = decay + release * speed

    // console.log({ context, start, attack, decay, release })

    let gainNode = context.createGain()
    gainNode.gain
      .setValueAtTime(0, start)
      .linearRampToValueAtTime(amp, attack)
      .linearRampToValueAtTime(amp * sustain, decay)
      .linearRampToValueAtTime(0, release)

    this.connect(gainNode).connect(context.destination)
    // window.setTimeout(() => super.stop(release + 0.2), 0)
    // return super.start(start)
    super.start(start)
    this.stop(release + 0.2)
  }
}

// goals:
// 1. expose ended event
// 2. expose AnalyserNode or an array of analysed values for animating
// 3. expose a stop/cancel method to cancel queued audio
class StarSynth {
  ctx: AudioContext
  env: Envelope
  amp: number = 1
  constructor(
    context: AudioContext,
    { env, amp = 1 }: { env: Envelope; amp?: number }
  ) {
    this.ctx = context
    this.env = env
    this.amp = amp
  }

  /**
   * play a synth
   * @return the AudioContext time at which the synth stops
   */
  play(
    note: number,
    { start = 0, speed = 1 }: { start?: number; speed?: number }
  ): number {
    const { ctx, amp } = this
    const play = ctx.currentTime + start
    let { attack, decay, sustain, release } = this.env
    attack = play + attack
    decay = attack + decay * speed
    release = decay + release * speed

    let oscillator = ctx.createOscillator()
    oscillator.frequency.setValueAtTime(note, 0)

    let gainNode = ctx.createGain()
    gainNode.gain
      .setValueAtTime(0, play)
      .linearRampToValueAtTime(amp, attack)
      .linearRampToValueAtTime(amp * sustain, decay)
      .linearRampToValueAtTime(0, release)

    oscillator.connect(gainNode).connect(ctx.destination)
    oscillator.start(play)
    oscillator.stop(release + 1)

    return release
  }

  // queue(note: number, start: number, { speed = 1 }: { speed?: number }) {}
}

class Star implements Interface.Star {
  static context = globalContext
  static pov = new TimeAndPlace()

  readonly ref: number
  readonly ra: number
  readonly dec: number
  readonly mag: number

  #sinDec: number
  #cosDec: number

  #queuedSynth?: number
  #playingUntil?: number

  synth: StarSynth

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

    this.synth = new StarSynth(Star.context.audio, {
      env: {
        attack: 0.05,
        decay: 0.15,
        sustain: 0.66,
        release: 5,
      },
      amp: 0.3,
    })
  }

  #hourAngle = new CacheItem(() => {
    let hourAngle = (Star.pov.lst - this.ra) % (2 * Math.PI)
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

  #highNote = new CacheItem(() => {
    let highNote = 1 - Math.abs(1 - this.highTransit / (Math.PI / 2))
    return 40 + highNote * 360
  }, [this.#highTransit])
  get highNote() {
    return this.#highNote.get()
  }

  get nextTransit() {
    return (this.hourAngle * (-43200000 / Math.PI)) / Star.context.speed
  }

  /** queue a synth for the star's next high transit */
  queueSynth() {
    let queueTime = Math.floor(this.nextTransit) - 1000
    this.#queuedSynth = setTimeout(() => {
      let transit = this.nextTransit
      if (transit < 0) {
        this.#queuedSynth = undefined
        return
      }
      let synthEnd = this.synth.play(this.#highNote.get(), {
        start: transit / 1000,
        speed: 10 / Star.context.speed,
      })
      setTimeout(() => {
        this.#queuedSynth = undefined
        this.#playingUntil = Star.pov.date.getTime() + synthEnd * 1000
      }, Math.ceil(transit))
    }, queueTime)
    return this
  }

  clearSynth() {
    clearTimeout(this.#queuedSynth)
    this.#queuedSynth = undefined
  }

  get hasQueuedSynth(): boolean {
    return this.#queuedSynth !== undefined
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

  logVega() {
    if (this.ref === 7001) this.log()
  }

  /** draw the star's position on a canvas */
  draw(canvas: SkyCanvas): Star {
    let { context } = canvas.layers.stars
    let { center, radius } = canvas
    let x = Math.cos(this.theta) * this.rho,
      y = Math.sin(this.theta) * this.rho
    x = x * radius + center.x
    y = y * radius + center.y
    let r = (8 - this.mag) * (radius * 0.0008)

    context.beginPath()

    if (this.#playingUntil) {
      r += 2
      context.fillStyle = colors.blue[100]
      if (Star.pov.date.getTime() > this.#playingUntil) {
        this.#playingUntil = undefined
      } else {
        requestAnimationFrame(() => this.draw(canvas))
      }
    } else if (this.ref === 7001) {
      // vega
      context.fillStyle = 'red'
    } else {
      context.fillStyle = colors.yellow[200]
    }

    context.arc(x, y, r, 0, 2 * Math.PI)
    context.fill()

    return this
  }
}

class StarManager extends Array<Star> {
  static get pov() {
    return Star.pov
  }

  #ref: Star[] = []
  #visible: Star[] = []
  #nextToRise: Star[] = []

  constructor(stars: Star[]) {
    super()
    this.push(...stars) // maybe return only visible
    this.#ref = stars.reduce((indexed, star) => {
      indexed[star.ref] = star
      return indexed
    }, [] as Star[])
    this.updateVisible()

    Object.setPrototypeOf(this, StarManager.prototype)
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
   * this is slower than StarManager.unsetVisible, but recalculates visibility immediately
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

  /** mimics StarManager.forEach but recalculates the visibility of all stars while looping */
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

export { EnvOscillatorNode, Star, StarManager, TimeAndPlace }
