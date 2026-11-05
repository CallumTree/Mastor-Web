/**
 * What an AI call really cost, in credits: 1 credit = 1p of Mastor's AI cost at the suppliers' list prices.
 * Worked out from each call's own token counts (never estimated), then written to the firm's AI ledger
 * (supabase/schema.sql v8, ai_spend) so its plan's allowance is measured in money, not in uses.
 * Prices are US dollars per million tokens, as Anthropic and Google list them (5 Nov 2026).
 * (Files starting with "_" in /api are not routes on Vercel.)
 */
import { envKey } from './_guard.js'

/** Dollars to pounds. Set AI_USD_TO_GBP in Vercel to follow the rate; 0.80 errs on the side of counting more. */
export const usdToGbp = () => Number(envKey('AI_USD_TO_GBP')) || 0.80

/** Claude: input, output and cache read, $ per million tokens. Cache writes are 1.25 × input (5-minute cache). */
const CLAUDE = [
  [/opus/i, { input: 4, output: 20, cacheRead: 0.20 }],
  [/sonnet/i, { input: 2, output: 10, cacheRead: 0.20 }],
  [/haiku/i, { input: 0.10, output: 0.50, cacheRead: 0.01, over100k: 5 }],   // five times the price once a prompt passes 100K tokens
]
/** A model not in the list is charged as the dearest one, so a new model can never be read for free. */
const priceOf = model => (CLAUDE.find(([re]) => re.test(String(model || ''))) ?? CLAUDE[0])[1]

/** Credits for one Claude call from its usage. `batch`: the Message Batches API, half price. */
export function claudeCredits(model, usage, { batch = false } = {}) {
  const u = usage || {}
  const p = priceOf(model)
  const input = u.input_tokens || 0, write = u.cache_creation_input_tokens || 0, read = u.cache_read_input_tokens || 0, output = u.output_tokens || 0
  const step = p.over100k && input + write + read > 100_000 ? p.over100k : 1
  const usd = step * (input * p.input + write * p.input * 1.25 + read * p.cacheRead + output * p.output) / 1e6
  return toCredits(usd * (batch ? 0.5 : 1))
}

/** Credits for one Gemini transcription from its usageMetadata. Audio and video are priced as audio, the dearer input. */
export function geminiCredits(meta) {
  const m = meta || {}
  const pin = Number(envKey('GEMINI_PRICE_IN')) || 1.00, pout = Number(envKey('GEMINI_PRICE_OUT')) || 2.50
  const usd = ((m.promptTokenCount || 0) * pin + ((m.candidatesTokenCount || 0) + (m.thoughtsTokenCount || 0)) * pout) / 1e6
  return toCredits(usd)
}

const toCredits = usd => Math.round(usd * usdToGbp() * 100 * 1000) / 1000
