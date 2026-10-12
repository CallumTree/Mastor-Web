/**
 * Completion evidence pack (PDF): what was done, where, with the before and after photos and the
 * sign-off — what a client asks for before paying. One per works order, or one per scheme.
 * Built on the device (jsPDF); photos come from the device's own store. No prices: this is evidence of
 * the work, not a claim.
 */
import type { DiaryEntry, Job, ScopeItem, Valuation, WorkOrder } from './types'
import { db } from './db'
import { fetchPhoto } from './sync'
import { qtyText, ukDate } from './format'

interface Photo { id: string; caption: string }
interface Section { title: string; lines: ScopeItem[]; photos: { label: string; items: Photo[] }[] }
export interface EvidenceInput {
  company?: string; job: Job
  title: string                       // e.g. "Order R-104882"
  facts: [string, string][]           // title block cells
  sections: Section[]
  note?: string
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b) })
async function photoData(id: string): Promise<{ url: string; w: number; h: number; fmt: string } | null> {
  const b = (await db.photo(id)) ?? (await fetchPhoto(id))   // taken on another device: fetch it once
  const type = b?.type || 'image/jpeg'           // photos are stored as JPEG; some stores drop the type
  if (!b || !type.startsWith('image/')) return null
  const url = await blobToDataUrl(b)
  let w = 4, h = 3
  try { const bmp = await createImageBitmap(b); w = bmp.width; h = bmp.height; bmp.close() } catch { /* unknown size: 4:3 box */ }
  return { url, w, h, fmt: type.includes('png') ? 'PNG' : 'JPEG' }
}

export async function buildEvidence({ company, job, title, facts, sections, note }: EvidenceInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297, M = 14
  const INK: [number, number, number] = [18, 19, 22], MUTED: [number, number, number] = [86, 91, 99], LINE: [number, number, number] = [201, 206, 211]

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setCharSpace(1.2)
  doc.text((company || 'MASTOR').toUpperCase(), M, M + 2); doc.setCharSpace(0)
  doc.setFontSize(18); doc.setTextColor(...INK); doc.text('Completion evidence', M, M + 11)
  doc.setFontSize(12); doc.text(title, M, M + 18)

  // facts: two columns of label / value
  let y = M + 26
  doc.setDrawColor(...LINE); doc.setLineWidth(0.2)
  const colW = (W - 2 * M) / 2
  facts.forEach(([k, v], i) => {
    const x = M + (i % 2) * colW, yy = y + Math.floor(i / 2) * 11
    doc.line(x, yy, x + colW - 4, yy)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(k.toUpperCase(), x, yy + 3.6)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK); doc.text(doc.splitTextToSize(v || '—', colW - 6)[0], x, yy + 8.2)
  })
  y += Math.ceil(facts.length / 2) * 11 + 6
  if (note) {
    doc.setFontSize(9); doc.setTextColor(...INK)
    const ls = doc.splitTextToSize(`Notes: ${note}`, W - 2 * M); doc.text(ls, M, y); y += ls.length * 4.2 + 4
  }

  for (const s of sections) {
    if (y > H - 60) { doc.addPage(); y = M }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK); doc.text(s.title, M, y); y += 3
    if (s.lines.length) {
      autoTable(doc, {
        startY: y, margin: { left: M, right: M }, theme: 'plain',
        head: [['Code', 'Work done', 'Where', 'Qty']],
        body: s.lines.map(l => [l.code || '—', l.description, l.room || '', l.qty != null ? `${qtyText(l.qty)} ${l.unit}` : 'not stated']),
        styles: { font: 'helvetica', fontSize: 8.5, textColor: INK, cellPadding: { top: 1.6, bottom: 1.6, left: 1, right: 1 }, lineColor: LINE, lineWidth: { bottom: 0.15 } },
        headStyles: { fontStyle: 'bold', fontSize: 7, textColor: MUTED, lineWidth: { bottom: 0.4 }, lineColor: INK },
        columnStyles: { 0: { cellWidth: 22, font: 'courier' }, 2: { cellWidth: 36 }, 3: { cellWidth: 24, halign: 'right' } },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
    }
    for (const g of s.photos) {
      if (!g.items.length) continue
      if (y > H - 70) { doc.addPage(); y = M }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(`${g.label.toUpperCase()} · ${g.items.length} PHOTO${g.items.length === 1 ? '' : 'S'}`, M, y); y += 3
      const cw = (W - 2 * M - 6) / 2, ch = cw * 0.75
      for (let i = 0; i < g.items.length; i++) {
        const col = i % 2
        if (col === 0 && y + ch + 8 > H - M) { doc.addPage(); y = M }
        const x = M + col * (cw + 6)
        const p = await photoData(g.items[i].id)
        doc.setDrawColor(...LINE); doc.rect(x, y, cw, ch)
        if (p) {
          const r = Math.min(cw / p.w, ch / p.h), w = p.w * r, h = p.h * r
          try { doc.addImage(p.url, p.fmt, x + (cw - w) / 2, y + (ch - h) / 2, w, h) } catch { doc.setFontSize(8); doc.text('Photo could not be added', x + 3, y + 6) }
        } else { doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text('Photo not on this device', x + 3, y + 6) }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED)
        doc.text(doc.splitTextToSize(`${i + 1}. ${g.items[i].caption}`, cw)[0], x, y + ch + 4)
        if (col === 1 || i === g.items.length - 1) y += ch + 9
      }
      y += 2
    }
    y += 4
  }

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED)
    doc.text(`${(job.contractRef || job.name).toUpperCase()} · ${title.toUpperCase()} · PAGE ${p} OF ${pages}`, M, H - 8)
    doc.text('Prepared with Mastor', W - M, H - 8, { align: 'right' })
  }
  return doc.output('blob')
}

/** Evidence for one works order. */
export function orderEvidence(job: Job, o: WorkOrder, scope: ScopeItem[], company?: string): EvidenceInput {
  return {
    company, job, title: `Order ${o.ref}`, note: o.note || undefined,
    facts: [['Order', o.ref], ['Address', o.address], ['Client', job.client], ['Contract', job.contractRef || job.name],
      ['Priority', o.priority], ['Raised', ukDate(o.raisedAt)], ['Completed', o.completedAt ? ukDate(o.completedAt) : 'Not yet'], ['Signed off by', o.signedBy || 'Not signed']],
    sections: [{ title: 'Work done', lines: scope.filter(i => i.orderId === o.id),
      photos: [{ label: 'Before', items: o.beforeIds.map((id, i) => ({ id, caption: `Before ${i + 1}` })) }, { label: 'After', items: o.afterIds.map((id, i) => ({ id, caption: `After ${i + 1}` })) }] }],
  }
}

/** Evidence for a scheme: the work claimed so far (by property on multi-property schemes) and the site diary's photos. */
export function schemeEvidence(job: Job, scope: ScopeItem[], vals: Valuation[], diary: DiaryEntry[], company?: string): EvidenceInput {
  const claimed = scope.filter(i => i.valuationId && vals.some(v => v.id === i.valuationId))
  const props = [...new Set(claimed.map(i => i.property || ''))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const photos = diary.filter(d => d.type === 'photo' && d.mediaId).sort((a, b) => a.date.localeCompare(b.date))
  const dated = (d: DiaryEntry) => `${ukDate(new Date(d.date + 'T12:00:00').getTime())}${d.room ? ` · ${d.room}` : ''}${d.note ? ` · ${d.note}` : ''}`
  return {
    company, job, title: job.name,
    facts: [['Job', job.name], ['Site', job.address], ['Client', job.client], ['Contract ref', job.contractRef], ['PO', job.poNumber || 'Not set'], ['Lines evidenced', `${claimed.length} claimed to date`]],
    sections: [
      ...props.map(p => ({ title: p ? `Property ${p}` : 'Work claimed to date', lines: claimed.filter(i => (i.property || '') === p), photos: [] })),
      { title: 'Site photos', lines: [], photos: [{ label: 'From the site diary', items: photos.map(d => ({ id: d.mediaId!, caption: dated(d) })) }] },
    ],
  }
}

export const evidenceFileName = (job: Job, what: string) => `${(job.contractRef || job.name).replace(/[^A-Za-z0-9-]+/g, '_')}_${what.replace(/[^A-Za-z0-9-]+/g, '_')}_evidence.pdf`
