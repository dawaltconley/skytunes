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

export class StarSynth extends EventTarget {
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
    { queueBuffer = 1, output = context.destination }: StarSynthOptions = {},
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
    }: { envelope: Envelope; amp?: number; start?: number },
  ): void {
    const { context } = this
    const play = context.currentTime + start
    let { attack, decay, sustain, release } = envelope
    attack = play + attack
    decay = attack + decay
    release = decay + release

    this.#queued = window.setTimeout(
      () => {
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
        this.#queued = window.setTimeout(
          () => {
            this.dispatchEvent(this.#startedEvent)
            this.#queued = undefined
            this.#isPlaying = true
          },
          (play - context.currentTime) * 1000,
        )

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
      },
      Math.floor((start - this.queueBuffer) * 1000),
    )
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

const highNote = Math.log2(Math.PI / 2)
export const noteFromAltitude = (
  altitude: number,
  min: number,
  max: number,
): number => {
  let scale = 1 - Math.abs(1 - Math.log2(altitude) / highNote)
  console.log(scale)
  return min + scale * (max - min)
}

// 40 hz = 1
// 80 hz = 2
// 160 hz = 3
// 320 hz = 4

export const ampFromMagnitude = (
  magnitude: number,
  options: {
    min?: number
    max?: number
    brightest?: number
    dimmest?: number
  } = {},
): number => {
  const { min = 0, max = 1, brightest = 0, dimmest = 8 } = options
  let range = dimmest - brightest
  let scale = (dimmest - magnitude) / range
  return min + scale * (max - min)
}
