export type InputElement = HTMLInputElement

export class MultiInput extends HTMLElement {
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
    newValue: string,
  ) {
    if (oldValue === newValue) return
    this.inputs.forEach(input => {
      input[name] = newValue
    })
  }
}
