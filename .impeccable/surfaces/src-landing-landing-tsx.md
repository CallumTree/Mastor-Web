---
version: 1
slug: "src-landing-landing-tsx"
primary_target: "src/landing/Landing.tsx"
related_targets: ["index.html","src/landing/landing.css"]
---

# Landing page (front of the site)

Scope: the public front page at `/` (index.html → src/landing/). Mode: **Persuade**. The app moves to /app; signed-in people and the installed app skip this page.

Audience: directors of small UK contractors on council / housing-association schedule-of-rates frameworks (PPR, WHQS / Decent Homes, responsive, voids), 2–30 people, money run in Excel. Arrive on a phone as often as a desktop.
Action: claim one of 50 founding places (name, firm, email, optional phone, the work they do). Offer: free through the pilot, then half price for as long as they stay. No price shown; pricing not set.
Proof on hand: the product itself (what it really does), the founding story (built inside a working contractor's office). No testimonials, users, metrics or press exist; none are invented.
Constraints: DESIGN.md world unchanged (white board, black slabs, neon on black / volt on white, warning colours by meaning only, Archivo at three widths, Cinzel only in the wordmark). Count of places is live from the database, never faked.

## Direction contract
THESIS: The offer is a register: fifty numbered founding places, I to L, on a black board, and the visitor claims the next numeral. It refuses the SaaS waitlist (headline, email box, logo row, three feature cards).
OWN-WORLD: White ground; one black register board (24px corners) of fifty Roman-numeral tiles; taken tiles raised Shell, free tiles outlined Shell Rule, the next free tile solid neon with an ink numeral. Archivo 125% capitals for heads, 112% for numerals, ink outline buttons, volt links.
STORY: A director sees the job's money in one place is possible, sees how few places there are, understands the terms in one line, and claims a numbered place without leaving the first screen.
FIRST VIEWPORT: Wordmark bar with Sign in. Headline and one-line offer, then the form whose button names the next numeral ("Claim place XIV"). The board sits beside the form on desktop and under it on a phone, with the next tile lit.
FORM: Founding 50 register; dealt lead (index 4 of 7); seed key 80c624b7.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: on claim, the neon tile becomes the visitor's (white tile, neon ring, "yours"), the next tile lights, and the button and summary update to the next numeral.

Recorded adaptation: taken tiles fill with Shell Rule (#2E2E33), not Shell Raised (#18181B). Raised is about 1.1:1 on the Shell board and would not read as taken; Rule against the outlined free tiles keeps the three states apart. The optional "your work" chips sit after the claim button so the button stays in a phone's first screen.
