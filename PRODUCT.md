# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable PWA (portrait, standalone). Mobile web on site and desktop browser in the office are both first-class. It is not a native app.

## Users

Mastor is for **small UK contractors doing social-housing maintenance under schedule-of-rates frameworks**: council and housing-association PPR, WHQS (Wales) / Decent Homes (England) programmes, responsive repairs and voids. Typically 2–30 people, no commercial department, currently running the money side in Excel (master schedule, subbie comparison, valuation tabs). Tree & Sons Ltd (Pembrokeshire County Council framework) is the first user and its work shapes the product.

People who use it every day:

- **Director / QS (office):** prices work from the SoR, builds valuations and monthly applications, raises VAT invoices, keeps the variation register, watches margin and chases payment. Laptop or desktop, long careful sessions where the figures must hold up.
- **Site manager (on site):** site diary, photos, variations and dayworks as they are found, completes small works orders. Phone outdoors, often in glare and gloves, sometimes no signal.
- **Operatives:** log work, hours and photos. Brief visits, no training. **Never see rates, values or margins.**

People who only see the outputs:

- **The client** (council or housing association, e.g. Pembrokeshire County Council): never opens the app but receives its PDFs — Variation Register, valuation certificates, VAT invoices, dayworks sheets and completion evidence packs. These have to pass a client QS's scrutiny.

Membership roles: owner, director, qs, site_manager, operative. Owners and directors manage the team; operatives see no money.

## Product Purpose

Mastor runs the commercial side of SoR framework work from start to finish: works order / BoQ priced against the framework SoR → site diary, dayworks and variations → completion evidence → interim valuation or monthly application → VAT invoice → payment, with cost and margin alongside. Each figure traces back to its source. Success means a contractor claims everything they're owed, knows what each job makes, can defend every line to the client, and isn't let down by the app on site.

## Positioning

- **The master schedule, in one place — hence MΛSTΘR.** Built from a day-to-day sticking point: a job's money and record spread across endless spreadsheets, OneNote, planners and sticky notes. Mastor puts the job — scope, variations, diary, notes, documents, valuations, invoices — in one spot. For small and family-run firms that don't have a QS or haven't scaled yet: it does the intermediary work a QS would, simply and cheaply, and grows with the firm (team, roles, more jobs) without changing how it works.
- **Replaces the SoR contractor's spreadsheet stack.** Trade job apps are built for domestic quotes and know nothing about SoR codes, uplifts, client VOs or valuations; enterprise construction software is priced and staffed for firms with a commercial department. Mastor sits in that gap.
- **Never invents numbers.** Unmeasured quantities show as "not measured", lines without a rate as "unpriced" (never £0), a missing PO stays blank and flagged. Rates come from the contractor's own imported schedule, exactly as printed.
- **Site capture runs the valuation.** The original idea: capture on site as it happens (photos, video, voice) and Mastor picks out what's done, what's extra and what happened — read against the scope, approved by a person, straight into the valuation.
- **Finds money.** Checks the client's BoQ rates against the framework SoR, and shows margin per job against subbie and labour costs.
- **One way to do each thing.** Simple on purpose; capability is added without alternative paths.

Not now (parked deliberately): formal CVR (accruals, cost codes, period locks, forecast final accounts) — the margin view stays a simple "am I making money on this job", not a finance system. JCT/NRM work led by private QSs and architects — retention, QS-issued interim certificates, payment and pay-less notices. The bridge, when the SoR corner is won, is importing a priced bill with lump sums and provisional sums. RAMS and programmes stay in the contractor's existing documents; Mastor only stores them against the job.

## Operating Context

- Work arrives as framework works orders: a BoQ in Excel or PDF with SoR codes, quantities and rates and two uplift percentages (planned work), or a stream of small orders for one property each (responsive / voids).
- A planned job's pack from the client: a spec list (all properties and workstreams), one works order per contract, the PCI and any surveys. **The works order is the source of truth** — it comes direct from the client and carries the contract value; the spec list is the cross-check.
- The framework SoR (e.g. M3NHF v8 Planned and Responsive, plus client additional rates) is imported once into the company's rate books.
- Variations are found on site, priced from the SoR, then sent for instruction. The client issues its own VO reference (scan, photo, handwritten ticket). VOs move Identified → Instructed → Complete or Rejected. Dayworks are priced from the SoR labour rates.
- Valuations are numbered per job; one Open at a time; Issued ones are locked; each can have one VAT invoice. Terms run from the invoice date; part payments are tracked. Invoices export to Xero or QuickBooks.
- Site use: phone outdoors, intermittent signal, short sessions. Office use: desktop, long sessions, close checking.

## Capabilities and Constraints

- React 18 + Vite + TypeScript. Supabase for auth, sync and team functions, Row Level Security per company. IndexedDB on device; works offline once signed in and syncs later. Vercel deploys from `main`; previews per branch. Serverless AI readers in `api/parse-boq.js`, `api/parse-vo.js` and `api/read-pack.js` (PCI and surveys: every item quotes its document and the quote is checked on the device) and `api/read-site.js` (site captures: Gemini transcribes voice and video, Claude reads them against the scope; suggestions only, approved in Vals), gated to signed-in members with a daily limit per company. Mastor is also a Claude connector (`/api/mcp`, built from `server/mcp/` by `npm run build:mcp`): Claude signs in as the person through Supabase Auth's OAuth server (consent at `/oauth/consent`) and reads and writes with their own rights, so Row Level Security and the operative rule apply. Its figures and rules come from the same `src/lib` code as the screens. Its changes (`server/mcp/writes.ts`) are saved as the phones' sync saves them and marked `byClaude`; the app shows “by Claude” until a person saves the record. Issuing valuations and creating invoices are never done through it. The same tools run inside the app as Clerk, the assistant tab (`/api/agent`, built from `server/agent/` by the same command): Claude Opus 5.5 reads with the person's own sign-in and stops at every change, which the phone shows as a card that runs only when the person taps Do it. Each question counts once against the company's daily AI limit. To price a VO, Clerk looks the work up with `find_rate` (`server/mcp/rates.ts`): the job's own schedule of rates (rate books synced from the app) and the same work already priced on the company's jobs, and it shows where the rate came from (kept as the VO's `rateBook`). It never makes up a rate: no match means the VO is logged unpriced. The job's documents (Documents on the job home: the client's purchase order and pack, the programme, RAMS, certificates, drawings) are its source of truth: Clerk reads them with `read_document` (`server/mcp/docs.ts`) and quotes them by name and page. A PDF with a text layer is read as text, line by line; a scan goes to Claude as the PDF itself; Word, Excel and photos are read too. Purchase orders carry money, so operatives neither see nor read them. If the app's figures differ from a document (the PO number or value, the uplifts), Clerk says so and changes nothing unless asked. Filing a purchase order offers "Check with Clerk": Clerk reads the order, compares the PO number, the PO value (the order's total net, excluding VAT) and the uplifts in the order they compound with the job, and offers `update_job` with the figures as printed; afterwards it runs the app's own BoQ-to-PO check. Job changes by Claude are marked `byClaude` until a person saves the job.
- Front page at `/` (index.html → `src/landing/`), for firms that haven't joined. It leads with fifty numbered founding places (free through the pilot, then half price for as long as they stay; no price shown until one is set). Sign-ups go through `api/early-signup.js` to the `claim_founding_place` function (supabase/schema.sql v7), which hands out places one at a time and is counted live; the owner is emailed via Resend when `RESEND_API_KEY` and `SIGNUP_NOTIFY_TO` are set. The app lives at `/app` (app.html → `src/main.tsx`); the installed app, anyone signed in on the browser and sign-in links from emails skip the front page (`/?site` always shows it).
- Screens: Jobs board, Dashboard, Job view (Home, Diary, Scope, VOs, Vals, Costs), Notes, Settings, Team, Schedule of rates, BoQ import, VO import, Dayworks, sign-in gate.
- Business rules: VO numbers per job (highest + 1), never reused. Invoice numbers never reused; the sequence can continue the company's existing one. Valuations and VOs in Roman numerals (VAL III, VO XII). Rate books are imported whole and never edited.
- Terminology: SoR / schedule of rates, rate book, works order, BoQ, VO, dayworks, PO, uplift, valuation (VAL), application, PPR, WHQS, responsive, void, workstream, property, margin.
- Undecided: pricing (pilots first), card billing.

## Brand Commitments

- Name: **Mastor**. Wordmark **MΛSTΘR**: Cinzel Roman capitals, a hand-drawn Λ and a Θ whose bar reads as a spirit level (`src/components/Wordmark.tsx`). Everything else uses Archivo (variable: expanded for headings and figures, normal width for reading).
- App icon: a Roman masonry arch, copper on charcoal (`public/icon.svg`).
- Classical thread: Roman numerals for valuations and VOs; opening titles with the arch and keystone, played once on first open.
- Visual language: white and black with neon (see DESIGN.md) — black and white carry the structure, neon the one live thing on a screen, and red / yellow / green only warning, to-do and done.
- Voice: plain, direct builder's English (en-GB). Never overstates.

## Evidence on Hand

- Real fixtures: 51 Precelly Place VO 5 and BoQ (`tests/prescelly.tsv`), College Park BoQ (`tests/cap00290.tsv`).
- The PCC 2025–2029 framework schedules (M3NHF v8 Planned, Responsive, Scaffolding, Appendix I additional rates) were used to build and verify the rates importer; they are licensed and not stored in the repository.
- **Not on hand:** customer testimonials, outside users, usage metrics, pricing or press. These must not be fabricated.

## Product Principles

1. **Truth over tidiness.** Show unknowns as unknown. An honest blank beats a plausible number.
2. **Every figure traces to its source.** A client QS can follow any line back to the SoR, the BoQ, the VO or the instruction.
3. **Find the money.** Underpaid rates, unclaimed variations, unpriced dayworks and thin margins are surfaced, not buried.
4. **One way to do each thing.** Add capability without adding alternative paths.
5. **Site-proof.** Works on a phone, outdoors, with no signal, for someone who hasn't been trained.
6. **The outputs are the product.** The PDFs the client receives deserve as much care as the screens.

## Accessibility & Inclusion

Outdoor phone use calls for legible contrast in bright light, large touch targets that work with gloves, and respect for reduced motion. WCAG 2.2 AA is the working assumption.
