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

/** parse a right ascension string of the format HH:MM:SS.S */
const radianFromRa = (hms: string, sep: string = ':'): number => {
  let [h, m, s]: number[] = hms.split(sep).map(s => Number(s))
  let hours = h + m / 60 + s / 3600
  return (hours * Math.PI) / 12
}

/** parse a declination string of the format +/-DD:MM:SS.SS */
const radianFromDec = (dms: string, sep: string = ':'): number => {
  let [d, m, s]: number[] = dms.split(sep).map(s => Number(s))
  if (dms.startsWith('-')) (m *= -1), (s *= -1)
  let degrees = d + m / 60 + s / 3600
  return (degrees * Math.PI) / 180
}

export { sinceJ2000, getUniversalTime, getLST, radianFromRa, radianFromDec }
