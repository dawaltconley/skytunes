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
  ref: number
  ra: number
  dec: number
  mag: number
  hourAngle: number
  altitude: number
  maxAltitude: number
  azimuth: number
  lastAzimuth: number
  theta: number
  rho: number

  recalculate: () => Star
  playSynth: (AudioContext) => Star
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
  animateFrame: (DOMHighResTimeStamp) => SkyCanvas
  /** starts animating the SkyCanvas */
  startAnimation: () => SkyCanvas
}

export interface GlobalContext extends TimeAndPlace {
  stars: Star[]
  canvas?: SkyCanvas
}
