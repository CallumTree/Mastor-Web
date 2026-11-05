import { Sheet } from '../components/Ui'

/** The support inbox, once there is one (launch route: "Pick the support address"). Empty: the line isn't shown. */
export const SUPPORT_EMAIL = ''

const MONTH: [string, string, string][] = [
  ['I', 'Start the job from the client’s pack', 'New job, then choose the files they sent: the schedule, works orders, PCI or surveys. Every line is read for you to check before anything is saved. No pack? Set it up by hand.'],
  ['II', 'Scope is the list of work, house by house', 'Each house shows its lines and its variations together. Spot extra work? Add VO at the top of Scope. The client sent a VO ticket or schedule? Import, then VOs.'],
  ['III', 'On site, use the + key', 'A photo, video, voice note, note or dayworks sheet goes into today’s diary. Mastor reads it against the job’s scope and lines up what’s done and what’s extra for you to approve in Vals, under From site.'],
  ['IV', 'Tick work into the open valuation', 'In Scope, tick a line or a priced VO when it’s done. Untick it to send it back. Nothing is claimed until you tick it or approve it.'],
  ['V', 'Valuation week: the first week of the month', 'In Vals, send the open valuation for the client’s review; the certificate PDF is ready to send. When they agree, create the invoice. Mark it paid when the money lands.'],
  ['VI', 'Ask Clerk', 'Clerk, in each job’s header, answers questions about the job with its own figures, and proposes changes as a card you approve with Do it.'],
]

/** A month in Mastor, in six plain steps, and where to get help. */
export function HelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label="How Mastor works">
      <div className="stack">
        <h2 className="label bracket">How Mastor works</h2>
        <p className="muted t-note">A month on a job, start to paid.</p>
        <ol className="help-steps">
          {MONTH.map(([n, t, d]) => (
            <li key={n}><span className="ref-roman help-n" aria-hidden="true">{n}</span><div><b>{t}</b><p>{d}</p></div></li>
          ))}
        </ol>
        <div className="hint">Your data is yours: Settings → Backup saves everything to one file at any time.</div>
        {SUPPORT_EMAIL && <div className="t-note">Stuck? Email <b className="mono">{SUPPORT_EMAIL}</b> and we’ll reply by the next working day.</div>}
      </div>
    </Sheet>
  )
}
