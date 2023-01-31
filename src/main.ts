import type { BSC } from './types/skytunes'
import type { DateTimePicker } from './custom-elements/date-time-picker'
import globalContext from './lib/global'
import colors from './data/colors'
import {
  TimeAndPlace,
  Star,
  StarArray,
  radianFromRa,
  radianFromDec,
} from './lib/stars'
import { StarSynth, noteFromAltitude, ampFromMagnitude } from './lib/audio'
import { SkyCanvas, FrameLoop, calculateMsPerFrame } from './lib/draw'

let stars = new StarArray()

import('./data/bsc.json').then(data => {
  const bsc = data.default
  stars = new StarArray(
    ...bsc.map(
      (star: BSC) =>
        new Star(
          star['harvard_ref_#'],
          radianFromRa(star.RA),
          radianFromDec(star.DEC),
          Number(star.MAG),
        ),
    ),
  )
})

const synths = new Map<Star['ref'], StarSynth>()
const currentlyPlaying = new Map<
  Star['ref'],
  {
    synth: StarSynth
    frequencyData: Uint8Array
  }
>()

globalContext.listen('audio', event => {
  const { audio } = event.detail
  if (audio) {
    const compressor = new DynamicsCompressorNode(audio)
    compressor.connect(audio.destination)
    stars.forEach(star => {
      synths.set(
        star.ref,
        new StarSynth(audio, {
          queueBuffer: 0.2,
          output: compressor,
        }),
      )
    })
  }
})

const datePicker = document.getElementById(
  'datetimepicker',
) as DateTimePicker | null
const canvas = document.getElementById('canvas')
if (!canvas) {
  throw new Error('Couln\'t get canvas element by id "canvas"')
}

const skyCanvas = new SkyCanvas(canvas)
const loop = new FrameLoop(60)

let timeSinceStarFrame = 0
let minMsPerFrame = calculateMsPerFrame(globalContext.speed, skyCanvas.radius)

// main event loop
loop.animate((elapsed, repaint) => {
  // highlight any playing stars
  skyCanvas.layers.shimmer.clear()
  currentlyPlaying.forEach(({ synth, frequencyData }, starRef) => {
    if (synth.isPlaying && synth.analyser) {
      synth.analyser.getByteFrequencyData(frequencyData)
      const dB = frequencyData[0]
      // TODO use getByteTimeDomainData as well to add pulse animation
      const radius = (dB * skyCanvas.radius * 0.008) / 256
      skyCanvas.drawStar(stars.getStar(starRef), {
        layer: skyCanvas.layers.shimmer,
        color: colors.sky.starActive,
        radius,
      })
    }
  })

  // if time since last frame is > a certain amount (1000ms?) need to refresh the heap of hidden stars
  if (elapsed > 1000) {
    stars.unsetVisible()
  }

  // draw all visible stars (only as often as needed)
  timeSinceStarFrame += elapsed
  if (repaint || timeSinceStarFrame > minMsPerFrame) {
    const { audio, speed } = globalContext

    const last: number = Star.pov.date.getTime()
    Star.pov = new TimeAndPlace(
      new Date(last + timeSinceStarFrame * speed),
      Star.pov.long,
      Star.pov.lat,
    )

    skyCanvas.layers.stars.clear()
    stars.eachVisible(star => {
      skyCanvas.drawStar(star)

      const synth = synths.get(star.ref)
      if (
        !synth ||
        synth.isQueued ||
        currentlyPlaying.has(star.ref) ||
        audio?.state !== 'running' ||
        globalContext.isMuted
      )
        return

      // queue synth for upcoming transits
      let note: number, start: number
      if (star.hourAngle < 0) {
        // high transit
        note = noteFromAltitude(star.highTransit, 40, 400)
        start = star.timeToAngle(0) / speed / 1000
      } else if (star.lowTransit > 0) {
        // low transit
        note = noteFromAltitude(star.lowTransit, 40, 400)
        start = star.timeToAngle(Math.PI) / speed / 1000
      } else {
        // no low transit
        return
      }

      const stretch = 10 / speed
      synth.play(note, {
        envelope: {
          attack: 0.05,
          decay: 0.15 * stretch,
          sustain: 0.66,
          release: 5 * stretch,
        },
        amp: ampFromMagnitude(star.mag, {
          max: 0.4,
          brightest: stars.brightest.mag,
          dimmest: stars.dimmest.mag,
        }),
        start,
      })
      synth.addEventListener('started', () => {
        currentlyPlaying.set(star.ref, {
          synth,
          frequencyData: new Uint8Array(1),
        })
      })
      synth.addEventListener('ended', () => currentlyPlaying.delete(star.ref))
    })
    timeSinceStarFrame = 0

    // check if date-time-picker custom element has been defined
    if (datePicker?.updateDisplay) {
      datePicker.updateDisplay(Star.pov.date)
    }
  }
})
loop.repaint()

// recalculate canvas size when resized
let resizeTimeout: number
const observer = new ResizeObserver(() => {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = window.setTimeout(() => {
    skyCanvas.setCanvasSize()
    skyCanvas.drawBackground()
    loop.repaint()
  }, 100)
})
observer.observe(skyCanvas.container)

/** @return true if any of the arguments are not undefined */
const any = (...args: unknown[]): boolean => args.some(arg => arg !== undefined)

// listen for updates to the global context
globalContext.listen('update', event => {
  const { date, lat, long, speed, isMuted } = event.detail
  if (any(date, lat, long)) {
    Star.pov = TimeAndPlace.from(Star.pov, event.detail)
    stars.unsetVisible()
  }
  if (any(date, speed)) {
    timeSinceStarFrame = 0
  }
  if (any(date, lat, long, speed, isMuted)) {
    synths.forEach(synth => synth.cancel())
    currentlyPlaying.clear()
  }
  if (any(date, lat, long, speed)) {
    loop.repaint()
  }
})

globalContext.listen('speed', event => {
  const { speed } = event.detail
  minMsPerFrame = calculateMsPerFrame(speed, skyCanvas.radius)
})

// update geolocation when available
navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
  globalContext.update({
    date: new Date(timestamp),
    long: coords.longitude * (Math.PI / 180),
    lat: coords.latitude * (Math.PI / 180),
  })
})

// ;(window as any).context = globalContext
// ;(window as any).canvas = skyCanvas
// ;(window as any).stars = stars
