import { BSC } from './types/skytunes'
import globalContext from './global'
import { radianFromRa, radianFromDec } from './utilities'
import './tailwind.css'
import colors from 'tailwindcss/colors'
import bsc from './bsc.json'
import { Star, StarSynth, StarArray, noteFromAltitude } from './stars'
import { SkyCanvas, FrameLoop, calculateMsPerFrame } from './draw'
import { updateDateDisplay } from './settings'

const stars = new StarArray(
  ...bsc.map(
    (star: BSC) =>
      new Star(
        star['harvard_ref_#'],
        radianFromRa(star.RA),
        radianFromDec(star.DEC),
        Number(star.MAG)
      )
  )
)

const synths = new Map<Star['ref'], StarSynth>(
  stars.map(star => [star.ref, new StarSynth()])
)

const canvas = document.getElementById('canvas')!
const skyCanvas = new SkyCanvas(canvas)
const loop = new FrameLoop(60)

let timeSinceStarFrame = 0
let minMsPerFrame = calculateMsPerFrame(globalContext.speed, skyCanvas.radius)
let currentlyPlaying = new Map<
  Star['ref'],
  {
    synth: StarSynth
    frequencyData: Uint8Array
  }
>()

// main event loop
loop.animate((elapsed, repaint) => {
  // highlight any playing stars
  skyCanvas.layers.shimmer.clear()
  currentlyPlaying.forEach(({ synth, frequencyData }, starRef) => {
    if (synth.isPlaying) {
      synth.analyser.getByteFrequencyData(frequencyData)
      const dB = frequencyData[0]
      // TODO use getByteTimeDomainData as well to add pulse animation
      const radius = (dB * skyCanvas.radius * 0.008) / 256
      skyCanvas.drawStar(stars.getStar(starRef), {
        layer: skyCanvas.layers.shimmer,
        color: colors.blue[100],
        radius,
      })
    }
  })

  // draw all visible stars (only as often as needed)
  timeSinceStarFrame += elapsed
  if (repaint || timeSinceStarFrame > minMsPerFrame) {
    let last: number = Star.pov.date.getTime()
    Star.pov.date = new Date(last + timeSinceStarFrame * globalContext.speed)

    skyCanvas.layers.stars.clear()
    stars.eachVisible(star => {
      skyCanvas.drawStar(star)
      const synth = synths.get(star.ref)
      if (!synth || synth.isQueued) return

      // queue synth for upcoming transits
      let note: number, start: number
      if (star.hourAngle < 0) {
        // high transit
        note = noteFromAltitude(star.highTransit, 40, 400)
        start = star.timeToAngle(0) / globalContext.speed / 1000
      } else if (star.lowTransit > 0) {
        // low transit
        note = noteFromAltitude(star.lowTransit, 40, 400)
        start = star.timeToAngle(Math.PI) / globalContext.speed / 1000
      } else {
        // no low transit
        return
      }

      const stretch = 10 / globalContext.speed
      synth.play(note, {
        envelope: {
          attack: 0.05,
          decay: 0.15 * stretch,
          sustain: 0.66,
          release: 5 * stretch,
        },
        amp: 0.3,
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
    updateDateDisplay(Star.pov.date)
  }
})
loop.repaint()

// recalculate canvas size when resized
let resizeTimeout: number
const observer = new ResizeObserver(() => {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    skyCanvas.setCanvasSize()
    skyCanvas.drawBackground()
    loop.repaint()
  }, 100)
})
observer.observe(skyCanvas.container)

// listen for updates to the global context
globalContext.listen('update', event => {
  const { date, lat, long, speed } = event.detail
  if (date ?? lat ?? long ?? false) {
    Star.pov.update(event.detail)
    stars.unsetVisible()
  }
  if (date ?? speed ?? false) {
    timeSinceStarFrame = 0
  }
  synths.forEach(synth => synth.cancel())
  currentlyPlaying.clear()
  loop.repaint()
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
;(window as any).context = globalContext
