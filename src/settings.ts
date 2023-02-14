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
  let datestr = dateTimePicker.dates.formatInput(DateTime.convert(date))
  dateTimeInput.value = datestr
}

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

// Speed slider
const speedControl = document.getElementById('speed-control') as MultiInput
speedControl.value = globalContext.speed.toString()

let speedControlTimeout: number
speedControl.addEventListener('input', event => {
  if (!speedControl.value) return
  let speed = Number(speedControl.value)
  if (isNaN(speed) || speed <= 0) {
    return
  }

  const target = event.target as InputElement
  const step = speedControl.step.split('.')[1].length || 0
  if (target.type === 'range') speed = speed ** 2
  speedControl.value = speed.toFixed(step)
  speedControl.inputs.forEach(input => {
    if (input.type === 'range') {
      input.value = Math.sqrt(speed).toString()
    }
  })
  clearTimeout(speedControlTimeout)
  speedControlTimeout = setTimeout(() => {
    globalContext.speed = speed
  }, 100)
})

export { updateDateDisplay }
