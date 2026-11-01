---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: Mastor app (all working screens)

Scope: the whole app, phone and desktop: jobs list and the week, job home, Diary (the job's line), Scope, VOs, Vals, Costs, Clerk, Dashboard, Settings, Team, Rates, imports, sign-in, sheets, photo mark-up. Mode: Operate. Out of scope: the front page (`src/landing`, its own Persuade surface) and the client PDFs (certificates, invoices, registers, evidence packs), which stay print-white.
Audience and job: site manager on a phone outdoors (glare, gloves, no signal) logging work and VOs; QS/director on a laptop valuing, invoicing, chasing. Physical scene, as the user pinned it (Nov 2026): a field instrument used one-handed on a site walk in direct sun, so the ground is void black and every signal is lit, never tinted.
Constraints: PRODUCT.md principles; keep MΛSTΘR (Cinzel, wordmark only), the copper arch icon, Roman numerals for VO/VAL. Mastor's number rules hold: quantities only from what is said or written, rates exactly as printed. Touch targets stay 44px+ (gloves). The user replaced "light only" with this dark world.
Unresolved: whether the front page follows this world (its app screenshots now show the old light look).

## Direction contract
THESIS: The app reads like a field instrument: a void-black ground, charcoal panels and hairline rules carry the structure, white type carries the facts, and colour appears only as a lit signal with one meaning each. Refuses the soft SaaS dashboard (rounded pastel cards, tinted status chips, brand-blue buttons) and the neon "cyber" glow console.
OWN-WORLD: Ground #0B0C0E, panels #14171F, raised rows #1B1F29, structure rules 1px #262C38, control edges #687488. Text #FFFFFF, metadata #7E8B9F. Signals, avionics order: red #FF5247 warning (stop, overdue, refused), amber #FFB703 caution and active (to-do, next step, recording, the one live thing), cyan #00F0FF advisory (variations, discrepancies, by Claude), emerald #10B981 normal (done, approved, contract match). Primary action is a white block with black type; everything else is outlined. Corners 2–4px, no shadows at rest, no tints: a status is a 1px signal-colour frame with signal-colour capitals. Archivo at normal width: headings tight (-0.02em), micro-headers uppercase semi-condensed with brackets [ ]; JetBrains Mono tabular for every figure, code, ref, date number and quantity.
STORY: The visitor reads the job's state from the header's telemetry line and the figure grid at a glance, acts on the one bracketed next step, and sees colour only where something carries a meaning.
FIRST VIEWPORT: Job home on a phone: void header with the contract ref as a mono telemetry line, the job name in white grotesque, the certified rail along its foot (emerald done, amber dashed open valuation); a ruled figure grid of mono figures with uppercase labels, section heads in brackets; "Action needed" as outlined signal rows, the next step locked inside an amber reticle; the charcoal dock at the foot with a white capture key.
FORM: pinned by the user's brief (tactical industrial / avionics HUD palette, type and geometry), no concept roll (seed key: none). Signature move: the reticle lock: the one live thing on a screen (the next step, the hot figure, the change waiting for Do it) is framed by four amber corner brackets that close in once, like a camera's focus lock, and hold.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
