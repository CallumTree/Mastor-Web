---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: Mastor app (all working screens)

Scope: the whole app, phone and desktop: jobs list and the week, job home, Diary (the job's line), Scope, VOs, Vals, Costs, Clerk, Dashboard, Settings, Team, Rates, imports, sign-in, sheets, photo mark-up. Mode: Operate. Out of scope: the front page (`src/landing`, its own Persuade surface) and the client PDFs (certificates, invoices, registers, evidence packs), which stay print-white.
Audience and job: site manager on a phone outdoors (glare, gloves, no signal) logging work and VOs; QS/director on a laptop valuing, invoicing, chasing. Physical scene: one-handed on a site walk and long sessions at a desk; the user chose (Nov 2026), from three dark directions, the drawing office: a deep ink-navy drafting sheet.
Constraints: PRODUCT.md principles; keep MΛSTΘR (Cinzel, wordmark only), the copper arch icon, Roman numerals for VO/VAL. Mastor's number rules hold: quantities only from what is said or written, rates exactly as printed. Touch targets stay 44px+ (gloves). The user replaced "light only" with a dark world, then picked Blueprint over the field-instrument HUD and a brutalist look. Small text is lifted from the brief's #64748B (3.7:1) to #8291A7 (5.6:1); #64748B stays for control edges.
Unresolved: whether the front page follows this world (its app screenshots now show the old light look).

## Direction contract
THESIS: The app is drawn like a technical drawing: an ink-navy drafting sheet with a faint alignment grid, milled-steel panels, hairlines, every data block drawn twice like a title block, and two signals only: cyan for the selection, gold for what needs you. Refuses the soft SaaS dashboard (rounded pastel cards, tinted chips, brand-blue buttons) and the neon "cyber" glow console.
OWN-WORLD: Ground #0A0F1D with a 24px grid at rgba(56,189,248,.055); panels #101827, raised #16213A; hairlines 1px #1E293B; control edges #64748B. Text #F8FAFC, notes #8291A7. Cyan #38BDF8: the next step and its corner marks, the open valuation, variations, by Claude, progress, ticks, today. Gold #F59E0B: overdue, to-do, caution, recording, destructive. Done is drafting white. Primary action a white block; everything else outlined. Corners 0–2px; a 1px bounding box 3px outside each data block; no shadows. Archivo normal width, tight headings; uppercase micro-labels at .08em; section heads cyan over a hairline; JetBrains Mono tabular for every figure, code, ref and quantity.
STORY: The visitor reads the job's state from the header and the boxed figure grid at a glance, acts on the one selected next step, and finds gold only where something needs them.
FIRST VIEWPORT: Job home on a phone: the header on ink navy with the contract ref as a mono line, the job name in white, the certified rail along its foot (white done, cyan dashed open valuation); the boxed figure grid of mono figures with uppercase labels; ACTION NEEDED as a cyan title line; outlined rows led by their sign marks, overdue framed gold, the next step marked at its corners in cyan; the steel dock with a white capture key and a cyan bar on the current tab; the drafting grid faint behind it all.
FORM: pinned by the user's brief (Technical Architectural Blueprint palette and geometry), chosen on 2 Nov 2026 from three rendered alternatives; no concept roll (seed key: none). Signature move: the selection: the one live thing on a screen is marked by four cyan corner marks that close in once and hold, the way a drawing program marks what's selected; with the drafting grid as the ground.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
