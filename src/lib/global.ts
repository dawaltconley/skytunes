const mutableProperties = [
  'date',
  'long',
  'lat',
  'speed',
  'audio',
  'isMuted',
] as const

type Settings = Pick<GlobalContext, (typeof mutableProperties)[number]>

const isMutableProperty = (
  p: string,
): p is (typeof mutableProperties)[number] =>
  mutableProperties.includes(p as (typeof mutableProperties)[number])

interface UpdateEvent<P extends PropertyKey> extends CustomEvent {
  detail: Partial<Settings> & Pick<Settings, Extract<keyof Settings, P>>
}

class GlobalContext extends EventTarget implements Settings {
  date: Date = new Date()
  long = 0
  lat = 0
  speed = 1

  audio?: AudioContext
  isMuted = false

  constructor() {
    super()
    this.update = this.update.bind(this)

    // dispatches 'update' and 'update.[property]' events whenever a property is changed
    return new Proxy(this, {
      get(target, property) {
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
      set(target, property, value) {
        if (isMutableProperty(property.toString())) {
          target.update({ [property.toString()]: value })
          return true
        }
        return Reflect.set(target, property, value)
      },
    })
  }

  /**
   * updates multiple settings at once
   * @param options - an object representing new values to be assigned to each setting
   * @return an object containing only those settings with new values that were updated
   */
  update(options: Partial<Settings>): Partial<Settings> {
    const updated: Partial<Settings> = Object.fromEntries(
      Object.entries(options).filter(
        // filter out update options that haven't changed
        ([p, value]) => value !== this[p as keyof Settings],
      ),
    )
    if (Object.keys(updated).length === 0) return updated

    const event: CustomEventInit = { detail: updated }
    Object.assign(this, updated)
    this.dispatchEvent(new CustomEvent('update', event))
    Object.entries(updated).forEach(([property]) => {
      this.dispatchEvent(new CustomEvent(`update.${property}`, event))
    })

    return updated
  }

  listen<P extends keyof Settings | 'update'>(
    property: P,
    listener: (event: UpdateEvent<P>) => void,
  ) {
    if (property === 'update') {
      this.addEventListener('update', listener as EventListener)
    } else {
      this.addEventListener(`update.${property}`, listener as EventListener)
    }
  }
}

export default new GlobalContext()
export type { GlobalContext }
