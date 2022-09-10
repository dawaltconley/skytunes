import * as Interface from './types/skytunes'
import globalContext from './global'
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
    Star.context.addEventListener('update', ((event: CustomEvent) => {
      this.recalculate(event.detail as Partial<Interface.GlobalContext>)
    }) as EventListener)

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

  // TODO shouldn't run if none of the options here have changed
  recalculate({
    date,
    long,
    lat,
    speed,
  }: Partial<Interface.GlobalContext>): Star {
    // the hour angle can be used to calculate when the star will cross the meridian
    // negative hour angles = moving towards the meridian
    // positive hour angles = moving away from meridian
    // an hour angle of zero occurs when the star passes the meridian
    if (date !== undefined || long !== undefined) {
      this.hourAngle = (Star.context.lst - this.ra) % (2 * Math.PI)
      if (this.hourAngle > Math.PI) this.hourAngle -= 2 * Math.PI
    }

    if (lat !== undefined) {
      // source: https://kalobs.org/more/altitudes-at-transit/
      this.highTransit = Math.asin(Math.cos(this.dec - Star.context.lat))
      this.lowTransit = Math.asin(-Math.cos(this.dec + Star.context.lat))
      let highNote = 1 - Math.abs(1 - this.highTransit / (Math.PI / 2))
      this.#highNote = highNote = 40 + highNote * 360
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
          let synthEnd = this.synth.play(this.#highNote, {
            start: transit / 1000,
            speed: 10 / Star.context.speed,
          })
          setTimeout(() => {
            this.#queuedSynth = null
            this.#playingUntil = Star.context.date.getTime() + synthEnd * 1000
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
    } else {
      context.fillStyle = colors.yellow[200]
    }

    context.arc(x, y, r, 0, 2 * Math.PI)
    context.fill()

    return this
  }
}

export { Star }
