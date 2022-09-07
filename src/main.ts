import './tailwind.css'
import bsc from './bsc.json'
import { getTimeAndPlace, Star } from './legacy'
import { SkyCanvas } from './draw'

interface BSC {
  'harvard_ref_#': number
  RA: string
  DEC: string
  Epoch: number
  'RA PM': string
  'DEC PM': string
  MAG: string
}

const radianFromRa = (hms: string, sep: string = ':'): number => {
  let [h, m, s]: number[] = hms.split(sep).map(s => Number(s))
  // let totalSeconds = h * 3600 + m * 60 + s // TODO s can be decimal; this doesn't prevent floating point issues
  // return totalSeconds * Math.PI / 43200
  let hours = h + m / 60 + s / 3600
  return (hours * Math.PI) / 12
}

const radianFromDec = (dms: string, sep: string = ':'): number => {
  // let neg = dms.startsWith('-')
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

navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
  Star.observer = getTimeAndPlace(
    new Date(timestamp),
    coords.longitude,
    coords.latitude
  )
  console.log(Star.observer)
})

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const skyCanvas = new SkyCanvas(canvas, stars)

skyCanvas.startAnimation()

const speedSlider = document.getElementById('speed-control') as HTMLInputElement
speedSlider.value = skyCanvas.speed.toString()
speedSlider?.addEventListener('input', () => {
  console.log(speedSlider.value)
  skyCanvas.speed = Number(speedSlider.value) ** 2
})
