# Mastor roadmap

Aim: replace the SoR framework contractor's spreadsheet stack (master schedule, subbie comparison, valuation tabs) for small social-housing maintenance contractors. Launch to 2–3 pilot firms doing council or housing-association framework work.

## Built for launch

| | What | Why it matters for this corner |
|---|---|---|
| ✓ | Read the client's pack | Spec list, works orders, PCI and surveys in one go: schedules read exactly, the documents checked against each other, every disagreement flagged, the pack kept with the job. PCI and surveys read for site facts (to notes) and work the scope is missing (to VOs), every item quoted and the quote checked |
| ✓ | Schedule of rates library | Import the framework SoR once; price every code from it, exactly as printed |
| ✓ | BoQ rate check against the SoR | Finds lines the client has priced below the framework — money found |
| ✓ | Costs and margin per job | Subbie quotes, labour and materials against what the client pays (SoR × uplifts) |
| ✓ | Small works orders (responsive / voids) | One property, a few SoR lines, photos, complete — then claimed together |
| ✓ | Completion evidence pack | One PDF per property/order with lines, before/after photos and sign-off |
| ✓ | Dayworks sheets | Hours and materials on site, priced from the SoR labour rates, signed |
| ✓ | Operatives see no money | Rates, values, costs and invoices hidden for the operative role |
| ✓ | Issuing a valuation | One sheet: what it certifies by property or trade, uplifts and running total, what the client's QS would query (no PO, uninstructed VOs, over-claiming), a draft certificate — then Create invoice as the next step |
| ✓ | Xero / QuickBooks invoice export | No typing invoices twice |
| ✓ | Team invites, AI reading locked to members | Multi-user, and no one else can spend the AI credit |

## Cut or slimmed

- Dashboard leads with what needs action (owed, overdue, unpriced, margin — marked provisional while anything is unknown), charts removed.
- Opening titles play once per device.
- Job notes and diary notes are one thing; one way into each action.
- RAMS and programme stay in the contractor's documents; Mastor stores them against the job.

## Before pilots (from the launch audit)

0. Run `supabase/schema.sql` in Supabase (adds the AI limit, team, costs, orders, dayworks and documents tables — safe to re-run).
1. Error monitoring and "Report a problem".
2. Company data export and deletion request.
3. Supabase Pro + backups, own email sender; Vercel Pro; domain; Anthropic spend limit.
4. Privacy policy and terms; ICO fee if applicable.
5. Restyle the PDFs to the signage language.

## Parked

- Formal CVR. Mastor is the job's master schedule for firms without a QS; margin stays a plain answer, not month-end finance.
- Older SoR versions: only the current framework book (v8) is loaded, so lookups and checks have one answer.
- JCT/NRM work from private QSs and architects (retention, QS certificates, payment and pay-less notices). Bridge later: import a priced bill with lump sums and provisional sums.
- Role permissions beyond "operatives see no money".
- More than one company per person.
- Card billing.
