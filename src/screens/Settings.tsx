import { useState } from 'react'
import { blankSettings, type CompanySettings } from '../lib/types'
import { Field, Sheet } from '../components/Ui'
import { formatInvoiceNo, missingForInvoice } from '../lib/invoice'

/** Company details for invoices. Saved for the whole company and synced to every device. */
export function SettingsSheet({ settings, onSave, onClose }: { settings?: CompanySettings; onSave: (s: CompanySettings) => void; onClose: () => void }) {
  const [s, setS] = useState<CompanySettings>(settings ?? blankSettings())
  const [nextText, setNextText] = useState(String(s.nextInvoiceNumber || 1))
  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) => setS(x => ({ ...x, [k]: v }))
  const nextN = Math.max(1, parseInt(nextText.replace(/\D/g, '') || '1', 10))
  const preview = { ...s, nextInvoiceNumber: nextN }
  const missing = missingForInvoice(preview)
  const T = (k: keyof CompanySettings, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label}><input value={String(s[k] ?? '')} onChange={e => set(k, e.target.value as never)} {...props} /></Field>
  )
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="label bracket">Company settings</div>
        <div className="muted" style={{ fontSize: 13 }}>Used on your VAT invoices. Shared with everyone in your company.</div>

        <div className="label" style={{ marginTop: 6 }}>Company</div>
        {T('name', 'Company name *', { placeholder: 'Tree & Sons Ltd' })}
        <Field label="Address *" hint="One line per row, or separated by commas"><textarea rows={3} value={s.address} onChange={e => set('address', e.target.value)} /></Field>
        <div className="row"><div className="grow">{T('phone', 'Phone', { inputMode: 'tel' })}</div><div className="grow">{T('email', 'Email', { inputMode: 'email' })}</div></div>
        <div className="row"><div className="grow">{T('vatNumber', 'VAT number *', { placeholder: 'GB 123 4567 89' })}</div><div className="grow">{T('companyNumber', 'Company no.')}</div></div>

        <div className="label" style={{ marginTop: 6 }}>Bank details (printed on invoices)</div>
        <div className="row"><div className="grow">{T('accountName', 'Account name')}</div><div className="grow">{T('bankName', 'Bank')}</div></div>
        <div className="row"><div className="grow">{T('sortCode', 'Sort code *', { inputMode: 'numeric', placeholder: '12-34-56' })}</div><div className="grow">{T('accountNumber', 'Account no. *', { inputMode: 'numeric' })}</div></div>

        <div className="label" style={{ marginTop: 6 }}>Invoices</div>
        <div className="row">
          <div className="grow">{T('invoicePrefix', 'Prefix', { placeholder: 'e.g. TS- (or blank)' })}</div>
          <div className="grow"><Field label="Next invoice number" hint="Carry on from your current sequence"><input inputMode="numeric" value={nextText} onChange={e => setNextText(e.target.value)} /></Field></div>
        </div>
        <div className="row">
          <div className="grow"><Field label="Digits" hint="e.g. 4 → 0042"><input inputMode="numeric" value={String(s.invoicePad || '')} onChange={e => set('invoicePad', Math.min(8, parseInt(e.target.value || '0', 10) || 0))} /></Field></div>
          <div className="grow"><Field label="VAT rate (%)"><input inputMode="decimal" value={String(s.vatRate)} onChange={e => set('vatRate', parseFloat(e.target.value) || 0)} /></Field></div>
        </div>
        <div className="panel" style={{ padding: '10px 14px', fontSize: 13 }}>Your next invoice will be <b className="mono" style={{ color: 'var(--copper-ink)' }}>{formatInvoiceNo(preview, nextN)}</b></div>
        {missing.length > 0 && <div className="flag">Needed before invoicing: {missing.join(', ')}</div>}
        <button className="btn btn-primary" disabled={!s.name.trim()} onClick={() => onSave({ ...s, nextInvoiceNumber: nextN, updatedAt: Date.now() })}>Save</button>
      </div>
    </Sheet>
  )
}

/** Confirm before a number is used — invoice numbers can't be taken back. */
export function CreateInvoiceSheet({ number, net, vat, total, rate, missing, onCreate, onSettings, onClose }: {
  number: string; net: string; vat: string; total: string; rate: number; missing: string[]
  onCreate: (date: number) => void; onSettings: () => void; onClose: () => void
}) {
  const d = new Date(); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [date, setDate] = useState(key)
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="label bracket">Create VAT invoice</div>
        {missing.length ? (
          <>
            <div style={{ fontSize: 14 }}>Before your first invoice, add your company details: <b>{missing.join(', ')}</b>.</div>
            <button className="btn btn-primary" onClick={onSettings}>Open company settings</button>
          </>
        ) : (
          <>
            <div className="panel" style={{ padding: 14 }}>
              <div className="row"><span className="grow muted">Invoice number</span><b className="mono" style={{ color: 'var(--copper-ink)', fontSize: 18 }}>{number}</b></div>
              <div className="row" style={{ marginTop: 8 }}><span className="grow muted">Net</span><span className="mono">{net}</span></div>
              <div className="row"><span className="grow muted">VAT @ {rate}%</span><span className="mono">{vat}</span></div>
              <div className="row" style={{ borderTop: '1px solid var(--ink-line)', marginTop: 6, paddingTop: 6 }}><b className="grow">Total</b><b className="mono">{total}</b></div>
            </div>
            <Field label="Invoice date (tax point)"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
            <div className="muted" style={{ fontSize: 12 }}>Once created, this number is used and can't be reissued. Payment terms run from this date.</div>
            <button className="btn btn-primary" disabled={!date} onClick={() => { const [y, m, dd] = date.split('-').map(Number); onCreate(new Date(y, m - 1, dd, 12).getTime()) }}>Create invoice {number}</button>
          </>
        )}
      </div>
    </Sheet>
  )
}
