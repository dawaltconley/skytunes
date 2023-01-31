import context from './global'
import colors from 'tailwindcss/colors'
import { Star } from './stars'

class CanvasLayer {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D

  constructor(container: HTMLElement) {
    const canvas = document.createElement('canvas')
    canvas.classList.add(
      'absolute',
      'inset-0',
      'w-full',
      'h-full',
      'rounded-full'
    )
    container.append(canvas)
    this.canvas = canvas
    this.context = canvas.getContext('2d')!
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
  static globalContext = context

  container: HTMLElement
  layers: {
    background: CanvasLayer
    stars: CanvasLayer
  }
  radius: number = 0
  center: {
    x: number
    y: number
  } = { x: 0, y: 0 }

  #minMsPerFrame: number = 0
  #lastFrameTime: number = 0
  #repaint: boolean = false
  #fps: number = 0

  constructor(container: HTMLElement) {
    this.container = container
    this.layers = {
      background: new CanvasLayer(container),
      stars: new CanvasLayer(container),
    }

    // frame rate based on the globalContext speed
    this.calculateMsPerFrame(SkyCanvas.globalContext.speed)
    SkyCanvas.globalContext.addEventListener('update', ((
      event: CustomEvent
    ) => {
      if (event.detail.speed !== undefined)
        this.calculateMsPerFrame(event.detail.speed)
    }) as EventListener)

    // recalculate canvas size when resized
    let resizeTimeout: number
    const observer = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        this.setCanvasSize()
        this.#repaint = true
        requestAnimationFrame(() => this.drawBackground())
      }, 100)
    })
    observer.observe(container)

    // set the canvas size
    this.setCanvasSize()
    requestAnimationFrame(() => this.drawBackground())
  }

  /**
   * sets a private #minMsPerFrame property based on the rotation speed, with an optional frame cap
   * @param speed - rotation speed
   * @param frameCap - default frame cap is approximately 60 fps
   */
  calculateMsPerFrame(speed: number, frameCap = 16.5) {
    let pixelsPerDegree = 0.01745240643728351 * this.radius // approximate
    let pixelsPerSecond = pixelsPerDegree * (speed / 240)
    this.#minMsPerFrame = Math.max(100 / pixelsPerSecond, frameCap)
    return this.#minMsPerFrame
  }

  /** adjusts the canvas width and height to match the screen sice and pixel ratio */
  setCanvasSize(): SkyCanvas {
    let { width, height } = this.container.getBoundingClientRect()
    let scale = window.devicePixelRatio
    width = width * scale
    height = height * scale

    Object.values(this.layers).forEach(layer => layer.setSize(width, height))

    this.radius = Math.min(width, height) / 2
    this.calculateMsPerFrame(SkyCanvas.globalContext.speed)
    this.center = {
      x: width / 2,
      y: height / 2,
    }
    return this
  }

  /** draws the sky background */
  drawBackground(): SkyCanvas {
    let { canvas, context } = this.layers.background
    let { center, radius } = this
    let height = canvas.height
    let skyTop = (height - 2 * radius) / 2
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
    return this
  }

  /** starts an animation, running the callback on each frame */
  animate(eachFrame: (canvas: SkyCanvas) => void): SkyCanvas {
    this.logFps()
    const frame = (timestamp: DOMHighResTimeStamp) => {
      let elapsed = timestamp - this.#lastFrameTime
      if (this.#repaint || elapsed > this.#minMsPerFrame) {
        let last: number = Star.pov.date.getTime()
        Star.pov.date = new Date(last + elapsed * SkyCanvas.globalContext.speed)
        eachFrame(this)
        this.#lastFrameTime = timestamp
        this.#repaint = false
        this.#fps++
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    return this
  }

  repaint() {
    this.#repaint = true
  }

  logFps() {
    setInterval(() => {
      console.log(`${this.#fps} frames per second`)
      this.#fps = 0
    }, 1000)
  }
}

export { SkyCanvas, CanvasLayer }
