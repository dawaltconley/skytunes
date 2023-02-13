import globalContext from './global'

// settings controls
const speedSlider = document.getElementById('speed-control') as HTMLInputElement
speedSlider.value = Math.sqrt(globalContext.speed).toString()
speedSlider.addEventListener('input', () => {
  globalContext.speed = Number(speedSlider.value) ** 2
})
