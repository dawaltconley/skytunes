import * as Interface from './types/skytunes'
import globalContext from './global'
import { CacheItem } from './cache'
import colors from 'tailwindcss/colors'

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
      date: Star.context.date,
      long: Star.context.long,
      lat: Star.context.lat,
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
    let hourAngle = (Star.context.lst - this.ra) % (2 * Math.PI)
    if (hourAngle > Math.PI) hourAngle -= 2 * Math.PI
    return hourAngle
  })
  get hourAngle(): number {
    return this.#hourAngle.get()
  }

  #altitude = new CacheItem(
    () =>
      Math.asin(
        this.#sinDec * Star.context.sinLat +
          this.#cosDec * Star.context.cosLat * Math.cos(this.hourAngle)
      ),
    [this.#hourAngle]
  )
  get altitude(): number {
    return this.#altitude.get()
  }

  #azimuth = new CacheItem(() => {
    let azimuth = Math.acos(
      (this.#sinDec - Math.sin(this.altitude) * Star.context.sinLat) /
        (Math.cos(this.altitude) * Star.context.cosLat)
    )
    if (this.hourAngle > 0) azimuth = Math.PI * 2 - azimuth
    return azimuth
  }, [this.#hourAngle, this.#altitude])
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

  get timeToRise(): number {
    let angleUnder = this.hourAngle - Math.abs(this.horizonTransit)
    console.log({ angleUnder })
    let msToRise =
      ((this.horizonTransit - angleUnder) * (43200000 / Math.PI)) /
      StarManager.context.speed
    return msToRise
  }

  // get timeSinceSet(): number {
  //   let angleUnder = this.hourAngle - Math.abs(this.horizonTransit)
  //   console.log({ angleUnder })
  //
  // }

  // TODO shouldn't run if none of the options here have changed
  recalculate({
    date,
    long,
    lat,
    speed,
  }: Partial<Interface.GlobalContext>): Star {
    if (date !== undefined || long !== undefined) {
      this.#hourAngle.clear()
    }

    if (lat !== undefined) {
      this.#altitude.clear()

      // source: https://kalobs.org/more/altitudes-at-transit/
      this.highTransit = Math.asin(Math.cos(this.dec - Star.context.lat))
      this.lowTransit = Math.asin(-Math.cos(this.dec + Star.context.lat))
      let highNote = 1 - Math.abs(1 - this.highTransit / (Math.PI / 2))
      this.#highNote = highNote = 40 + highNote * 360

      this.horizonTransit =
        Math.PI - Math.acos(Math.tan(this.dec) * Math.tan(Star.context.lat))
    }

    // // queue a synth for when the star transits
    // if (
    //   this.highTransit > 0 &&
    //   (this.#queuedSynth === null || speed !== undefined || long !== undefined)
    // ) {
    //   if (this.#queuedSynth) clearTimeout(this.#queuedSynth)
    //   if (this.hourAngle < 0) this.queueSynth()
    // }

    return this
  }

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
        this.#playingUntil = Star.context.date.getTime() + synthEnd * 1000
      }, Math.ceil(transit))
    }, queueTime)
    return this
  }

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

  draw(): Star {
    if (!Star.context.canvas) return this
    let { context, center, radius } = Star.context.canvas
    let x = Math.cos(this.theta) * this.rho,
      y = Math.sin(this.theta) * this.rho
    x = x * radius + center.x
    y = y * radius + center.y
    let r = (8 - this.mag) * (radius * 0.0008)

    context.beginPath()

    if (this.#playingUntil) {
      r += 2
      context.fillStyle = colors.blue[100]
      if (Star.context.date.getTime() > this.#playingUntil) {
        this.#playingUntil = undefined
      } else {
        requestAnimationFrame(() => this.draw())
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
  static context = globalContext

  #ref: Interface.Star[] = []
  #visible: Interface.Star[] = []
  #setVisibleTimeouts: number[] = []

  constructor(stars: Star[]) {
    super()
    this.push(...stars) // maybe return only visible
    this.#ref = stars.reduce((indexed, star) => {
      indexed[star.ref] = star
      return indexed
    }, [] as Interface.Star[])

    this.updateStars(StarManager.context)
    Star.context.addEventListener('update', ((event: CustomEvent) => {
      this.updateStars(event.detail)
    }) as EventListener)

    Object.setPrototypeOf(this, StarManager.prototype)
  }

  getStar(ref: Interface.Star['ref']): Interface.Star {
    return this.#ref[ref]
  }

  get visible(): Interface.Star[] {
    return this.#visible
  }

  setVisible(star: Interface.Star) {
    this.#visible.push(star)
    clearTimeout(this.#setVisibleTimeouts[star.ref])
    delete this.#setVisibleTimeouts[star.ref]
  }

  queueRise(star: Interface.Star) {
    // // if star.highTransit < 0 ? or if star.horizonTransit !== NaN
    // // star.hourAngle is probably ~90deg to 180deg or -180deg to ~-90deg
    // // need difference between that angle and horizonTransit ~90deg
    // // hourAngle + 180deg = hourAngle of 0 - 360deg, increasing the closer it gets to meridian
    // // hourAngle - 180deg = hourAngle of -3
    // let ha = star.hourAngle
    // if (ha > 0) ha -= Math.PI * 2
    // let angleToRise = Math.abs(star.horizonTransit) + ha
    // let msToRise =
    //   (angleToRise * (-43200000 / Math.PI)) / StarManager.context.speed

    // let timeUnder = Math.acos(
    //   Math.tan(StarManager.context.lat) * Math.tan(star.dec)
    // )
    // let msToRise =
    //   (timeUnder * (43200000 / Math.PI)) / StarManager.context.speed

    const getTimeToRise = (star: Interface.Star, speed: number): number => {
      let ha = star.hourAngle
      if (ha > 0) ha = Math.PI * 2 - ha
      let angleToRise = Math.abs(ha) - Math.abs(star.horizonTransit)
      if (star.ref === 7001)
        console.log({ ha, angleToRise, horizonTransit: star.horizonTransit })
      let msToRise = (angleToRise * (43200000 / Math.PI)) / speed
      return msToRise
    }

    this.#setVisibleTimeouts[star.ref] = setTimeout(() => {
      this.setVisible(star)
      if (star.ref === 7001) console.log('vega visible')
      // this.setVisible.bind(this, star)
    }, getTimeToRise(star, StarManager.context.speed) - 100)
  }

  updateStars(props: Partial<Interface.GlobalContext> = {}) {
    console.log('running update', props)
    this.#visible = []
    for (let star of this) {
      star.recalculate(props)
      clearTimeout(this.#setVisibleTimeouts[star.ref])
      if (star.highTransit < 0) continue
      if (star.altitude > 0) {
        this.setVisible(star)
      } else {
        this.queueRise(star)
      }
    }
  }

  // assuming no empty elements in visible array
  // fastest way to remove elements that have become no longer visible
  eachVisible(callback: (star: Interface.Star) => void) {
    const stillVisible: Interface.Star[] = []
    console.log(this.#visible.length)
    for (let star of this.#visible) {
      // recalculate position / visibility here?
      star.recalculate({ date: StarManager.context.date })

      // treat stars as visible if they are rising / have passed the antimeridian
      // this allows treating stars that are 'about to rise' as 'visible'
      // and to work with the setInvisible timeout
      if (star.altitude > 0) {
        callback(star)
        stillVisible.push(star)
      } else if (star.hourAngle < 0) {
        stillVisible.push(star)
      } else {
        this.queueRise(star)
      }
    }
    this.#visible = stillVisible
  }
}

export { Star, StarManager }
