import * as Interface from './types/skytunes'

/** gets the milliseconds since the J2000 epoch */
const sinceJ2000 = (date: Date): number => date.getTime() - j2000
const j2000 = Date.UTC(2000, 0, 1, 11, 58, 55, 816)

/** calculates the universal (solar) time in milliseconds */
const getUniversalTime = (date: Date): number =>
  date.getTime() - new Date(date).setUTCHours(0, 0, 0, 0)

/**
 * calculates the local siderial time in radians
 * based on the following formula in degrees:
 * lst = 100.46 + (0.985647 * d) + longitude + (15 * ut)
 *
 * @param date
 * @param longitude in radians
 * @see {@link http://www.stargazing.net/kepler/altaz.html}
 * @return LST in radians
 */
var getLST = (date: Date, longitude: number): number => {
  let d = sinceJ2000(date) / 86400000,
    ut = getUniversalTime(date) / 240000,
    long = longitude * (180 / Math.PI)
  let lst = 100.46 + 0.985647 * d + long + ut
  return (lst * Math.PI) / 180
}

class GlobalContext extends EventTarget implements Interface.GlobalContext {
  date: Date = new Date()
  long: number = 0
  lat: number = 0
  lst: number = 0
  sinLat: number = 0
  cosLat: number = 1

  stars: Interface.Star[] = []
  canvas?: Interface.SkyCanvas

  constructor() {
    super()
    this.update = this.update.bind(this)
    this.update({ date: new Date(), long: 0, lat: 0 })
  }

  update(options: Partial<Interface.GlobalContext>) {
    let { date, long, lat, stars, canvas } = options
    this.date = date ?? this.date
    this.long = long ?? this.long
    this.lat = lat ?? this.lat
    this.stars = stars ?? this.stars
    this.canvas = canvas ?? this.canvas

    if (date !== undefined || long !== undefined) {
      this.lst = getLST(this.date, this.long)
    }

    if (lat !== undefined) {
      this.sinLat = Math.sin(this.lat)
      this.cosLat = Math.cos(this.lat)
    }

    const updateEvent = new CustomEvent('update', {
      detail: options,
    })
    this.dispatchEvent(updateEvent)
  }
}

export default new GlobalContext()
