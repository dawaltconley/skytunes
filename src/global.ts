class GlobalContext extends EventTarget {
  date: Date = new Date()
  long: number = 0
  lat: number = 0

  audio: AudioContext
  speed: number = 1

  constructor() {
    super()
    this.update = this.update.bind(this)
    this.update({ date: new Date(), long: 0, lat: 0 })
    this.audio = new AudioContext()
  }

  update(options: Partial<GlobalContext>) {
    let { date, long, lat, speed } = options
    this.date = date ?? this.date ?? new Date()
    this.long = long ?? this.long
    this.lat = lat ?? this.lat
    this.speed = speed ?? this.speed

    if (date ?? long ?? lat ?? speed ?? false) {
      const updateEvent = new CustomEvent('update', {
        detail: options,
      })
      this.dispatchEvent(updateEvent)
    }
  }
}

export default new GlobalContext()
export type { GlobalContext }
