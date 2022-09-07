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

interface TimeAndPlace {
  date: Date
  long: number
  lat: number
  lst: number
  sinLat: number
  cosLat: number
}

const getTimeAndPlace = (
  date: Date,
  longitude: number,
  latitude: number
): TimeAndPlace => ({
  date,
  long: longitude,
  lat: latitude,
  lst: getLST(date, longitude),
  sinLat: Math.sin(latitude),
  cosLat: Math.cos(latitude),
})

let hereAndNow = getTimeAndPlace(new Date(), -73.97131, 40.663119)

class Star {
  static observer: TimeAndPlace = hereAndNow

  ref: number
  ra: number
  dec: number
  mag: number
  hourAngle: number = 0
  altitude: number = 0
  azimuth: number = 0

  #sinDec: number
  #cosDec: number

  constructor(
    harvardReferenceNumber: number,
    rightAscension: number,
    declination: number,
    magnitude: number
  ) {
    this.ref = harvardReferenceNumber
    this.ra = rightAscension
    this.dec = declination
    this.mag = magnitude

    this.#sinDec = Math.sin(declination)
    this.#cosDec = Math.cos(declination)

    this.recalculate()
  }

  recalculate() {
    // the hour angle can be used to calculate when the star will cross the meridian
    // negative hour angles = moving away from meridian
    // positive hour angles = moving towards the meridian
    // an hour angle of zero occurs when the star passes the meridian
    this.hourAngle = Star.observer.lst - this.ra

    // can potentially abort after altitude if under the horizon
    this.altitude = Math.asin(
      this.#sinDec * Star.observer.sinLat +
        this.#cosDec * Star.observer.cosLat * Math.cos(this.hourAngle)
    )
    this.azimuth = Math.acos(
      (this.#sinDec - Math.sin(this.altitude) * Star.observer.sinLat) /
        (Math.cos(this.altitude) * Star.observer.cosLat)
    )
    // may be able to get rid of Math.sin here
    if (Math.sin(this.hourAngle) >= 0) {
      this.azimuth = Math.PI * 2 - this.azimuth
    }

    return this
  }

  get theta() {
    return Math.PI / 2 - this.azimuth
  }

  get rho() {
    return Math.cos(this.altitude)
  }
}

export { Star, getTimeAndPlace }
