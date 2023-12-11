import { TempusDominus, DateTime } from '@eonasdan/tempus-dominus'
import globalContext from '../lib/global'

export class DateTimePicker extends HTMLElement {
  readonly td: TempusDominus
  readonly input = this.querySelector('input')
  private date = new Date()

  constructor() {
    super()
    this.td = new TempusDominus(this)
    this.td.subscribe('change.td', ({ date }) => {
      this.blur()
      if (date.getTime() !== this.date.getTime()) {
        globalContext.date = date
      }
    })
    this.td.subscribe('show.td', () => {
      if (!this.input) return
      const display = DateTime.fromString(this.input.value, {})
      if (display.toString() === 'Invalid Date') return
      display.setSeconds(this.date.getSeconds(), this.date.getMilliseconds())
      this.td.dates.setValue(display)
    })
  }

  updateDisplay(date: Date): void {
    if (!this.input || this.input === document.activeElement) return
    const datestr = this.td.dates.formatInput(DateTime.convert(date))
    if (this.input.value !== datestr) {
      this.input.value = datestr
    }
    this.date = date
  }
}
