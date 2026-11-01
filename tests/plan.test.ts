/** The plan on a job's line, and the week across jobs: late carried to today, done kept on its day, office-only hidden from site. */
import { jobLine, lateBy, weekLine, todosFor } from '../src/lib/plan'
import type { DiaryEntry, Job } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

const T = '2026-11-01'
const E = (id: string, type: DiaryEntry['type'], date: string, extra: Partial<DiaryEntry> = {}): DiaryEntry =>
  ({ id, jobId: 'j', date, type, note: id, labour: null, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, createdAt: 1, ...extra })
const entries = [
  E('site-yday', 'day', '2026-10-31', { weather: 'Dry', labour: 4 }),
  E('late', 'todo', '2026-10-30', { linkId: 'start' }),
  E('done-old', 'todo', '2026-10-29', { doneAt: 5 }),
  E('start', 'event', '2026-11-03', { time: '08:00' }),
  E('call', 'todo', '2026-11-03'),
  E('money', 'todo', '2026-11-02', { office: true }),
  E('anytime', 'todo', ''),
  E('far', 'event', '2027-01-20'),
  E('note', 'note', '2026-10-31'),
]
const L = jobLine(entries, T, { money: true })
ok(L.late.map(e => e.id).join() === 'late' && lateBy('2026-10-30', T) === '2 days late', 'an open to-do past its day is late, at today, and says by how much')
ok(L.before.some(d => d.date === '2026-10-29' && d.items.some(e => e.id === 'done-old')) && !L.before.some(d => d.items.some(e => e.id === 'late')), 'a done to-do stays on its day; a late one isn’t left behind')
ok(L.before.some(d => d.date === '2026-10-31' && d.site?.weather === 'Dry'), 'site days sit on the line behind today')
ok(L.ahead.map(d => d.date).join() === '2026-11-02,2026-11-03' && L.ahead[1].items.map(e => e.id).join() === 'start,call', 'days ahead in order; on a day, key dates before to-dos')
ok(L.undated.map(e => e.id).join() === 'anytime' && L.later === 1, 'no-date to-dos in the tray; beyond 30 days, a count')
const op = jobLine(entries, T, { money: false })
ok(!op.ahead.some(d => d.items.some(e => e.id === 'money')), 'operatives never see office-only items')
ok(todosFor(entries.find(e => e.id === 'start')!, entries).map(e => e.id).join() === 'late', 'a key date knows the to-dos that lead up to it')

const jobs = [{ id: 'j', status: 'Active' }, { id: 'k', status: 'Complete' }] as Job[]
const W = weekLine(jobs, [...entries, E('other', 'event', '2026-11-04', { jobId: 'k' })], T, { money: true })
ok(W.late.length === 1 && W.days.map(d => d.date).join() === '2026-11-02,2026-11-03' && W.count === 4, 'the week: late first, then the next 7 days, finished jobs left out, the far date not in it')
ok(weekLine(jobs, entries, T, { money: false }).count === 3, 'the week for an operative leaves office-only out')

console.log(`\nplan: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
