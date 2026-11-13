import { useState } from 'react'
import { Plate } from '../components/Sign'
import { IconChevron } from '../components/Icons'
import { useAccess } from '../lib/access'
import { blankSettings, type CompanySettings } from '../lib/types'
import { Field, Sheet } from '../components/Ui'
import { formatInvoiceNo, missingForInvoice, vatRegistered } from '../lib/invoice'
import { SignOutButton } from '../components/SyncBadge'
import { checkAi, type AiCheck } from '../lib/aiCheck'
import { AiMonth } from '../components/AiMonth'

/** One line in Settings: what it is, sometimes one fact, and a chevron. Everything else is behind the tap. */
const SetRow = ({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) => (
  <button className="set-row" onClick={onClick}><span className="grow"><b>{label}</b>{sub && <span className="hint"> {sub}</span>}</span><IconChevron size={16} /></button>
)

/** Company details for invoices (shared with the whole company), then one row each for help, the team, the rates, the
 *  month's AI, exports and this device. Once the company's details are complete they fold to one row. */
export function SettingsSheet({ settings, onSave, onClose, onBackup, onRestore, onRates, onTeam, onExportInvoices, onHelp }: {
  settings?: CompanySettings; onSave: (s: CompanySettings) => void; onClose: () => void
  onBackup: () => Promise<void>; onRestore: (text: string) => Promise<number>; onPlayIntro?: () => void; onRates: () => void; onTeam: () => void
  onHelp?: () => void
  onExportInvoices?: (format: 'xero' | 'quickbooks', period: 'thisMonth' | 'lastMonth' | 'all', code: string) => Promise<number>
}) {
  const { money: m, manage } = useAccess()
  const [period, setPeriod] = useState<'thisMonth' | 'lastMonth' | 'all'>('lastMonth')
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [s, setS] = useState<CompanySettings>(settings ?? blankSettings())
  const [nextText, setNextText] = useState(String(s.nextInvoiceNumber || 1))
  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) => setS(x => ({ ...x, [k]: v }))
  const nextN = Math.max(1, parseInt(nextText.replace(/\D/g, '') || '1', 10))
  const preview = { ...s, nextInvoiceNumber: nextN }
  // complete details fold to one row; missing ones stay open, so the first invoice is never a hunt
  const [editing, setEditing] = useState(() => !settings || missingForInvoice(settings).length > 0)
  const T = (k: keyof CompanySettings, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label}><input value={String(s[k] ?? '')} onChange={e => set(k, e.target.value as never)} {...props} /></Field>
  )
  return (
    <Sheet onClose={onClose} label="Settings">
      <div className="stack">
        {m && (editing ? <>
        <h2 className="label bracket">Your company</h2>
        {T('name', 'Company name *', { placeholder: 'As it appears on your invoices' })}
        <Field label="Address *"><textarea rows={3} value={s.address} onChange={e => set('address', e.target.value)} /></Field>
        {/* not every firm is VAT-registered: one that isn't invoices without VAT and without a VAT number */}
        <div>
          <div className="field"><span id="vat-reg">VAT-registered</span></div>
          <div className="seg" role="radiogroup" aria-labelledby="vat-reg">
            {([[true, 'Yes'], [false, 'No']] as const).map(([v, l]) => <button key={l} type="button" role="radio" aria-checked={vatRegistered(s) === v} className={vatRegistered(s) === v ? 'on' : ''} onClick={() => set('vatRegistered', v)}>{l}</button>)}
          </div>
        </div>
        {vatRegistered(s) && T('vatNumber', 'VAT number *', { placeholder: 'GB 123 4567 89' })}

        <h3 className="label sec">Bank details</h3>
        <div className="row pair"><div className="grow">{T('sortCode', 'Sort code *', { inputMode: 'numeric', placeholder: '12-34-56' })}</div><div className="grow">{T('accountNumber', 'Account no. *', { inputMode: 'numeric' })}</div></div>
        <div className="row pair"><div className="grow">{T('accountName', 'Account name')}</div><div className="grow">{T('bankName', 'Bank')}</div></div>

        {/* the number carries on from the firm's own sequence, so it's asked before the first invoice, never folded away */}
        <h3 className="label sec">Invoices</h3>
        <div className="row pair">
          <div className="grow">{T('invoicePrefix', 'Prefix', { placeholder: 'e.g. INV-' })}</div>
          <div className="grow"><Field label="Next invoice number"><input inputMode="numeric" value={nextText} onChange={e => setNextText(e.target.value)} /></Field></div>
        </div>
        <div className="row pair">
          <div className="grow"><Field label="Digits"><input inputMode="numeric" value={String(s.invoicePad || '')} onChange={e => set('invoicePad', Math.min(8, parseInt(e.target.value || '0', 10) || 0))} placeholder="e.g. 4" /></Field></div>
          <div className="grow invoice-next"><span className="hint">Next</span> <b className="mono">{formatInvoiceNo(preview, nextN)}</b></div>
        </div>

        <details className="more" open={!!(s.phone || s.email || s.companyNumber || s.labourDayRate)}>
          <summary className="more-h">More</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <div className="row pair"><div className="grow">{T('phone', 'Phone', { inputMode: 'tel' })}</div><div className="grow">{T('email', 'Email', { inputMode: 'email' })}</div></div>
            <div className="row pair">
              <div className="grow">{T('companyNumber', 'Company no.')}</div>
              {vatRegistered(s) && <div className="grow"><Field label="VAT rate (%)"><input inputMode="decimal" value={String(s.vatRate)} onChange={e => set('vatRate', parseFloat(e.target.value) || 0)} /></Field></div>}
            </div>
            <Field label="Labour day rate (£)" hint="Your cost of one operative-day, for each job’s margin.">
              <input inputMode="decimal" value={s.labourDayRate != null ? String(s.labourDayRate) : ''} onChange={e => { const v = parseFloat(e.target.value.replace(/[£,]/g, '')); set('labourDayRate', isFinite(v) && v > 0 ? v : null) }} placeholder="e.g. 180" />
            </Field>
          </div>
        </details>
        <button className="btn btn-primary" disabled={!s.name.trim()} onClick={() => { onSave({ ...s, nextInvoiceNumber: nextN, updatedAt: Date.now() }); if (!missingForInvoice(preview).length) setEditing(false) }}>Save</button>
        </> : <SetRow label={s.name || 'Your company'} sub={`invoices ${formatInvoiceNo(preview, nextN)}`} onClick={() => setEditing(true)} />)}

        <div className="set-rows">
          {onHelp && <SetRow label="How Mastor works" onClick={onHelp} />}
          <SetRow label="Team" onClick={onTeam} />
          {m && <SetRow label="Schedule of rates" sub={s.rateBooks?.length ? `${s.rateBooks.reduce((n, b) => n + b.lines, 0).toLocaleString('en-GB')} rates` : undefined} onClick={onRates} />}
        </div>

        {m && <AiMonth />}

        {m && <details className="more">
          <summary className="more-h">Export invoices</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <div className="chips" role="group" aria-label="Accounts package">
              {(['xero', 'quickbooks'] as const).map(f => <button key={f} className={'chip' + ((s.accountsFormat ?? 'xero') === f ? ' on' : '')} aria-pressed={(s.accountsFormat ?? 'xero') === f} onClick={() => set('accountsFormat', f)}>{f === 'xero' ? 'Xero' : 'QuickBooks'}</button>)}
            </div>
            {(s.accountsFormat ?? 'xero') === 'xero' && <Field label="Xero sales account code"><input inputMode="numeric" value={s.accountsCode ?? '200'} onChange={e => set('accountsCode', e.target.value)} /></Field>}
            <div className="chips" role="group" aria-label="Period">
              {([['thisMonth', 'This month'], ['lastMonth', 'Last month'], ['all', 'All']] as const).map(([p, l]) => <button key={p} className={'chip' + (period === p ? ' on' : '')} aria-pressed={period === p} onClick={() => setPeriod(p)}>{l}</button>)}
            </div>
            <button className="btn btn-secondary" disabled={!onExportInvoices} onClick={async () => {
              const n = await onExportInvoices!(s.accountsFormat ?? 'xero', period, (s.accountsCode ?? '200').trim() || '200')
              setExportMsg(n ? `Downloaded ${n} invoice${n === 1 ? '' : 's'} for ${(s.accountsFormat ?? 'xero') === 'xero' ? 'Xero' : 'QuickBooks'}` : 'No invoices in that period')
            }}>Download CSV</button>
            {exportMsg && <div role="status"><Plate kind={exportMsg.startsWith('No') ? 'wait' : 'ok'}>{exportMsg}</Plate></div>}
          </div>
        </details>}

        <h3 className="label bracket sec">This device</h3>
        <div className="row">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={async () => { await onBackup(); setMsg('Backup saved to your Downloads') }}>Back up</button>
          <label className="btn btn-secondary" style={{ flex: 1 }} data-keep-clean>Restore…
            <input type="file" className="sr-only" accept=".json,application/json" onChange={async e => {
              const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
              try { const text = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(f) }); const n = await onRestore(text); setMsg(`Restored ${n} job${n === 1 ? '' : 's'}`) }
              catch (err) { setMsg((err as Error).message || 'Couldn’t restore that file — is it a Mastor backup?') }
            }} />
          </label>
        </div>
        {msg && <div className="flag" role="status">{msg}</div>}
        {manage && <details className="more">
          <summary className="more-h">Check AI setup</summary>
          <div className="stack" style={{ marginTop: 10 }}><AiSetup /></div>
        </details>}
        <SignOutButton />
      </div>
    </Sheet>
  )
}

/** Confirm before a number is used — invoice numbers can't be taken back. */
export function CreateInvoiceSheet({ number, net, vat, total, rate, missing, jobMissing = [], onCreate, onSettings, onJobSetup, onClose, agreeing, onAgreeOnly }: {
  number: string; net: string; vat: string; total: string; rate: number; missing: string[]
  /** what the job itself still needs (who the invoice is to) */
  jobMissing?: string[]
  onCreate: (date: number) => void; onSettings: () => void; onJobSetup?: () => void; onClose: () => void
  /** the valuation is still with the client: creating the invoice records their agreement; closing records nothing.
   *  `onAgreeOnly` records the agreement alone, for when the invoice can't be made yet or will be made later. */
  agreeing?: string; onAgreeOnly?: () => void
}) {
  const d = new Date(); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [date, setDate] = useState(key)
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <h2 className="label bracket">{rate > 0 ? 'Create VAT invoice' : 'Create invoice'}</h2>
        {agreeing && <div className="t-note">The client agreed {agreeing}. Creating the invoice records that; closing this records nothing.</div>}
        {missing.length ? (
          <>
            <div className="t-note">Before your first invoice, add your company details: <b>{missing.join(', ')}</b>.</div>
            <button className="btn btn-primary" onClick={onSettings}>Open company settings</button>
          </>
        ) : jobMissing.length ? (
          <>
            <div className="t-note">An invoice has to say who it’s to. Add <b>{jobMissing.join(' and ')}</b> in the job’s setup.</div>
            {onJobSetup && <button className="btn btn-primary" onClick={onJobSetup}>Open job setup</button>}
          </>
        ) : (
          <>
            <div className="panel" style={{ padding: 14 }}>
              <div className="row"><span className="grow muted">Invoice number</span><b className="mono" style={{ color: 'var(--ink-2)', fontSize: 18 }}>{number}</b></div>
              <div className="row" style={{ marginTop: 8 }}><span className="grow muted">Net</span><span className="mono">{net}</span></div>
              {rate > 0 ? <div className="row"><span className="grow muted">VAT @ {rate}%</span><span className="mono">{vat}</span></div>
                : <div className="row"><span className="grow muted">No VAT: not VAT-registered</span></div>}
              <div className="row" style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}><b className="grow">Total</b><b className="mono">{total}</b></div>
            </div>
            <Field label="Invoice date (tax point)"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
            <div className="hint">Once created, this number is used and can't be reissued. Payment terms run from this date.</div>
            <button className="btn btn-primary" disabled={!date} onClick={() => { const [y, m, dd] = date.split('-').map(Number); onCreate(new Date(y, m - 1, dd, 12).getTime()) }}>Create invoice {number}</button>
          </>
        )}
        {agreeing && onAgreeOnly && <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onAgreeOnly}>Record {agreeing} agreed, invoice it later</button>}
      </div>
    </Sheet>
  )
}

/** One tap: is every AI service Mastor uses set up and answering? Green or red, with what to fix. */
function AiSetup() {
  const [out, setOut] = useState<{ checks: AiCheck[]; build?: string } | null>(null)
  const res = out?.checks ?? null
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button className="btn btn-secondary" disabled={busy} onClick={async () => { setBusy(true); setOut(null); try { setOut(await checkAi()) } finally { setBusy(false) } }}>{busy ? 'Checking…' : 'Check AI setup'}</button>
      {res && <div className="stack" role="status">
        {res.map(c => <div key={c.name}><Plate kind={c.ok ? 'ok' : 'stop'}>{c.name}</Plate><div className="hint" style={{ marginTop: 2 }}>{c.detail}</div></div>)}
        {res.every(c => c.ok) && <div className="t-note t-strong">All working.</div>}
        {out?.build && <div className="hint mono">Checked on: {out.build}</div>}
      </div>}
    </>
  )
}
