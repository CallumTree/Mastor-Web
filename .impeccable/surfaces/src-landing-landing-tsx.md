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
Recorded adaptation: on phones (under 560px) the register's numerals are one size, 13px at 100% width, so the longest (XXXVIII) keeps 6px clear inside a fifth of a phone's width; the board goes four a row under 390px and three at 300px and under. From 560px they are the Roman Ref cut at 112%, each shrinking to its tile (Fit to the Box). This extends the Narrow Label Rule to the register's numerals, which on a phone behave as labels for places rather than as references.
The optional "your work" question is a single select inside the fields grid, before the claim button.

## Revision (26 Oct 2026): the full product page around the sign-up
Requested by the owner: a page that says what Mastor does and who it is for, with screenshots and a screen recording of the real app, a time-saving forecast, the feature that sets it apart, and real photographs, with a "run the business from the field, not a desk" feel, in the app's own design.
Answers: forecast uses our proposed estimates, every one shown and editable, labelled as estimates (the owner checks them before launch); photos are Unsplash stock for now (real, credited, hotlinked as Unsplash asks), to be swapped for the firm's own; one recording, site capture to valuation.
THESIS (revised): Run the job from site. The page proves it with the real app on a phone over a real site photograph, then the recording of a voice note turning into valuation lines and a VO. The founding register stays as the close: fifty numbered places, the next one lit.
FIRST VIEWPORT (revised): Wordmark bar with section links and Sign in. Left: headline "Run the job from site, not from a desk.", lede, the one-line offer, the black next-place strip, and the form whose button names the next numeral. Right (below on a phone): a site photograph, 4:5, with the app's job screen in a black phone frame over its lower edge, captioned as an example job.
STORY (revised): a director sees it's for firms like theirs, watches the site diary turn into the valuation, sees the app's screens, works out their own hours back, sees it never invents a number, and claims a numbered place.
Sections: hero · who it's for (photo + ruled facts) · the main feature on a black slab (I–III steps + recording in a phone) · screenshots (four phones, desktop dashboard) · photo band (no signal) · a job start to finish (I–VI) + Claude line · time back (black summary, neon figure; ruled table of editable estimates) · never makes a number up · fifty founding places (terms + register board) · origin · footer with photo credits.
Assets: public/landing/app-*.webp are captures of the real app with a seeded example job (names and figures made up, labelled as an example); site-to-valuation.mp4/.webm is a recording of the same, with /api/read-site answered by a fixed example response; photos are Unsplash (credited in the footer).
