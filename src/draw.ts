import context from './global'
import colors from 'tailwindcss/colors'

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

  constructor(container: HTMLElement) {
    this.container = container
    this.layers = {
      background: new CanvasLayer(container),
      stars: new CanvasLayer(container),
    }

    // frame rate based on the globalContext speed
    this.speed = SkyCanvas.globalContext.speed
    SkyCanvas.globalContext.addEventListener('update', ((
      event: CustomEvent
    ) => {
      if (event.detail.speed !== undefined) this.speed = event.detail.speed
    }) as EventListener)

    // recalculate canvas size when resized
    let resizeTimeout: number
    const observer = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        this.setCanvasSize()
        requestAnimationFrame(() => this.drawBackground())
      }, 100)
    })
    observer.observe(container)

    // set the canvas size
    this.setCanvasSize()
    requestAnimationFrame(() => this.drawBackground())
  }

  set speed(rate: number) {
    let pixelsPerDegree = 0.01745240643728351 * this.radius // approximate
    let pixelsPerSecond = pixelsPerDegree * (rate / 240)
    let frameCap = pixelsPerSecond * 10
    this.#minMsPerFrame = 1000 / frameCap
  }

  get speed() {
    return SkyCanvas.globalContext.speed
  }

  /** adjusts the canvas width and height to match the screen sice and pixel ratio */
  setCanvasSize(): SkyCanvas {
    let { width, height } = this.container.getBoundingClientRect()
    let scale = window.devicePixelRatio
    width = width * scale
    height = height * scale

    Object.values(this.layers).forEach(layer => layer.setSize(width, height))

    this.radius = Math.min(width, height) / 2
    this.speed = SkyCanvas.globalContext.speed
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
    const frame = (timestamp: DOMHighResTimeStamp) => {
      let elapsed = timestamp - this.#lastFrameTime
      if (elapsed > this.#minMsPerFrame) {
        let last: number = SkyCanvas.globalContext.date.getTime()
        SkyCanvas.globalContext.update({
          date: new Date(last + elapsed * this.speed),
        })
        eachFrame(this)
        this.#lastFrameTime = timestamp
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    return this
  }
}

export { SkyCanvas, CanvasLayer }
