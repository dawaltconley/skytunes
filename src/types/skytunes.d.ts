interface BSC {
  'harvard_ref_#': number
  RA: string
  DEC: string
  Epoch: number
  'RA PM': string
  'DEC PM': string
  MAG: string
}

interface TimeAndPlace {
  date: Date
  long: number
  lat: number
  lst: number
  sinLat: number
  cosLat: number
}

export interface Star {
  readonly ref: number
  readonly ra: number
  readonly dec: number
  readonly mag: number
  readonly hourAngle: number
  readonly altitude: number
  readonly azimuth: number
  readonly theta: number
  readonly rho: number
  readonly highTransit: number
  readonly lowTransit: number
  readonly nextTransit: number

  recalculate: (options: Partial<GlobalContext>) => Star
  queueSynth: () => Star
  draw: () => Star
  log?: () => void
}

export interface SkyCanvas {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  radius: number
  center: {
    x: number
    y: number
  }
  speed: number

  /** adjusts the canvas width and height to match the screen sice and pixel ratio */
  setCanvasSize: () => SkyCanvas
  /** draws the sky background */
  drawBackground: () => SkyCanvas
  /** draws the visible stars in their current position */
  drawStars: () => SkyCanvas
  /** a single animation frame, usually passed to window.requestAnimationFrame */
  animateFrame: () => SkyCanvas
  /** starts animating the SkyCanvas */
  startAnimation: () => SkyCanvas
}

export interface GlobalContext extends TimeAndPlace {
  stars: Star[]
  canvas?: SkyCanvas
  speed: number
}
