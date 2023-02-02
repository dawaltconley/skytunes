import { EnvOscillatorNode } from './stars'
import './tailwind.css'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const context = canvas.getContext('2d')!
const playButton = document.getElementById('play-button') as HTMLButtonElement

let { width, height } = canvas.getBoundingClientRect()
let scale = window.devicePixelRatio
width = width * scale
height = height * scale
let radius = Math.min(width, height) / 2
let center = {
  x: width / 2,
  y: height / 2,
}
canvas.width = width
canvas.height = height

const audio = new AudioContext()
const analyser = audio.createAnalyser()
analyser.fftSize = 64
// analyser.minDecibels = -90
// analyser.maxDecibels = -10
const bufferLength = analyser.frequencyBinCount

let oscillator = new EnvOscillatorNode(audio, {
  frequency: 300,
  env: {
    attack: 0.05,
    decay: 0.15,
    sustain: 0.66,
    release: 5,
  },
  amp: 0.5,
})
// oscillator.frequency.setValueAtTime(hz, 0)
// // let gainControl = audio.createOscillator()
// // gainControl.frequency.setValueAtTime(hz / 128, 0)
// let gainNode = audio.createGain()
// gainNode.gain
//   .setValueAtTime(0, playTime)
//   .linearRampToValueAtTime(0.5, playTime + 0.05)
//   .linearRampToValueAtTime(0.3, playTime + 0.15)
//   .linearRampToValueAtTime(0, playTime + 5)

// let freqControl = audio.createOscillator()
// freqControl.frequency.setValueAtTime(8, 0)
let freqControl = new OscillatorNode(audio, {
  type: 'square',
  frequency: 2,
})
let freqControlGain = audio.createGain()
freqControlGain.gain.setValueAtTime(12, 0) // cents detune
freqControl.connect(freqControlGain).connect(oscillator.detune)
// freqControl.connect(oscillator.detune)

oscillator.connect(analyser) // .connect(audio.destination)
playButton.addEventListener('click', () => {
  const hz = 440
  const playTime = audio.currentTime
  console.table({
    oscillator: oscillator.context.currentTime,
    freqControl: freqControl.context.currentTime,
    audio: audio.currentTime,
  })
  oscillator.start.call(oscillator, 0)
  // oscillator.stop(playTime + 5.2)
  freqControl.start()

  // const data = new Uint8Array(bufferLength)
  const data = new Uint8Array(2)
  let playing = true

  oscillator.addEventListener('ended', () => {
    playing = false
  })

  const draw = () => {
    if (playing) requestAnimationFrame(draw)
    analyser.getByteFrequencyData(data)
    console.log(data)

    context.clearRect(0, 0, width, height)
    const barWidth = (width / bufferLength) * 2.5
    // let barHeight
    let dB
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      dB = data[i]

      context.fillStyle = `rgb(${dB + 100}, 50, 50)`
      context.beginPath()
      context.arc(center.x, center.y, (4 * dB) / 256, 0, 2 * Math.PI)
      context.fill()

      // context.fillStyle = `rgb(${barHeight + 100}, 50, 50)`
      // context.fillRect(x, height - barHeight / 2, barWidth, barHeight / 2)
      //
      // x += barWidth + 1
    }
  }
  // const draw = () => {
  //   if (playing) requestAnimationFrame(draw)
  //   analyser.getByteTimeDomainData(data)
  //   // console.log(data)
  //
  //   context.clearRect(0, 0, width, height)
  //   context.lineWidth = 2
  //   context.strokeStyle = 'rgb(0, 0, 0)'
  //
  //   const sliceWidth = (width * 1.0) / bufferLength
  //   let x = 0
  //
  //   context.beginPath()
  //   for (let i = 0; i < bufferLength; i++) {
  //     const v = data[i] / 128.0
  //     const y = (v * height) / 2
  //
  //     if (i === 0) {
  //       context.moveTo(x, y)
  //     } else {
  //       context.lineTo(x, y)
  //     }
  //
  //     console.log(x, y)
  //
  //     x += sliceWidth
  //   }
  //   context.lineTo(width, height / 2)
  //   context.stroke()
  // }
  draw()
})
