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
  /** harvard reference number */
  readonly ref: number

  /** right ascension */
  readonly ra: number

  /** declination */
  readonly dec: number

  /** magnitude (brightness) */
  readonly mag: number

  /**
   * the hour angle measures the position in the stars arc through the sky
   * it can be used to calculate when the star will cross the meridian
   * negative hour angles = moving towards the meridian
   * positive hour angles = moving away from meridian
   * an hour angle of zero occurs when the star passes the meridian
   * @see {@link https://en.wikipedia.org/wiki/Hour_angle}
   */
  readonly hourAngle: number

  /**
   * the angle of the star's elevation from the horizon
   * @see {@link https://en.wikipedia.org/wiki/Horizontal_coordinate_system}
   */
  readonly altitude: number

  /**
   * the angle from the meridian to the star's position above the horizon
   * @see {@link https://en.wikipedia.org/wiki/Horizontal_coordinate_system}
   */
  readonly azimuth: number

  /**
   * the angle of the star from celestial north
   * @see {@link https://boyce-astro.org/wp-content/uploads/BRIEF-Video-Lesson-ASTROMETRY-Theta-and-Rho.pdf}
   */
  readonly theta: number

  /**
   * the flat distance of the star from the zenith
   * @see {@link https://boyce-astro.org/wp-content/uploads/BRIEF-Video-Lesson-ASTROMETRY-Theta-and-Rho.pdf}
   */
  readonly rho: number

  /**
   * the hour angle when the star makes its high meridian transit
   * @see {@link  https://kalobs.org/more/altitudes-at-transit/}
   */
  readonly highTransit: number

  /**
   * the hour angle when the star makes its low meridian transit
   * @see {@link  https://kalobs.org/more/altitudes-at-transit/}
   */
  readonly lowTransit: number

  /** time to the next high transit in milliseconds */
  readonly nextTransit: number

  /** recalculate the star's properties based on what global data has changed */
  recalculate: (options: Partial<GlobalContext>) => Star

  /** queue a synth for the star's next high transit */
  queueSynth: () => Star

  /** draw the star's position on a canvas */
  draw: () => Star

  /** log data about the star's current position */
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
