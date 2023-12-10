import { TempusDominus, DateTime } from '@eonasdan/tempus-dominus'
import globalContext from './global'
import { Star } from './stars'

// Datetime Picker
const dateTimeElement = document.getElementById('datetimepicker')!
const dateTimeInput = document.getElementById(
  'datetimepickerInput'
) as HTMLInputElement

const dateTimePicker = new TempusDominus(dateTimeElement)
dateTimePicker.subscribe('change.td', ({ date }) => {
  dateTimeInput.blur()
  if (date.getTime() !== Star.pov.date.getTime()) {
    globalContext.date = date
  }
})
dateTimePicker.subscribe('show.td', () => {
  const display = DateTime.fromString(dateTimeInput.value, {})
  if (display.toString() === 'Invalid Date') return
  const now = Star.pov.date
  display.setSeconds(now.getSeconds(), now.getMilliseconds())
  dateTimePicker.dates.setValue(display)
})

const updateDateDisplay = (date: Date): void => {
  if (dateTimeInput === document.activeElement) return
  let datestr = dateTimePicker.dates.formatInput(DateTime.convert(date))
  if (dateTimeInput.value !== datestr) dateTimeInput.value = datestr
}

class IconToggle extends HTMLElement {
  private label = document.createElement('label')
  readonly checkbox = document.createElement('input')
  readonly icon = document.createElement('i')
  private labelSpan?: HTMLSpanElement

  get isOn(): boolean {
    return this.hasAttribute('on')
  }
  set isOn(on: boolean) {
    if (on) this.setAttribute('on', '')
    else this.removeAttribute('on')
  }
  toggle(): void {
    this.isOn = !this.isOn
  }

  constructor() {
    super()
    this.checkbox.setAttribute('type', 'checkbox')
    this.label.append(this.icon, this.checkbox)
    this.append(this.label)
    this.label.style.cursor = 'pointer'
    this.style.display = 'relative'
    Object.assign(this.checkbox.style, {
      position: 'absolute',
      width: '0px',
      height: '0px',
      opacity: '0',
    })
    this.checkbox.addEventListener('change', () => {
      this.isOn = this.checkbox.checked
    })
  }

  private iconClasses: {
    on?: string[]
    off?: string[]
  } = {}
  private labelText: {
    on?: string
    off?: string
  } = {}
  connectedCallback() {
    const inputId = this.getAttribute('input-id')
    if (inputId) this.checkbox.id = inputId
    this.label.setAttribute('class', this.getAttribute('class') ?? '')
    this.removeAttribute('class')

    this.iconClasses = {
      on: (this.getAttribute('on-icon') ?? '').split(' '),
      off: (this.getAttribute('off-icon') ?? '').split(' '),
    }
    this.labelText = {
      on: this.getAttribute('on-label') ?? undefined,
      off: this.getAttribute('off-label') ?? undefined,
    }
    if (this.labelText.on || this.labelText.off) {
      this.labelSpan = document.createElement('span')
      this.label.append(this.labelSpan)
    }

    this.update(this.isOn)
  }

  update(state: boolean): void {
    const remove = this.iconClasses[state ? 'off' : 'on'] ?? []
    const add = this.iconClasses[state ? 'on' : 'off'] ?? []
    this.icon.classList.remove(...remove)
    this.icon.classList.add(...add)
    if (this.labelSpan)
      this.labelSpan.innerText =
        ' ' + (this.labelText[state ? 'on' : 'off'] ?? '')
  }

  static get observedAttributes() {
    return ['on'] as const
  }

  attributeChangedCallback(
    name: (typeof IconToggle.observedAttributes)[number],
    oldValue: string,
    newValue: string
  ) {
    if (oldValue === newValue) return
    if (name === 'on') {
      const state = newValue !== null
      this.update(state)
    }
  }
}
customElements.define('icon-toggle', IconToggle)

type InputElement = HTMLInputElement
class MultiInput extends HTMLElement {
  inputs: InputElement[] = []
  inputListener: EventListener

  constructor() {
    super()
    this.inputListener = function (e) {
      const target = e.target as InputElement
      this.value = target.value
    }
  }

  connectedCallback() {
    this.inputs = Array.from(this.querySelectorAll('input'))

    Array.from(this.attributes).forEach(attr => {
      this.inputs.forEach(input => {
        if (attr.name in input && attr.name !== 'class')
          input.setAttribute(attr.name, attr.value)
      })
    })

    this.addEventListener('input', this.inputListener.bind(this))
  }

  static get observedAttributes() {
    return ['value', 'step', 'min', 'max'] as const
  }

  get value(): string {
    return this.getAttribute('value') || ''
  }
  set value(v: string) {
    this.setAttribute('value', v)
  }

  get min(): string {
    return this.getAttribute('min') || ''
  }
  set min(v: string) {
    this.setAttribute('min', v)
  }

  get max(): string {
    return this.getAttribute('max') || ''
  }
  set max(v: string) {
    this.setAttribute('max', v)
  }

  get step(): string {
    return this.getAttribute('step') || ''
  }
  set step(v: string) {
    this.setAttribute('step', v)
  }

  attributeChangedCallback(
    name: (typeof MultiInput.observedAttributes)[number],
    oldValue: string,
    newValue: string
  ) {
    if (oldValue === newValue) return
    this.inputs.forEach(input => {
      input[name] = newValue
    })
  }
}
customElements.define('multi-input', MultiInput)

const clamp = (n: number, min: number, max: number): number =>
  Math.max(Math.min(n, max), min)
const toFixed = (n: number, d: number): string =>
  n.toFixed(d).replace(/\.?0+$/, '')

// Longitude / Latitude

const longitudeControl = document.getElementById(
  'longitude-control'
) as MultiInput
const latitudeControl = document.getElementById(
  'latitude-control'
) as MultiInput

longitudeControl.addEventListener('input', event => {
  const target = event.target as InputElement | null
  if (!target?.value) return
  const value = Number(longitudeControl.value)
  if (
    isNaN(value) ||
    value < Number(longitudeControl.min) ||
    value > Number(longitudeControl.max)
  ) {
    return
  }
  globalContext.long = value * (Math.PI / 180)
})
latitudeControl.addEventListener('input', event => {
  const target = event.target as InputElement | null
  if (!target?.value) return
  let value = Number(latitudeControl.value)
  if (
    isNaN(value) ||
    value < Number(latitudeControl.min) ||
    value > Number(latitudeControl.max)
  ) {
    return
  }
  value = clamp(value, -89.99999999, 89.99999999)
  globalContext.lat = value * (Math.PI / 180)
})

globalContext.listen('update', event => {
  let { long, lat } = event.detail
  if (long !== undefined) {
    long = long * (180 / Math.PI)
    longitudeControl.value = toFixed(long, 7)
  }
  if (lat !== undefined) {
    lat = lat * (180 / Math.PI)
    latitudeControl.value = toFixed(lat, 7)
  }
})

// Speed slider
const speedControl = document.getElementById('speed-control') as MultiInput

const setSpeedControl = (speed: number): void => {
  const step = speedControl.step.split('.')[1].length || 0
  speedControl.value = speed.toFixed(step)
  speedControl.inputs.forEach(input => {
    if (input.type === 'range') {
      input.value = Math.sqrt(speed).toString()
    }
  })
}
setSpeedControl(globalContext.speed)

let speedControlTimeout: number
speedControl.addEventListener('input', event => {
  if (!speedControl.value) return
  let speed = Number(speedControl.value)
  if (isNaN(speed) || speed <= 0) {
    return
  }

  const target = event.target as InputElement
  if (target.type === 'range') speed = speed ** 2
  setSpeedControl(speed)
  clearTimeout(speedControlTimeout)
  speedControlTimeout = window.setTimeout(() => {
    globalContext.speed = speed
  }, 100)
})
globalContext.listen('speed', event => {
  setSpeedControl(event.detail.speed)
})

// Volume control
const volumeControl = document.getElementById('volume-control') as IconToggle

volumeControl.addEventListener('change', () => {
  const newState = volumeControl.isOn
  if (newState) {
    if (globalContext.audio) {
      globalContext.audio.resume()
    } else {
      globalContext.audio = new AudioContext({
        latencyHint: 'interactive',
      })
    }
  } else {
    globalContext.audio?.suspend()
  }
  globalContext.update({ isMuted: !newState })
})

export { updateDateDisplay }
