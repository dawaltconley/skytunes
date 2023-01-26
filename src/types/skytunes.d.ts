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
   * the altitude when the star makes its high meridian transit
   * @see {@link  https://kalobs.org/more/altitudes-at-transit/}
   */
  readonly highTransit: number

  /**
   * the altitude when the star makes its low meridian transit
   * @see {@link  https://kalobs.org/more/altitudes-at-transit/}
   */
  readonly lowTransit: number

  /** time to the next high transit in milliseconds */
  readonly nextTransit: number

  /** angle from where the star crosses the horizon */
  readonly angleToRise: number

  /**
   * the hour angle at which a star will cross the horizon
   * same for setting and rising, but the rising hour angle is negative
   * will be NaN for stars that don't cross the horizon
   */
  readonly horizonTransit: number | NaN
}
