# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable PWA (portrait, standalone). Mobile web on site and desktop browser in the office are both first-class. It is not a native app.

## Users

Mastor is a product for small UK building contractors. Tree & Sons Ltd is the first user, and its work shapes the product, but the target market is small builders in general. The schema has been multi-company from day one.

People who use it every day:

- **Director / QS (office):** builds valuations, raises VAT invoices, keeps the variation register, and chases payment. Usually works on a laptop or desktop with long, careful sessions where the figures must hold up.
- **Site manager (on site):** keeps the site diary, takes photos, and raises variations (VOs) as they are found. Uses a phone outdoors, often in glare and with gloves, sometimes with poor or no signal.
- **Operatives:** trades on site who log work and photos. Visits are brief, and they shouldn't need any training.

People who only see the outputs:

- **Council client** (for example Pembrokeshire County Council): never opens the app, but receives its PDFs: the Variation Register, valuations and VAT invoices. These outputs are part of the product, and they have to pass a council QS's scrutiny.

Membership roles in the schema: owner, director, qs, site_manager, operative.

## Product Purpose

Mastor tracks a job's money from start to finish: works order / BoQ → site diary → variations → interim valuations → VAT invoice → payment. Each figure can be traced back to its source. Success means a contractor claims everything they are owed, can defend every line to a council, and isn't let down by the app on site.

## Positioning

- **Never invents numbers.** If a quantity hasn't been measured, it shows as "not measured". If a line has no rate, it shows as "unpriced", never £0. A missing PO stays blank and flagged until the client issues one. The trail from BoQ line to VO to valuation to invoice holds up under a council audit.
- **Built for council PPR/WHQS work.** It reads council BoQs and SoR codes, handles uplifts, and supports multi-property schemes (property and workstream per line). It can read VO instructions in any form the council sends them: Excel, PDF, photographed or scanned tickets, handwritten site instructions.
- **One way to do each thing.** The app stays simple on purpose and avoids feature sprawl.

## Operating Context

- Jobs come in as council works orders: a BoQ in Excel or PDF with SoR codes, quantities and rates, and two uplift percentages.
- Variations are found on site, priced, and then sent to the client for instruction. The council issues its own VO reference, sometimes as a scan, a photo or a handwritten ticket. VOs move through Identified → Instructed → Complete or Rejected.
- Interim valuations are numbered sequentially per job. Only one is Open at a time, and Issued valuations are locked. Each issued valuation can have one VAT invoice. Payment terms are counted from the invoice date, and part payments are tracked.
- Every output is a PDF in a drawing-sheet style that goes to the council.
- Site use means a phone outdoors, intermittent signal and short sessions. Office use means a desktop, long sessions and close checking of figures.

## Capabilities and Constraints

- React 18 + Vite + TypeScript. Supabase handles auth and sync, with Row Level Security per company. IndexedDB is the on-device store, and the app keeps working offline once signed in, then syncs later. Vercel deploys from `main`. Serverless parsing lives in `api/parse-boq.js` and `api/parse-vo.js`.
- Screens: Jobs list, Dashboard, Job view, Scope (BoQ), Diary, Variations, Valuations, Notes, Settings, BoQ import, VO import, photo picker, sign-in gate.
- Business rules: VO numbers run sequentially per job (highest + 1) and are never reused. Invoice numbers are never reused, and the sequence can continue from the company's existing one. Valuations and VOs are shown in Roman numerals (VAL III, VO XII).
- Terminology: VO (variation order), BoQ, SoR code, PO / vary-order PO, uplift, valuation (VAL), PPR, WHQS, works order, workstream, property.
- Undecided: pricing, licensing, onboarding of outside companies, and any role-based restrictions beyond the schema roles.

## Brand Commitments

- Name: **Mastor**. Wordmark **MΛSTΘR**: Cinzel Roman capitals, with a hand-drawn Λ and a Θ whose bar reads as a spirit level (`src/components/Wordmark.tsx`). The rest of the app uses normal letters.
- App icon: a Roman masonry arch, copper on charcoal (`public/icon.svg`, generator `tools/make_icon.py`).
- Classical thread: Roman numerals for valuations and VOs, plus an opening-titles sequence with the arch and keystone.
- Voice: plain, direct builder's English (en-GB). It never overstates.

## Evidence on Hand

- Real fixtures: the 51 Precelly Place VO 5 Excel and BoQ data (`tests/prescelly.tsv`).
- Cover photography: Unsplash-licensed construction photos (`src/lib/look.ts`), credited. Jobs can use their own site photos.
- Generated line drawings of properties (`src/components/drawings.generated.ts`, `tools/drawings.source.json`).
- **Not on hand:** customer testimonials, outside users, usage metrics, pricing or press. These must not be fabricated.

## Product Principles

1. **Truth over tidiness.** Show unknowns as unknown. A blank that is honest is better than a plausible number.
2. **Every figure traces to its source.** A council QS should be able to follow any line back to the BoQ, the VO or the instruction behind it.
3. **One way to do each thing.** Add capability without adding alternative paths.
4. **Site-proof.** It has to work on a phone, outdoors, with no signal, for someone who hasn't been trained on it.
5. **The outputs are the product.** The PDFs the client receives deserve as much care as the screens.

## Accessibility & Inclusion

Outdoor phone use calls for legible contrast in bright light, large touch targets that work with gloves, and respect for reduced motion (the opening titles already turn off under reduced motion). No formal standard has been confirmed. WCAG 2.2 AA is the working assumption, not a requirement anyone has stated.
