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

// Speed slider
const speedSlider = document.getElementById('speed-control') as HTMLInputElement
speedSlider.value = Math.sqrt(globalContext.speed).toString()
speedSlider.addEventListener('input', () => {
  globalContext.speed = Number(speedSlider.value) ** 2
})

export { updateDateDisplay }
