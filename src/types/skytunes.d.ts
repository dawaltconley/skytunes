export interface BSC {
  'harvard_ref_#': number
  RA: string
  DEC: string
  Epoch: number
  'RA PM': string
  'DEC PM': string
  MAG: string
}

export interface TimeAndPlace {
  readonly date: Date
  readonly long: number
  readonly lat: number
  readonly lst: number
  readonly sinLat: number
  readonly cosLat: number
}

export interface Star {
  /** harvard reference number */
  readonly ref: number

  /** right ascension */
  readonly ra: number

  /** declination */
  readonly dec: number
  readonly sinDec: number
  readonly cosDec: number

  /** magnitude (brightness) */
  readonly mag: number
}
