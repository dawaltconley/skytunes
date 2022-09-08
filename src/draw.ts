import { SkyCanvas as SkyCanvasInterface } from './types/skytunes'
import context from './global'
import colors from 'tailwindcss/colors'

let fps: number = 0
setInterval(() => {
  console.log('frame rate', fps)
  fps = 0
}, 1000)

class SkyCanvas implements SkyCanvasInterface {
  static globalContext = context

  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  radius: number = 0
  center: {
    x: number
    y: number
  } = { x: 0, y: 0 }

  #speed: number = 1
  #minMsPerFrame: number = 0
  #lastFrameTime: number = 0

  constructor(
    canvas: HTMLCanvasElement,
    options: Partial<{
      speed: number
    }> = {}
  ) {
    this.canvas = canvas
    this.context = canvas.getContext('2d')!

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
    let { canvas, context, center, radius } = this
    let height = canvas.height
    let skyTop = (height - 2 * radius) / 2
    context.beginPath()
    context.arc(center.x, center.y, radius, 0, 2 * Math.PI)
    context.fillStyle = colors.blue['900']
    context.fill()
    context.beginPath()
    context.moveTo(center.x, skyTop)
    context.lineTo(center.x, height - skyTop)
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    context.stroke()
    return this
  }

  drawStars(): SkyCanvas {
    let { context, center, radius } = this
    for (const star of SkyCanvas.globalContext.stars) {
      if (star.altitude < 0) continue

      let x = Math.cos(star.theta) * star.rho,
        y = Math.sin(star.theta) * star.rho
      x = x * radius + center.x
      y = y * radius + center.y
      let r = (8 - star.mag) * (radius * 0.0008)

      context.beginPath()
      context.arc(x, y, r, 0, 2 * Math.PI)
      context.fillStyle = colors.yellow[200]
      context.fill()
    }
    return this
  }

  animateFrame(timestamp: DOMHighResTimeStamp): SkyCanvas {
    let now = new Date(performance.timeOrigin + timestamp * this.speed)
    SkyCanvas.globalContext.update({ date: now })
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
