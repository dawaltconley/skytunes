import './tailwind.css'
import colors from 'tailwindcss/colors'
import bsc from './bsc.json'
import { getTimeAndPlace, Star } from './legacy'

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
let canvasRect = canvas.getBoundingClientRect()
canvas.width = canvasRect.width
canvas.height = canvasRect.height

const context = canvas.getContext('2d')!

const drawBackground = (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
): void => {
  const radius = Math.min(canvas.width, canvas.height) / 2
  const center = {
    x: canvas.width / 2,
    y: canvas.height / 2,
  }
  context.beginPath()
  context.arc(center.x, center.y, radius, 0, 2 * Math.PI)
  context.fillStyle = colors.blue['900']
  context.fill()
}
drawBackground(canvas, context)
context.save()

const drawStars = (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
): void => {
  const radius = Math.min(canvas.width, canvas.height) / 2
  const center = {
    x: canvas.width / 2,
    y: canvas.height / 2,
  }

  for (const star of stars) {
    star.recalculate()
    if (star.altitude < 0) continue

    let x = Math.cos(star.theta) * -star.rho,
      y = Math.sin(star.theta) * star.rho
    x = x * radius + center.x
    y = y * radius + center.y
    // let r = (8 - star.mag) / (radius * 0.01)
    let r = (8 - star.mag) * (radius * 0.0008)

    context.beginPath()
    context.arc(x, y, r, 0, 2 * Math.PI)
    context.fillStyle = colors.yellow[200]
    context.fill()
  }
}
drawStars(canvas, context)

let framesSinceReset: number = 0
setInterval(() => {
  console.log('frame rate', framesSinceReset)
  framesSinceReset = 0
}, 1000)

const animateSky = (timestamp: DOMHighResTimeStamp) => {
  let now = new Date(performance.timeOrigin + timestamp)
  Star.observer = getTimeAndPlace(now, Star.observer.long, Star.observer.lat)

  framesSinceReset++

  context.restore()
  drawBackground(canvas, context)
  drawStars(canvas, context)
  window.requestAnimationFrame(animateSky)
}

requestAnimationFrame(animateSky)
