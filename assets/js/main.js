
// ─── 1. AUDIO SETUP ───────────────────────────────────────────────────────────
// detectAudio: false → manejamos el audio nosotros, no Hydra
/*const hydra = new Hydra({ detectAudio: false })

const audioCtx = new AudioContext()
let analyserL, analyserR

navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 2,          // forzar estéreo
    echoCancellation: false,  // importante: sin esto la EIE puede tener problemas
    noiseSuppression: false,
    autoGainControl: false,
  }
}).then(stream => {
  const source = audioCtx.createMediaStreamSource(stream)
  const splitter = audioCtx.createChannelSplitter(2)

  analyserL = audioCtx.createAnalyser()
  analyserR = audioCtx.createAnalyser()
  analyserL.fftSize = 512
  analyserR.fftSize = 512
  analyserL.smoothingTimeConstant = 0.8  // suavizado para evitar saltos bruscos
  analyserR.smoothingTimeConstant = 0.8

  source.connect(splitter)
  splitter.connect(analyserL, 0)  // canal izquierdo → analyserL
  splitter.connect(analyserR, 1)  // canal derecho  → analyserR

  console.log('Audio conectado — canales separados OK')
}).catch(err => console.error('Error de audio:', err))


// ─── 2. FUNCIONES DE AMPLITUD ──────────────────────────────────────────────────
// Retorna RMS (0.0 → 1.0) de un analyser dado
function getAmp(analyser) {
  if (!analyser) return 0
  const buf = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

// Canal izquierdo (entrada 1 de la EIE)
const ampL = () => getAmp(analyserL)

// Canal derecho (entrada 2 de la EIE)
const ampR = () => getAmp(analyserR)


// ─── 3. HYDRA SKETCH ───────────────────────────────────────────────────────────
// noiseSize sube cuando la amplitud baja (relación inversa)
// Ajustá MIN, MAX y SENSITIVITY según tu señal
const MIN_SIZE  = 5    // tamaño cuando el sonido está fuerte
const MAX_SIZE  = 20  // tamaño cuando hay silencio
const SENS      = 3     // qué tan rápido crece (multiplicador de la amplitud)

const noiseSize = () => {
  const amp = (ampL() + ampR()) / 2           // promedio de ambos canales
  const size = MAX_SIZE - amp * SENS * MAX_SIZE
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, size))
}

// Si querés que el color también reaccione, podés usar ampL y ampR por separado:
const brightness = () => 1 + ampR() * 5    // canal derecho controla brillo

osc(30, 0.15, 15)
  .color(
    () => 1 + ampR() * 90 ,
    () => 1 + ampR() * 60,   // canal izquierdo → verde
    () => 1 + ampR() * 50    // canal derecho → azul
  )
  .rotate(Math.PI / 4, 0.05)
  .blend(
    noise(noiseSize, 0.4)      // ← el tamaño reacciona al audio
  )
  .out()
  // ─── AUDIO ────────────────────────────────────────────────────────────────────
// (asumiendo que audioCtx, analyserL, analyserR y getAmp ya están definidos
//  del sketch anterior — solo agregar esto si arrancás de cero)*/

// ─── PALETAS ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// HYDRA — ESFERAS CON AUDIO ESTÉREO + CAMBIO DE COLOR + BOMBO
// ═══════════════════════════════════════════════════════════════════════════════

const hydra = new Hydra({ detectAudio: false })

// ─── AUDIO SETUP ──────────────────────────────────────────────────────────────
const audioCtx = new AudioContext()
audioCtx.resume()  // ← primero, antes de todo
document.addEventListener('click', () => audioCtx.resume(), { once: true })

let analyserL, analyserR, analyserKick

navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 2,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  }
}).then(stream => {
  const source   = audioCtx.createMediaStreamSource(stream)
  const splitter = audioCtx.createChannelSplitter(2)

  analyserL = audioCtx.createAnalyser()
  analyserR = audioCtx.createAnalyser()
  analyserL.fftSize = 512; analyserL.smoothingTimeConstant = 0.25
  analyserR.fftSize = 512; analyserR.smoothingTimeConstant = 0.1

  // para el bombo usamos solo el canal L + lowpass
  // (evita el problema del ChannelMerger)
  const gainKick = audioCtx.createGain()
  gainKick.gain.value = 1.0

  const lowpass = audioCtx.createBiquadFilter()
  lowpass.type            = 'lowpass'
  lowpass.frequency.value = 150
  lowpass.Q.value         = 0.8

  analyserKick = audioCtx.createAnalyser()
  analyserKick.fftSize = 2048
  analyserKick.smoothingTimeConstant = 0.4

  source.connect(splitter)
  splitter.connect(analyserL, 0)
  splitter.connect(analyserR, 1)

  // cadena kick: canal L → gain → lowpass → analyserKick
  splitter.connect(gainKick, 0)
  gainKick.connect(lowpass)
  lowpass.connect(analyserKick)

  console.log('Audio conectado OK — L / R / Kick')
}).catch(err => console.error('Error de audio:', err))


// ─── AMPLITUD GENERAL ─────────────────────────────────────────────────────────
function getAmp(an) {
  if (!an) return 0
  const b = new Float32Array(an.fftSize)
  an.getFloatTimeDomainData(b)
  let s = 0
  for (let i = 0; i < b.length; i++) s += b[i] * b[i]
  return Math.sqrt(s / b.length)
}

const ampL = () => getAmp(analyserL)
const ampR = () => getAmp(analyserR)


// ─── DETECCIÓN DE BOMBO ───────────────────────────────────────────────────────
let kickEnergy    = 0.02   // ← valor inicial razonable, no 0
let kickScale     = 1.0    // ← empieza en 1, no en 20
let lastKickTime  = 0

const KICK_BOOST  = 0.4   // zoom al detectar bombo (0.1 sutil → 0.4 agresivo)
const KICK_DECAY  = 0.88   // velocidad de vuelta (0.80 rápido → 0.96 lento)
const COOLDOWN_MS = 300    // ms mínimos entre bombos
const SENSITIVITY = 2.5    // ratio energía/media para disparar (bajar si no detecta)
const THRESHOLD   = 0.0008  // ← positivo, energía mínima absoluta

function detectKick() {
  if (!analyserKick) return

  const buf = new Float32Array(analyserKick.fftSize)
  analyserKick.getFloatTimeDomainData(buf)

  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  const energy = Math.sqrt(s / buf.length)

  // media móvil lenta = nivel base de referencia
  kickEnergy = kickEnergy * 0.65 + energy * 0.01

  const now = performance.now()

  if (
    energy > kickEnergy * SENSITIVITY &&
    energy > THRESHOLD &&
    now - lastKickTime > COOLDOWN_MS
  ) {
    lastKickTime = now
    kickScale    = 2.0 + KICK_BOOST
    console.log('BOMBO — energy:', energy.toFixed(4), '| base:', kickEnergy.toFixed(4))
  }

  // decay frame a frame hasta volver a 1.0
  kickScale = 1.0 + (kickScale - 1.0) * KICK_DECAY
}

;(function loop() {
  detectKick()
  requestAnimationFrame(loop)
})()


// ─── PALETAS DE COLOR ─────────────────────────────────────────────────────────
const paletas = [
  { r: [0.0, 0.0, 1.0], g: [1.0, 0.0, 0.0], rMix: 0.6 },
  { r: [0.0, 0.8, 0.2], g: [1.0, 0.88, 0.0], rMix: 0.5 },
  { r: [0.6, 0.0, 0.8], g: [1.0, 0.4, 0.0], rMix: 0.5 },
  { r: [0.0, 0.9, 0.9], g: [1.0, 0.0, 0.5], rMix: 0.4 },
  { r: [1.0, 0.5, 0.0], g: [0.9, 0.0, 0.1], rMix: 0.6 },
]

let colorActual    = { ...paletas[0] }
let colorSiguiente = { ...paletas[0] }
let indicePaleta   = 0
let progreso       = 0
const FADE         = 0.3
const lerp         = (a, b, t) => a + (b - a) * t

setInterval(() => {
  indicePaleta   = (indicePaleta + 1) % paletas.length
  colorActual    = { ...colorSiguiente }
  colorSiguiente = paletas[indicePaleta]
  progreso       = 0
  console.log(`Paleta ${indicePaleta + 1}/${paletas.length}`)
}, 5000)

function cambiarColor(r, g) {
  colorActual    = { ...colorSiguiente }
  colorSiguiente = { r, g: g ?? r, rMix: colorActual.rMix }
  progreso       = 0
}

const cr   = i => () => { progreso = Math.min(progreso + FADE, 1); return lerp(colorActual.r[i], colorSiguiente.r[i], progreso) }
const cg   = i => () => lerp(colorActual.g[i], colorSiguiente.g[i], progreso)
const rMix = ()  => lerp(colorActual.rMix, colorSiguiente.rMix, progreso)


// ─── PARÁMETROS DE FORMA ──────────────────────────────────────────────────────
const GRID  = 20
const MIN_R = 1.0
const MAX_R = 1.4

const radius    = () => (MAX_R - Math.min((ampL() + ampR()) / 2, 0.3) * (MAX_R - MIN_R) * 0.6) * kickScale
const shineSize = () => radius() * 0.50


// ─── GRADIENTE DE COLOR ───────────────────────────────────────────────────────
const base = osc(2,   0, 0).rotate(() => time * 0.07)
const over  = osc(1.2, 0, 0).rotate(() => -time * 0.05 + Math.PI / 3)

const colorGrad = base
  .color(cr(0), cr(1), cr(2))
  .add(over.color(cg(0), cg(1), cg(2)), rMix)
  .contrast(() => 0.5 + ampL() * 2.5)


// ─── FORMAS ───────────────────────────────────────────────────────────────────
const mask = shape(30, radius, 0.6)

const highlight = shape(40, shineSize, () => 0.04 + ampL() * 0.2)
  .color(0.6, 0, 0)
  .scrollX(-0.19).scrollY(0.12)
  .mult(mask)

const shadow = shape(40, shineSize, () => 0.04 + ampL() * 0.2)
  .color(0, 2, 0)
  .scrollX(-0.25).scrollY(0.2)
  .mult(mask)
  .brightness(-0.1)


// ─── SKETCH FINAL ─────────────────────────────────────────────────────────────
colorGrad
  .mult(mask)
  .add(shadow)
  .add(highlight)
  .repeat(
    GRID, GRID,
    () => Math.sin(time * 0.4) * 0.08 + ampL() * 0.3,
    () => Math.cos(time * 0.35) * 0.08 + ampR() * 0.6
  )
  .scale(() => kickScale)
  .out()


// ─── DIAGNÓSTICO (comentar cuando todo funcione) ──────────────────────────────
setInterval(() => {
  if (!analyserKick) return console.log('analyserKick: no listo')
  const buf = new Float32Array(analyserKick.fftSize)
  analyserKick.getFloatTimeDomainData(buf)
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  const energy = Math.sqrt(s / buf.length)
  console.log(
    'energy:', energy.toFixed(5),
    '| base:', kickEnergy.toFixed(5),
    '| ratio:', (energy / kickEnergy).toFixed(2),
    '| scale:', kickScale.toFixed(3)
  )
}, 200)