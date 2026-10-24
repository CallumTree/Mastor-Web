---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: Mastor app (all working screens)

Scope: the whole app, phone and desktop: jobs list, job home, Diary, Scope, VOs, Vals, Dashboard, sign-in, sheets. Mode: Operate.
Audience and job: site manager on a phone outdoors (glare, gloves, no signal) logging work and VOs; QS/director on a laptop valuing, invoicing, chasing. Physical scene: daylight on a scaffold or a bright office, so the ground is white, never dark.
Constraints: PRODUCT.md principles; keep MΛSTΘR wordmark (Cinzel, wordmark only), the copper arch icon, Roman numerals for VO/VAL. User asked (Oct 2026) for "a clean futuristic style SaaS app; keep the warning colours; whites and blacks as the main bold colours, then neon accents; you decide everything in between". The site-signage look (concrete ground, Barlow, blue plates, yellow as decoration) is retired; its warning colours stay as warnings only.
Unresolved: none.

## Direction contract
THESIS: Black and white carry the structure, neon carries the one live thing on each screen (where you are, what's next, the job's progress), and red/yellow/green mean only warning, to-do and done. Refuses the category default of a grey dashboard with a brand-blue button, and the dark neon "cyber" console.
OWN-WORLD: Pure white ground (#FFFFFF), near-black ink and black slabs (#0A0A0B) for the job header, dock, title block and hot figures; hairline panels (#E4E4E7, 14px radius, no shadow at rest). Neon cyan #00E5FF lives on black; its light-ground twin, volt blue #0040FF, is links, focus, selection and the next-step plate. Warning plates keep #FFCD00 / #C1121F / #0B7A3E. Archivo variable: expanded (125% width) capitals for headings, labels and figures; normal width for reading text; JetBrains Mono for codes.
STORY: The visitor reads the job's state in the black header at a glance, acts on the one volt-blue next step, and sees warnings only where something is actually wrong.
FIRST VIEWPORT: Job home on a phone: black job header (back, ref in mono, job name in expanded 800, setup) with the neon progress rail along its foot; white figure grid with expanded figures; "Action needed" plates (red, yellow, green only by meaning); floating black dock at the bottom with a neon capture key.
FORM: the palette and register were pinned by the user; the form and everything in between were the builder's choice, made without a concept roll (seed key: none). Signature move: the neon progress rail, the job's certified-to-date drawn as a neon line along the foot of the black job header on every tab.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
