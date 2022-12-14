import colors from 'tailwindcss/colors'
import { Star, getTimeAndPlace } from './legacy'

let fps: number = 0
setInterval(() => {
  console.log('frame rate', fps)
  fps = 0
}, 1000)

class SkyCanvas {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  radius: number = 0
  center: {
    x: number
    y: number
  } = { x: 0, y: 0 }

  stars: Star[]

  #speed: number = 1
  #minMsPerFrame: number = 0
  #lastFrameTime: number = 0

  constructor(
    canvas: HTMLCanvasElement,
    stars: Star[],
    options: Partial<{
      speed: number
    }> = {}
  ) {
    this.canvas = canvas
    this.context = canvas.getContext('2d')!
    this.stars = stars

    this.animateFrame = this.animateFrame.bind(this)

    this.setCanvasSize()
    requestAnimationFrame(this.animateFrame)
    this.speed = options.speed ?? 1

    // recalculate canvas size when resized
    let resizeTimeout: number
    const observer = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        this.setCanvasSize()
        requestAnimationFrame(this.animateFrame)
      }, 100)
    })
    observer.observe(canvas)
  }

  set speed(rate: number) {
    this.#speed = rate
    let pixelsPerDegree = 0.01745240643728351 * this.radius // approximate
    let pixelsPerSecond = pixelsPerDegree * (rate / 240)
    let frameCap = pixelsPerSecond * 10
    this.#minMsPerFrame = 1000 / frameCap
    requestAnimationFrame(this.animateFrame)
  }

  get speed() {
    return this.#speed
  }

  setCanvasSize(): SkyCanvas {
    let { width, height } = this.canvas.getBoundingClientRect()
    let scale = window.devicePixelRatio
    width = width * scale
    height = height * scale
    this.canvas.width = width
    this.canvas.height = height
    this.radius = Math.min(width, height) / 2
    this.center = {
      x: width / 2,
      y: height / 2,
    }
    return this
  }

  drawBackground(): SkyCanvas {
    let { context, center, radius } = this
    context.beginPath()
    context.arc(center.x, center.y, radius, 0, 2 * Math.PI)
    context.fillStyle = colors.blue['900']
    context.fill()
    return this
  }

  drawStars(): SkyCanvas {
    let { stars, context, center, radius } = this
    for (const star of stars) {
      star.recalculate()
      if (star.altitude < 0) continue

      let x = Math.cos(star.theta) * -star.rho,
        y = Math.sin(star.theta) * star.rho
      x = x * radius + center.x
      y = y * radius + center.y
      let r = (8 - star.mag) * (radius * 0.0008)

      context.beginPath()
      context.arc(x, y, r, 0, 2 * Math.PI)
      context.fillStyle = colors.yellow[200]
      context.fill()

      if (star.lastAzimuth < 0 && star.azimuth > 0) {
        star.playSynth()
        console.log(star)
      }
    }
    return this
  }

  animateFrame(timestamp: DOMHighResTimeStamp): SkyCanvas {
    let now = new Date(performance.timeOrigin + timestamp * this.speed)
    Star.observer = getTimeAndPlace(now, Star.observer.long, Star.observer.lat)
    this.drawBackground().drawStars()
    fps++
    return this
  }

  startAnimation(): SkyCanvas {
    const frame = (timestamp: DOMHighResTimeStamp) => {
      let elapsed = timestamp - this.#lastFrameTime
      if (elapsed > this.#minMsPerFrame) {
        this.#lastFrameTime = timestamp
        this.animateFrame(timestamp)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    return this
  }
}

export { SkyCanvas }
