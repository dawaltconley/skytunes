import { BSC } from './types/skytunes'
import globalContext from './global'
import { radianFromRa, radianFromDec } from './utilities'
import './tailwind.css'
import bsc from './bsc.json'
import { Star, StarManager } from './stars'
import { SkyCanvas } from './draw'

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

skyCanvas.animate(canvas => {
  canvas.layers.stars.clear()
  stars.eachVisible(star => {
    star.draw(canvas)
    if (star.hourAngle < 0 && !star.hasQueuedSynth) star.queueSynth()
  })
})

navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
  stars.updateStars({
    date: new Date(timestamp),
    long: coords.longitude * (Math.PI / 180),
    lat: coords.latitude * (Math.PI / 180),
  })
  skyCanvas.repaint()
})

const speedSlider = document.getElementById('speed-control') as HTMLInputElement
speedSlider.value = globalContext.speed.toString()
speedSlider.addEventListener('input', () => {
  globalContext.update({ speed: Number(speedSlider.value) ** 2 })
})
;(window as any).context = globalContext
