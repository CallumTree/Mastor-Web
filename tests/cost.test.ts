// What an AI call really cost, in credits (1 credit = 1p at list price), and what Settings says about the month.
import { claudeCredits, geminiCredits } from '../api/_cost.js'
import { aiMonthLines, type AiMonthData } from '../src/components/AiMonth'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const near = (a: number, b: number) => Math.abs(a - b) < 0.0005

// Opus 5.5: $4 in, $20 out, $0.20 cache reads, writes 1.25 × input. 0.80 £ to the $.
ok(near(claudeCredits('claude-opus-5-5', { input_tokens: 1_000_000 }), 320), 'a million Opus input tokens: $4 → 320p')
ok(near(claudeCredits('claude-opus-5-5', { output_tokens: 100_000 }), 160), '100K Opus output tokens: $2 → 160p')
ok(near(claudeCredits('claude-opus-5-5', { cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 100_000 }), 16 + 40), 'cache reads at $0.20, writes at 1.25 × input')
ok(near(claudeCredits('claude-opus-5-5', { input_tokens: 20_000, output_tokens: 1_000 }, { batch: true }), 4), 'a site day in a batch: half price')
ok(near(claudeCredits('claude-sonnet-5', { input_tokens: 10_000, output_tokens: 2_000 }), 3.2), 'Sonnet: $2 in, $10 out')
// Haiku 5.5: $0.10 / $0.50 up to a 100K-token prompt, five times that above
ok(near(claudeCredits('claude-haiku-5-5', { input_tokens: 50_000, output_tokens: 1_000 }), 0.44), 'an everyday Clerk question on Haiku: under half a penny')
ok(near(claudeCredits('claude-haiku-5-5', { input_tokens: 90_000, cache_read_input_tokens: 20_000, output_tokens: 1_000 }), 5 * (0.72 + 0.016 + 0.04)), 'a Haiku prompt past 100K tokens: five times the price, on all of it')
ok(near(claudeCredits('claude-opus-5-5-20261101', { input_tokens: 1_000_000 }), 320), 'a dated model name is priced as its family')
ok(near(claudeCredits('some-new-model', { input_tokens: 1_000_000 }), 320), 'an unknown model is charged as the dearest, never free')
ok(claudeCredits('claude-opus-5-5', undefined) === 0, 'no usage: nothing')
ok(near(geminiCredits({ promptTokenCount: 2000, candidatesTokenCount: 200 }), 0.2), 'a voice note through Gemini: a fifth of a penny')
process.env.AI_USD_TO_GBP = '0.75'
ok(near(claudeCredits('claude-opus-5-5', { input_tokens: 1_000_000 }), 300), 'the exchange rate can be set in Vercel')
delete process.env.AI_USD_TO_GBP

// Settings → AI this month
const month = (d: Partial<AiMonthData>): AiMonthData => ({ plan: 'minerva', allowance: 1500, reads_allowed: null, economy: 0, used: 0, reads: 0, site_reads: 0, site_credits: 0, questions_today: 0, questions_allowed: 50, ...d })
let v = aiMonthLines(month({ used: 930, site_reads: 20, site_credits: 160 }))
ok(v.plan === 'Minerva II' && v.pct === 62 && v.figure === '62% used', 'a share of the allowance, never credits or pence')
ok(v.lines[0] === 'About 71 site days left at your usual rate.', 'site days left at this firm’s own rate (8 credits a day here)')
ok(v.lines[1] === 'Everyday Clerk questions don’t count: 0 of 50 asked today.', 'everyday questions said to be outside it')
v = aiMonthLines(month({ used: 300, site_reads: 2, site_credits: 20 }))
ok(!v.lines.some(l => /site day/.test(l)), 'too few site reads to know the usual rate: no guess')
v = aiMonthLines(month({ used: 1600 }))
ok(v.pct === 100 && /pauses until the 1st/.test(v.lines[0]), 'used up: says it pauses until the 1st')
v = aiMonthLines(month({ plan: 'jupiter', allowance: 4000, economy: 4000, used: 4100 }))
ok(/still read, more lightly/.test(v.lines[0]), 'Jupiter used up: site captures still read in the economy lane')
v = aiMonthLines(month({ plan: 'mercury', allowance: 0, reads_allowed: 5, reads: 2, questions_allowed: 0 }))
ok(v.plan === 'Mercury I' && v.figure === '2 of 5 reads' && v.pct === 40 && !v.lines.some(l => /Clerk/.test(l)), 'Mercury: reads counted, no Clerk line')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
