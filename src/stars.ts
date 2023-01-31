import type * as Interface from './types/skytunes'
import type { GlobalContext } from './global'
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
}

class Star implements Interface.Star {
  static context = globalContext
  static pov = new TimeAndPlace()

  readonly ref: number
  readonly ra: number
  readonly dec: number
  readonly mag: number

  highTransit: number = 0
  lowTransit: number = 0
  horizonTransit: number = 0

  #sinDec: number
  #cosDec: number

  #highNote: number = 0
  #queuedSynth: number | null = null
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

    this.recalculate = this.recalculate.bind(this)
    this.recalculate({
      date: Star.pov.date,
      long: Star.pov.long,
      lat: Star.pov.lat,
    })

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

  get nextTransit() {
    return (this.hourAngle * (-43200000 / Math.PI)) / Star.context.speed
  }

  #angleToRise = new CacheItem(() => {
    let ha = this.hourAngle
    if (ha > 0) ha = Math.PI * 2 - ha
    return Math.abs(ha) - Math.abs(this.horizonTransit)
  }, [this.#hourAngle])
  get angleToRise() {
    return this.#angleToRise.get()
  }

  // TODO shouldn't run if none of the options here have changed
  /** recalculate the star's properties based on what global data has changed */
  recalculate({ date, long, lat, speed }: Partial<GlobalContext>): Star {
    if (date !== undefined || long !== undefined) {
      this.#hourAngle.clear()
    }

    if (lat !== undefined) {
      this.#altitude.clear()

      // source: https://kalobs.org/more/altitudes-at-transit/
      this.highTransit = Math.asin(Math.cos(this.dec - Star.pov.lat))
      this.lowTransit = Math.asin(-Math.cos(this.dec + Star.pov.lat))
      let highNote = 1 - Math.abs(1 - this.highTransit / (Math.PI / 2))
      this.#highNote = highNote = 40 + highNote * 360

      this.horizonTransit =
        Math.PI - Math.acos(Math.tan(this.dec) * Math.tan(Star.pov.lat))
    }

    // queue a synth for when the star transits
    if (
      this.highTransit > 0 &&
      (this.#queuedSynth === null || speed !== undefined || long !== undefined)
    ) {
      if (this.#queuedSynth) clearTimeout(this.#queuedSynth)
      if (this.hourAngle < 0) this.queueSynth()
    }

    return this
  }

  /** queue a synth for the star's next high transit */
  queueSynth() {
    let queueTime = Math.floor(this.nextTransit) - 1000
    this.#queuedSynth = setTimeout(() => {
      let transit = this.nextTransit
      if (transit < 0) {
        this.#queuedSynth = null
        return
      }
      let synthEnd = this.synth.play(this.#highNote, {
        start: transit / 1000,
        speed: 10 / Star.context.speed,
      })
      setTimeout(() => {
        this.#queuedSynth = null
        this.#playingUntil = Star.pov.date.getTime() + synthEnd * 1000
      }, Math.ceil(transit))
    }, queueTime)
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
    } else {
      context.fillStyle = colors.yellow[200]
    }

    context.arc(x, y, r, 0, 2 * Math.PI)
    context.fill()

    return this
  }
}

class StarManager extends Array<Star> {
  static context = globalContext
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

    this.updateStars(StarManager.context)
    Star.context.addEventListener('update', ((event: CustomEvent) => {
      Star.pov.update(event.detail)
      this.updateStars(event.detail)
    }) as EventListener)

    Object.setPrototypeOf(this, StarManager.prototype)
  }

  getStar(ref: Star['ref']): Star {
    return this.#ref[ref]
  }

  get visible(): Star[] {
    return this.#visible
  }

  setVisible(star: Star) {
    this.#visible.push(star)
  }

  /**
   * mark a star as hidden (below the horizon)
   * uses a binary search algorithm to insert it in an array of hidden stars
   * reverse sorted by the order in which they will rise
   */
  queueRise(star: Star) {
    // binary search stars to find insertion point
    let target = star.angleToRise
    let left = 0
    let right = this.#nextToRise.length - 1
    let insert

    while (true) {
      let i = (((1 + right - left) / 2) | 0) + left // equivalent to Math.ceil((right - left) / 2) + left
      let star = this.#nextToRise[i]
      star.recalculate({ date: Star.pov.date })
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

  /** update all stars; recalculate visible and #nextToRise sort order */
  updateStars(props: Partial<GlobalContext> = {}) {
    this.#visible = []
    this.#nextToRise = []
    for (let star of this) {
      star.recalculate({ ...props, date: Star.pov.date })
      if (star.highTransit < 0) continue
      if (star.altitude > 0) {
        this.setVisible(star)
      } else {
        this.#nextToRise.push(star)
      }
    }
    this.#nextToRise.sort((a, b) => b.angleToRise - a.angleToRise)
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
    for (let star of this.#visible) {
      star.recalculate({ date: Star.pov.date })
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
      star.recalculate({ date: Star.pov.date })
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

export { Star, StarManager, TimeAndPlace }
