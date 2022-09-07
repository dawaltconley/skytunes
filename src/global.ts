import * as Interface from './types/skytunes'

/**
 * calculates the number of days (including fracitons of days)
 * since January first 2000
 */
const sinceJ2000 = (date: Date): number =>
  (date.getTime() - Date.UTC(2000, 0)) / 86400000

/** calculates the universal (solar) time in hours */
const getUniversalTime = (date: Date): number =>
  (date.getTime() % 86400000) / 3600000

/**
 * calculates the local siderial time
 * @see {@link http://www.stargazing.net/kepler/altaz.html}
 * @return LST in radians
 */
const getLST = (date: Date, longitude: number): number => {
  let d = sinceJ2000(date),
    ut = getUniversalTime(date)
  let lst = 100.46 + 0.985647 * d + longitude + 15 * ut
  return ((lst % 360) * Math.PI) / 180
}

class GlobalContext implements Interface.GlobalContext {
  date: Date = new Date()
  long: number = 0
  lat: number = 0
  lst: number = 0
  sinLat: number = 0
  cosLat: number = 1

  stars: Interface.Star[] = []
  canvas?: Interface.SkyCanvas

  constructor() {
    this.update = this.update.bind(this)
    this.update({ date: new Date(), long: 0, lat: 0 })
  }

  update({ date, long, lat, stars, canvas }: Partial<Interface.GlobalContext>) {
    this.date = date ?? this.date
    this.long = long ?? this.long
    this.lat = lat ?? this.lat
    this.stars = stars ?? this.stars
    this.canvas = canvas ?? this.canvas

    if (date !== undefined || long !== undefined) {
      this.lst = getLST(this.date, this.long)
    }

    if (lat !== undefined) {
      this.sinLat = Math.sin(lat)
      this.cosLat = Math.cos(lat)
    }
  }
}

export default new GlobalContext()
