import { BSC } from './types/skytunes'
import globalContext from './global'
import { radianFromRa, radianFromDec } from './utilities'
import './tailwind.css'
import bsc from './bsc.json'
import { Star, StarManager, noteFromAltitude } from './stars'
import { SkyCanvas, FrameLoop, calculateMsPerFrame } from './draw'

let stars = new StarManager(
  bsc.map(
    (star: BSC) =>
      new Star(
        star['harvard_ref_#'],
        radianFromRa(star.RA),
        radianFromDec(star.DEC),
        Number(star.MAG)
      )
  )
)

const canvas = document.getElementById('canvas')!
const skyCanvas = new SkyCanvas(canvas)
const loop = new FrameLoop(60)

// main event loop
let timeSinceStarFrame = 0
let minMsPerFrame = calculateMsPerFrame(globalContext.speed, skyCanvas.radius)
let currentlyPlaying: Star[] = []
loop.animate((elapsed, repaint) => {
  let last: number = Star.pov.date.getTime()
  Star.pov.date = new Date(last + elapsed * globalContext.speed)

  currentlyPlaying.forEach(star => {
    if (star.synth.isPlaying) star.draw(skyCanvas)
  })

  timeSinceStarFrame += elapsed
  if (repaint || timeSinceStarFrame > minMsPerFrame) {
    skyCanvas.layers.stars.clear()
    stars.eachVisible(star => {
      skyCanvas.drawStar(star)
      if (star.hourAngle > -0.1 && star.hourAngle < 0 && !star.synth.isQueued) {
        // queue a synth for the star's next high transit
        let note = noteFromAltitude(star.highTransit, 40, 400)
        let stretch = 10 / globalContext.speed
        star.synth.play(note, {
          envelope: {
            attack: 0.05,
            decay: 0.15 * stretch,
            sustain: 0.66,
            release: 5 * stretch,
          },
          amp: 0.3,
          start: star.nextTransit / globalContext.speed / 1000,
        })
        currentlyPlaying[star.ref] = star
        star.synth.onEnded(() => {
          delete currentlyPlaying[star.ref]
        })
      }
    })
    timeSinceStarFrame = 0
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
globalContext.addEventListener('update', ((event: CustomEvent) => {
  Star.pov.update(event.detail)
  stars.unsetVisible()
  stars.forEach(star => {
    star.synth.cancel()
  })
  currentlyPlaying = []
  if (event.detail.speed !== undefined)
    minMsPerFrame = calculateMsPerFrame(event.detail.speed, skyCanvas.radius)
}) as EventListener)

// update geolocation when available
navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
  globalContext.update({
    date: new Date(timestamp),
    long: coords.longitude * (Math.PI / 180),
    lat: coords.latitude * (Math.PI / 180),
  })
  loop.repaint()
})

// settings controls
const speedSlider = document.getElementById('speed-control') as HTMLInputElement
speedSlider.value = globalContext.speed.toString()
speedSlider.addEventListener('input', () => {
  globalContext.update({ speed: Number(speedSlider.value) ** 2 })
})
;(window as any).context = globalContext
