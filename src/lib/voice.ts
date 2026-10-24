/**
 * Voice notes on site. Phones record in different formats (webm on Android, mp4 on iPhone), so each
 * recording is turned into a small mono WAV on the device — a format every transcriber reads.
 * 16 kHz mono is plenty for speech: about 2MB a minute.
 */

export const VOICE_RATE = 16000
export const MAX_VOICE_SECONDS = 180

/** 16-bit PCM WAV from mono samples in −1…1. */
export function encodeWav(samples: Float32Array, rate = VOICE_RATE): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) { const x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true) }
  return new Blob([buf], { type: 'audio/wav' })
}

/** Whatever the phone recorded → 16 kHz mono WAV. */
export async function toWav(recording: Blob): Promise<Blob> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    const decoded = await ctx.decodeAudioData(await recording.arrayBuffer())
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * VOICE_RATE), VOICE_RATE)
    const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start()
    return encodeWav((await off.startRendering()).getChannelData(0))
  } finally { void ctx.close() }
}

export interface Recorder { stop: () => Promise<Blob>; cancel: () => void }

/** Starts recording from the microphone. stop() gives the WAV. */
export async function startRecording(): Promise<Recorder> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('This phone’s browser can’t record audio — type the note instead, or use the keyboard’s mic.')
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const rec = new MediaRecorder(stream)
  const chunks: Blob[] = []
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
  rec.start()
  const release = () => stream.getTracks().forEach(t => t.stop())
  return {
    stop: () => new Promise<Blob>((res, rej) => {
      rec.onstop = async () => { release(); try { res(await toWav(new Blob(chunks, { type: rec.mimeType }))) } catch (e) { rej(e) } }
      rec.stop()
    }),
    cancel: () => { rec.onstop = null; if (rec.state !== 'inactive') rec.stop(); release() },
  }
}
