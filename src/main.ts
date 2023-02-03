import { BSC } from './types/skytunes'
import globalContext from './global'
import { radianFromRa, radianFromDec } from './utilities'
import './tailwind.css'
import bsc from './bsc.json'
import { Star, StarManager } from './stars'
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

let timeSinceStarFrame = 0
loop.animate((elapsed, repaint) => {
  let last: number = Star.pov.date.getTime()
  Star.pov.date = new Date(last + elapsed * globalContext.speed)

  timeSinceStarFrame += elapsed
  if (
    repaint ||
    timeSinceStarFrame >
      calculateMsPerFrame(globalContext.speed, skyCanvas.radius)
  ) {
    skyCanvas.layers.stars.clear()
    stars.eachVisible(star => {
      star.draw(skyCanvas)
      if (star.hourAngle < 0 && !star.hasQueuedSynth) star.queueSynth()
    })
    timeSinceStarFrame = 0
  }
})
loop.repaint()

globalContext.addEventListener('update', ((event: CustomEvent) => {
  Star.pov.update(event.detail)
  stars.unsetVisible()
  stars.forEach(star => {
    star.clearSynth()
  })
}) as EventListener)

navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
  globalContext.update({
    date: new Date(timestamp),
    long: coords.longitude * (Math.PI / 180),
    lat: coords.latitude * (Math.PI / 180),
  })
  loop.repaint()
})

const speedSlider = document.getElementById('speed-control') as HTMLInputElement
speedSlider.value = globalContext.speed.toString()
speedSlider.addEventListener('input', () => {
  globalContext.update({ speed: Number(speedSlider.value) ** 2 })
})
;(window as any).context = globalContext
