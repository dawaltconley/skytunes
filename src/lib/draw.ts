import type { Star } from './stars'
import colors from 'tailwindcss/colors'

class CanvasLayer {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D

  constructor(container: HTMLElement) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error("Couldn't get canvas context")
    canvas.classList.add(
      'absolute',
      'inset-0',
      'w-full',
      'h-full',
      'rounded-full',
    )
    container.append(canvas)
    this.canvas = canvas
    this.context = context
  }

  setSize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}

class SkyCanvas {
  container: HTMLElement
  layers: {
    background: CanvasLayer
    stars: CanvasLayer
    shimmer: CanvasLayer
  }
  radius = 0
  center: {
    x: number
    y: number
  } = { x: 0, y: 0 }

  constructor(container: HTMLElement) {
    this.container = container
    this.layers = {
      background: new CanvasLayer(container),
      stars: new CanvasLayer(container),
      shimmer: new CanvasLayer(container),
    }
    this.setCanvasSize()
    this.drawBackground()
  }

  /** adjusts the canvas width and height to match the screen sice and pixel ratio */
  setCanvasSize(): SkyCanvas {
    let { width, height } = this.container.getBoundingClientRect()
    const scale = window.devicePixelRatio
    width = width * scale
    height = height * scale

    Object.values(this.layers).forEach(layer => layer.setSize(width, height))

    this.radius = Math.min(width, height) / 2
    this.center = {
      x: width / 2,
      y: height / 2,
    }
    return this
  }

  /** draws the sky background */
  drawBackground(): SkyCanvas {
    const { canvas, context } = this.layers.background
    const { center, radius } = this
    const height = canvas.height
    const skyTop = (height - 2 * radius) / 2
    requestAnimationFrame(() => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.beginPath()
      context.arc(center.x, center.y, radius, 0, 2 * Math.PI)
      context.fillStyle = colors.blue['900']
      context.fill()
      context.beginPath()
      context.moveTo(center.x, skyTop)
      context.lineTo(center.x, height - skyTop)
      context.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      context.stroke()
    })
    return this
  }

  plotStar(star: Star): { x: number; y: number } {
    const { center, radius } = this
    let x = Math.cos(star.theta) * star.rho,
      y = Math.sin(star.theta) * star.rho
    x = x * radius + center.x
    y = y * radius + center.y
    return { x, y }
  }

  drawStar(
    star: Star,
    {
      layer = this.layers.stars,
      radius = (8 - star.mag) * (this.radius * 0.0008),
      color = colors.yellow[200],
    }: {
      layer?: CanvasLayer
      radius?: number
      color?: string
    } = {},
  ): SkyCanvas {
    const { context } = layer
    const { x, y } = this.plotStar(star)
    context.beginPath()
    context.arc(x, y, radius, 0, 2 * Math.PI)
    context.fillStyle = color
    context.fill()
    return this
  }
}

/**
 * @param speed - rotation speed
 * @param radius - radius of the skybox in pixels
 * @return minimum milliseconds per frame needed to animate smoothly
 */
const calculateMsPerFrame = (speed: number, radius: number) => {
  const pixelsPerDegree = 0.01745240643728351 * radius // approximate
  const pixelsPerSecond = pixelsPerDegree * (speed / 240)
  return 100 / pixelsPerSecond
}

/** manages an animation frame loop with an optional frameCap */
class FrameLoop {
  #frameCap: number | null = 60
  #minMsPerFrame = 0
  #repaint = false
  #lastFrameTime?: number
  #fps = 0
  #fpsLogger?: number
  #nextFrame?: number

  /** @param frameCap - maximum fps, or null to uncap */
  constructor(frameCap: number | null = null) {
    this.frameCap = frameCap
  }

  /** maximum fps, or null to uncap */
  set frameCap(fps: number | null) {
    this.#minMsPerFrame = fps ? 1000 / fps - 0.1 : 0
    this.#frameCap = fps
  }

  get frameCap(): number | null {
    return this.#frameCap
  }

  /** starts an animation, running the callback on each frame */
  animate(eachFrame: (elapsed: number, repaint: boolean) => void) {
    const frame = (timestamp: DOMHighResTimeStamp) => {
      if (this.#lastFrameTime === undefined) this.#lastFrameTime = timestamp
      const elapsed = timestamp - this.#lastFrameTime
      if (this.#repaint || elapsed > this.#minMsPerFrame) {
        eachFrame(elapsed, this.#repaint)
        this.#lastFrameTime = timestamp
        this.#repaint = false
        if (this.#fpsLogger !== undefined) this.#fps++
      }
      this.#nextFrame = requestAnimationFrame(frame)
    }
    this.#nextFrame = requestAnimationFrame(frame)
  }

  /** cancel the animation loop */
  cancel() {
    if (this.#nextFrame !== undefined) cancelAnimationFrame(this.#nextFrame)
  }

  /** force an animation repaint */
  repaint() {
    this.#repaint = true
  }

  /** log actual fps to the console */
  logFps() {
    this.#fpsLogger = window.setInterval(() => {
      // eslint-disable-next-line no-console
      console.log(`${this.#fps} frames per second`)
      this.#fps = 0
    }, 1000)
  }
}

export { SkyCanvas, CanvasLayer, FrameLoop, calculateMsPerFrame }
