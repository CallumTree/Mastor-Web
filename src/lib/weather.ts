/**
 * Weather for a diary day from Open-Meteo (free, no key). Finds the job's town from its address.
 * Returns null quietly if offline or the place can't be found — the field stays editable either way.
 */
import { meta } from './db'

const CODES: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Heavy showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail',
}

async function locate(address: string): Promise<{ lat: number; lon: number } | null> {
  const cached = await meta.get<{ lat: number; lon: number }>(`geo:${address}`)
  if (cached) return cached
  const parts = address.split(',').map(p => p.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, '').replace(/^\d+[a-z]?\s+/i, '').trim()).filter(p => p.length > 2)
  for (const name of parts.reverse()) {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`)
    if (!r.ok) continue
    const j = await r.json() as { results?: { latitude: number; longitude: number; country_code: string }[] }
    const hit = j.results?.find(x => x.country_code === 'GB') ?? null
    if (hit) { const loc = { lat: hit.latitude, lon: hit.longitude }; await meta.set(`geo:${address}`, loc); return loc }
  }
  return null
}

export async function weatherFor(address: string, date: string): Promise<string | null> {
  try {
    if (!address.trim()) return null
    const loc = await locate(address)
    if (!loc) return null
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&wind_speed_unit=mph&timezone=Europe%2FLondon&start_date=${date}&end_date=${date}`)
    if (!r.ok) return null
    const d = (await r.json() as { daily?: Record<string, number[]> }).daily
    if (!d?.weather_code?.length) return null
    const bits = [CODES[d.weather_code[0]] ?? 'Mixed', `${Math.round(d.temperature_2m_min[0])}–${Math.round(d.temperature_2m_max[0])}°C`]
    if (d.precipitation_sum?.[0] > 0.2) bits.push(`${d.precipitation_sum[0].toFixed(1)}mm rain`)
    if (d.wind_speed_10m_max?.[0] >= 25) bits.push(`wind ${Math.round(d.wind_speed_10m_max[0])}mph`)
    return bits.join(' · ')
  } catch { return null }
}
