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
  // console.time('animation loop')
  canvas.drawBackground()
  let loops = 0,
    vegaVisible = true
  stars.eachVisible(star => {
    // star.recalculate({ date: globalContext.date })
    star.draw()
    if (star.ref === 7001) {
      // console.log(getTimeToRise(star, globalContext.speed))
      // console.log(star.horizonTransit, getTimeToRise(star, globalContext.speed))
      if (vegaVisible && star.altitude < 0) {
        vegaVisible = false
        console.log(vegaVisible, star.horizonTransit, star.hourAngle)
      } else if (!vegaVisible && star.altitude > 0) {
        vegaVisible = true
        console.log(vegaVisible, star.horizonTransit, star.hourAngle)
      }
      let ha = star.hourAngle
      if (ha < 0) ha += Math.PI * 2
      let angleUnder = star.horizonTransit + (ha - Math.PI)
    }
    // if (star.altitude > 0) star.draw()
    loops++
  })
  // console.log({ loops })
  // console.timeEnd('animation loop')
})

navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
  globalContext.update({
    date: new Date(timestamp),
    long: coords.longitude * (Math.PI / 180),
    lat: coords.latitude * (Math.PI / 180),
  })
  requestAnimationFrame(skyCanvas.animateFrame)
})

const speedSlider = document.getElementById('speed-control') as HTMLInputElement
speedSlider.value = skyCanvas.speed.toString()
speedSlider.addEventListener('input', () => {
  globalContext.update({ speed: Number(speedSlider.value) ** 2 })
})
;(window as any).context = globalContext
