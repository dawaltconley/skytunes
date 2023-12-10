import {
  sinceJ2000,
  getUniversalTime,
  getLST,
  radianFromRa,
  radianFromDec,
} from '../src/lib/stars'

describe('sinceJ2000()', () => {
  test('correctly calculates the milliseconds since the J2000 epoch', () => {
    let date: Date = new Date(Date.UTC(2022, 8, 8, 19, 51, 58))
    expect(sinceJ2000(date)).toEqual(715938782184)
    date = new Date(Date.UTC(2011, 5, 26, 18, 1, 30))
    expect(sinceJ2000(date)).toEqual(362383354184)
  })
})

describe('getUniversalTime()', () => {
  test('correctly calculates the universal time in milliseconds', () => {
    let date: Date = new Date(Date.UTC(2022, 8, 8, 19, 51, 58))
    expect(getUniversalTime(date)).toEqual(71518000)
    date = new Date(Date.UTC(2011, 5, 26, 18, 1, 30))
    expect(getUniversalTime(date)).toEqual(64890000)
  })
})

describe('getLST()', () => {
  test('correctly calculates the local sidereal time', () => {
    let date: Date, long: number
    date = new Date(Date.UTC(2022, 8, 8, 19, 51, 58))
    long = Math.PI / -3
    expect(getLST(date, long)).toBeCloseTo(148.45502694138077, 10)
    date = new Date(Date.UTC(2022, 8, 9, 4, 2, 46))
    long = -74 * (Math.PI / 180)
    expect(getLST(date, long)).toBeCloseTo(144.07487781381377, 10)
    date = new Date(Date.UTC(2008, 0, 27, 7, 9))
    long = 106.7927325 * (Math.PI / 180)
    expect(getLST(date, long)).toBeCloseTo(56.199455967633405, 10)
  })
})

describe('radianFromRa()', () => {
  test('parses right ascension strings', () => {
    expect(radianFromRa('14:50:42.30')).toBeCloseTo(3.886433728494023, 10)
    expect(radianFromRa('00:02:24.20')).toBeCloseTo(0.010486519922399263, 10)
  })
})

describe('radianFromDec()', () => {
  test('parses positive declination strings', () => {
    expect(radianFromDec('+74:09:20.00')).toBeCloseTo(1.2942586030900174, 10)
  })
  test('parses negative declination strings', () => {
    expect(radianFromDec('-11:24:35.00')).toBeCloseTo(-0.1991372195157419, 10)
  })
})
