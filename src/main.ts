import { BSC } from './types/skytunes'
import globalContext from './global'
import './tailwind.css'
import bsc from './bsc.json'
import { Star } from './legacy'
import { SkyCanvas } from './draw'

const radianFromRa = (hms: string, sep: string = ':'): number => {
  let [h, m, s]: number[] = hms.split(sep).map(s => Number(s))
  let hours = h + m / 60 + s / 3600
  return (hours * Math.PI) / 12
}

const radianFromDec = (dms: string, sep: string = ':'): number => {
  let [d, m, s]: number[] = dms.split(sep).map(s => Number(s))
  if (dms.startsWith('-')) (m = -m), (s = -s)
  let degrees = d + m / 60 + s / 3600
  return (degrees * Math.PI) / 180
}

const stars = bsc.map(
  (star: BSC) =>
    new Star(
      star['harvard_ref_#'],
      radianFromRa(star.RA),
      radianFromDec(star.DEC),
      Number(star.MAG)
    )
)
globalContext.update({ stars })

navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
  globalContext.update({
    date: new Date(timestamp),
    long: coords.longitude * (Math.PI / 180),
    lat: coords.latitude * (Math.PI / 180),
  })
})

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const skyCanvas = new SkyCanvas(canvas)
globalContext.update({ canvas: skyCanvas })

skyCanvas.startAnimation()

const speedSlider = document.getElementById('speed-control') as HTMLInputElement
speedSlider.value = skyCanvas.speed.toString()
speedSlider.addEventListener('input', () => {
  console.log(speedSlider.value)
  skyCanvas.speed = Number(speedSlider.value) ** 2
})
