export class IconToggle extends HTMLElement {
  readonly checkbox: HTMLInputElement | null
  readonly icon: HTMLElement | null
  private labelSpan: HTMLSpanElement | null

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

  private iconClasses: {
    on?: string[]
    off?: string[]
  } = {}
  private labelText: {
    on?: string
    off?: string
  } = {}

  constructor() {
    super()
    this.icon = this.querySelector('i')
    this.checkbox = this.querySelector('input')
    this.labelSpan = this.querySelector('span')
    this.checkbox?.addEventListener('change', () => {
      this.isOn = this.checkbox?.checked || false
    })
  }

  connectedCallback() {
    this.iconClasses = {
      on: (this.getAttribute('on-icon') ?? '').split(' '),
      off: (this.getAttribute('off-icon') ?? '').split(' '),
    }
    this.labelText = {
      on: this.getAttribute('on-label') ?? undefined,
      off: this.getAttribute('off-label') ?? undefined,
    }
    this.update(this.isOn)
  }

  update(state: boolean): void {
    const remove = this.iconClasses[state ? 'off' : 'on'] ?? []
    const add = this.iconClasses[state ? 'on' : 'off'] ?? []
    this.icon?.classList.remove(...remove)
    this.icon?.classList.add(...add)
    if (this.labelSpan) {
      this.labelSpan.innerText =
        ' ' + (this.labelText[state ? 'on' : 'off'] ?? '')
    }
  }

  static get observedAttributes() {
    return ['on'] as const
  }

  attributeChangedCallback(
    name: (typeof IconToggle.observedAttributes)[number],
    oldValue: string,
    newValue: string,
  ) {
    if (oldValue === newValue) return
    if (name === 'on') {
      const state = newValue !== null
      this.update(state)
    }
  }
}
