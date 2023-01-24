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

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const skyCanvas = new SkyCanvas(canvas)
globalContext.update({ canvas: skyCanvas }) // remove?

skyCanvas.animate(canvas => {
  canvas.drawBackground()
  stars.eachVisible(star => {
    star.draw()
  })
})

navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
  globalContext.update({
    date: new Date(timestamp),
    long: coords.longitude * (Math.PI / 180),
    lat: coords.latitude * (Math.PI / 180),
  })
  requestAnimationFrame(skyCanvas.drawBackground)
})

const speedSlider = document.getElementById('speed-control') as HTMLInputElement
speedSlider.value = skyCanvas.speed.toString()
speedSlider.addEventListener('input', () => {
  globalContext.update({ speed: Number(speedSlider.value) ** 2 })
})
;(window as any).context = globalContext
