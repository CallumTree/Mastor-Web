---
name: Mastor
description: Job money for small UK builders, told in the site-sign language everyone on site already reads.
colors:
  ink: "#121316"
  ink-2: "#33373D"
  ink-muted: "#565B63"
  ground: "#E9ECEE"
  panel: "#FFFFFF"
  line: "#C9CED3"
  field-line: "#7C828A"
  row-open: "#F3F5F6"
  flag-row: "rgba(255, 205, 0, 0.16)"
  shell: "#121316"
  shell-2: "#1D2024"
  shell-line: "#33373D"
  shell-muted: "#B4B9C0"
  shell-shadow: "rgba(18, 19, 22, 0.6)"
  sign-yellow: "#FFCD00"
  sign-red: "#C1121F"
  red-on-dark: "#FF9B9B"
  sign-green: "#0B7A3E"
  sign-blue: "#0A55B5"
  sign-blue-press: "#08458F"
  disabled: "#D9DDE1"
  arch-copper: "#C97B3F"
typography:
  display:
    fontFamily: "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(22px, 6.4vw, 30px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "'Barlow Condensed', Barlow, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.01em"
  figure-xl:
    fontFamily: "'Barlow Condensed', Barlow, system-ui, sans-serif"
    fontSize: "clamp(34px, 11vw, 48px)"
    fontWeight: 700
    lineHeight: 1.05
    fontFeature: "tnum"
  figure:
    fontFamily: "'Barlow Condensed', Barlow, system-ui, sans-serif"
    fontSize: "clamp(22px, 7vw, 32px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  figure-sm:
    fontFamily: "'Barlow Condensed', Barlow, system-ui, sans-serif"
    fontSize: "clamp(19px, 5.6vw, 24px)"
    fontWeight: 700
    lineHeight: 1.05
    fontFeature: "tnum"
  row-title:
    fontFamily: "'Barlow Condensed', Barlow, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.02em"
  amount:
    fontFamily: "'Barlow Condensed', Barlow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "tnum"
  title:
    fontFamily: "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  ui:
    fontFamily: "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  section:
    fontFamily: "'Barlow Condensed', Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  label:
    fontFamily: "'Barlow Condensed', Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  plate:
    fontFamily: "'Barlow Condensed', Barlow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.03em"
  note:
    fontFamily: "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  small:
    fontFamily: "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  code:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "tnum"
  wordmark:
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif"
    fontSize: "clamp(26px, 9vw, 40px)"
    fontWeight: 600
    letterSpacing: "0.28em"
rounded:
  sm: "3px"
  md: "4px"
  lg: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  desktop-gutter: "48px"
components:
  button-primary:
    backgroundColor: "{colors.sign-blue}"
    textColor: "{colors.panel}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.sign-blue-press}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "52px"
  button-secondary-hover:
    backgroundColor: "{colors.row-open}"
  button-ghost:
    textColor: "{colors.ink-2}"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.sign-red}"
    textColor: "{colors.panel}"
    rounded: "{rounded.md}"
    height: "52px"
  button-disabled:
    backgroundColor: "{colors.disabled}"
    textColor: "{colors.ink-2}"
  plate-stop:
    backgroundColor: "{colors.sign-red}"
    textColor: "{colors.panel}"
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "4px 9px 3px 6px"
  plate-warn:
    backgroundColor: "{colors.sign-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "4px 9px 3px 6px"
  plate-ok:
    backgroundColor: "{colors.sign-green}"
    textColor: "{colors.panel}"
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "4px 9px 3px 6px"
  plate-do:
    backgroundColor: "{colors.sign-blue}"
    textColor: "{colors.panel}"
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "4px 9px 3px 9px"
  plate-wait:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "4px 9px 3px 9px"
  action-plate:
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "14px"
    height: "64px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px"
    height: "48px"
  chip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.panel}"
  job-bar:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.panel}"
    typography: "{typography.display}"
    padding: "14px 16px 18px"
  nav-bar:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-muted}"
    typography: "{typography.label}"
    height: "68px"
  nav-capture:
    backgroundColor: "{colors.sign-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    size: "56px"
    height: "52px"
  summary-cell-hot:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.panel}"
    padding: "11px 12px 12px"
---

# Design System: Mastor

## Overview

**Creative North Star: "Every Status Is a Site Sign"**

Mastor speaks the UK safety-sign language that everyone on a building site already reads without training. Yellow means it needs doing, red means it is overdue or missing, green means it is done, and blue means the one thing to do next. A site manager squinting at a phone in glare, wearing gloves, should know what is wrong, what is owed and what to do next before reading a sentence. The world is flat and hard-edged: black shell bars, a cool concrete ground, white work panels, and solid colour plates set in condensed highway-sign capitals.

Density is working density, not airy marketing density. Figures are big and condensed, rows are ruled with hairlines, and every tap target is at least 44px (most are 48 to 64px). Nothing is decorative: no texture, no gradients, no glow, no drop shadows. Depth comes from the contrast between black bars and the white panels on concrete.

It has to work where there is no signal. Mastor installs as a PWA, and its service worker precaches the app shell, the fonts and PDF-making (certificates, dayworks sheets, evidence packs), so a phone opens it and issues paperwork offline. The document readers (PDF, Excel, Word) are only needed to import a BoQ, rate book or pack, so they stay out of an operative's first install and are cached the first time they are used. A new version waits for the user to reload, never mid-form.

Three things carry over from Mastor's earlier classical world at the user's request and live only where named: the MΛSTΘR wordmark in Cinzel, the copper Roman arch on the opening titles, and Roman numerals for valuation and VO references (VAL III, VO XII). Paper, grid backgrounds, beige, serif capitals elsewhere, and the photographic house header are retired.

**Key Characteristics:**
- Black shell bars (job bar, cover head, bottom nav or desktop rail) over concrete ground with white panels.
- Status told by solid ISO-style sign plates, by shape as well as colour, with a spoken word for screen readers.
- One blue next-step plate per record; blue buttons for the primary action only.
- Barlow for reading, Barlow Condensed capitals for labels, figures and plates; JetBrains Mono only for codes and refs; Cinzel only in the wordmark.
- Square-ish corners (3 to 6px), 2px ink outlines on secondary controls, no shadows.
- Light only, by decision: no dark theme, and the page declares `color-scheme: only light` so a phone's automatic dark mode doesn't invert the signs.

## Colors

Four safety colours on a neutral black, concrete and white world; colour is reserved for meaning.

### Primary
- **Next-Step Blue** (sign-blue): the colour of acting. Primary buttons, the next-step plate on a record, text links and the keyboard focus ring. It presses to **Pressed Blue** (sign-blue-press). Never a status, never a data fill.

### Secondary
- **Sign Yellow** (sign-yellow): needs doing. Warn plates and action plates, the "+ N not priced" figure note, the yellow capture key, the active-tab bar in the nav, the open-property number tile, the sheet's unsaved-changes ask bar, "in a valuation" chart fills, text selection. Always carries ink text.
- **Stop Red** (sign-red): overdue, missing, blocking. Stop plates and action plates, danger buttons, the dashboard alert figure, the discard bar.
- **Red on Black** (red-on-dark): Stop Red lifted for text on the black shell, where Stop Red itself is only 3:1. It holds 9.2:1 on Shell Black and 8.1:1 on Shell Raised. Used for the sync-problem line in the bars; never a plate or a fill.
- **Done Green** (sign-green): done and certified. OK plates, the Active badge, ticked boxes, progress bars, certified chart fills, the "all clear" plate.

### Tertiary
- **Arch Copper** (arch-copper): the opening-titles arch and keystone only. It appears nowhere in the working app.

### Neutral
- **Site Ink** (ink): body text, 2px control outlines, register header rules, the selected chip.
- **Slate Ink** (ink-2): secondary text, ghost buttons, locked tick boxes.
- **Muted Ink** (ink-muted): labels, metadata, hints, nil figures.
- **Concrete** (ground): the page ground and inset progress tracks.
- **Panel White** (panel): work panels, sheets, secondary buttons, inputs.
- **Hairline** (line): 1px panel borders, row rules and dividers. Dividers only: at 1.6:1 on white it is too faint to be the edge of a control.
- **Field Line** (field-line): the 2px idle border of inputs, selects and textareas. It holds 3.9:1 on Panel White and 3.3:1 on Concrete, so a field's edge clears the 3:1 non-text contrast of WCAG 1.4.11 in glare.
- **Open Row** (row-open): hover and expanded-row tint.
- **Flag Row** (flag-row): a 16% wash of Sign Yellow behind a row that needs checking (a BoQ line the reader was unsure of, a pack fact not yet verified). It is the yellow sign spread thin across a row, so it still means needs doing.
- **Shell Black** (shell), **Shell Raised** (shell-2), **Shell Rule** (shell-line), **Shell Muted** (shell-muted): the black bars, the offline/sync banner, rules inside bars, and secondary text on black.
- **Disabled Grey** (disabled): disabled buttons, with slate text.

### Named Rules
**The Sign Meaning Rule.** Yellow is needs doing, red is overdue or missing, green is done, blue is the next step. A colour never appears for any other reason; if it isn't a status or an action, it is ink, white or concrete.

**The Yellow Is a Plate Rule.** Yellow is a surface, never a text colour. "Needs doing" as text is ink beside a yellow sign.

**The One Blue Rule.** Each record carries at most one blue next-step plate, and each view region one blue primary button. Everything else is an ink outline.

**The Light Board Rule.** Mastor is light only, and that is a decision, not an omission. Site signs are dark ink on bright boards because that is what reads in glare; a dark theme would wash out on a phone in sunlight. The black shell bars are the only dark surfaces, and there is no dark-mode palette to keep in step.

## Typography

**Display Font:** Barlow (with system-ui, Segoe UI)
**Label Font:** Barlow Condensed (with Barlow)
**Mono Font:** JetBrains Mono (self-hosted, 400 and 500), codes and references only
**Wordmark Font:** Cinzel 600, the MΛSTΘR wordmark only

**Character:** a highway-sign grotesk family. Barlow reads plainly at sentence length; its condensed cut gives the capitals and big figures the look of painted site boards.

### Hierarchy
- **Display** (Barlow 700, clamp(22px, 6.4vw, 30px), 1.08): the job name in the black job bar. Drops to clamp(19px, 5.4vw, 24px) when the bar is compact on inner tabs: Figure SM's 19 to 24px range on a slightly shallower slope. Under 300px wide it is a fixed 18px on its own line, so whole words fit.
- **Headline** (Barlow Condensed 700, 28px, 1.05, uppercase): tab titles (VARIATIONS, VALUATIONS).
- **Figure XL** (Barlow Condensed 700, clamp(34px, 11vw, 48px), 1.05, tabular): the dashboard head figure, in yellow on black. The board's other cells sit at 26px.
- **Figure** (Barlow Condensed 700, clamp(22px, 7vw, 32px), 1, tabular): the three job-home figures.
- **Figure SM** (Barlow Condensed 700, clamp(19px, 5.6vw, 24px), 1.05, tabular): summary-cell figures. Roman refs in the VO and valuation registers sit at its 19px floor.
- **Row Title** (Barlow Condensed 700, 20px, 1.1, 0.02em): property names and number tiles, the job value in the jobs list. Job names in that list share the size in Barlow 700.
- **Amount** (Barlow Condensed 700, 18px, 1.1, tabular): the right-hand amount on register, property, rate and dashboard rows, and the dayworks total line. The cover's empty-jobs message uses the same size in Barlow.
- **Title** (Barlow 700, 16px, 1.25): action-plate headings, VO descriptions, button text.
- **Body** (Barlow 400, 16px, 1.4): everything else, and every input.
- **UI** (Barlow 600, 15px, 1.3): chips, rate and check-list descriptions, the job bar's client line, the sheet ask bar and update bar. Running text at this size (a rate's notes, the share message, dayworks lines) drops to 400.
- **Section** (Barlow Condensed 700, 15px, 0.06em, uppercase, ink): section headings, the first label in a sheet, the opening-titles sub-line.
- **Label** (Barlow Condensed 700, 13px, 0.06em, uppercase): figure and summary labels, register column heads, nav labels.
- **Plate** (Barlow Condensed 700, 14px, 0.03em, uppercase): sign plates; badges sit at 13px, 0.05em.
- **Note** (Barlow 400, 14px, 1.4): a note beside a control, row metadata (`.t-note`).
- **Small** (Barlow 400, 13px, 1.35): hints, captions and secondary metadata; the floor (`.t-small`, or `.hint` when it is also Muted Ink).
- **Code** (JetBrains Mono 400/500, 13px, tabular): contract refs, SoR codes, council refs.
- **Wordmark** (Cinzel 600, clamp(26px, 9vw, 40px), 0.28em): MΛSTΘR, with its drawn Λ and spirit-level Θ. The opening titles set it at a fixed 34px.

### Named Rules
**The Three Voices Rule.** Barlow reads, Barlow Condensed signs, Mono codes. Cinzel exists only inside the wordmark and the opening titles.

**The Roman Ref Rule.** VO and valuation references are Roman numerals set in Barlow Condensed 700 (VO XII, VAL III), never in Mono and never in Cinzel.

**The Condensed Money Rule.** Money amounts are Barlow Condensed with tabular figures, even where the markup says mono.

**The 13px Floor Rule.** No text on screen is smaller than 13px; it is read outdoors, in glare, at arm's length. Small text uses the classes rather than an inline size: `.t-small` (13px), `.hint` (13px in Muted Ink) and `.t-note` (14px). Only a purely decorative glyph hidden from screen readers (a ▸ chevron) may sit below it.

## Layout

Mobile first, one column. Pages are capped at 720px with 16px side padding and clear the fixed 68px bottom nav. The black job bar bleeds edge to edge above the column. Panels stack 12px apart, inline groups use 8px gaps, and rows pad at 14px. Section headings sit 22px above and 10px below.

Summary strips are ruled grids, two columns on a phone, three or four from 560px. Job-home figures are a three-up ruled strip. Registers (VOs, valuations) are 64px ref / description / right-aligned amount grids under a 2px ink header rule.

At 1024px and up, the bottom nav becomes a 104px black left rail with the yellow capture key at the top. Content moves to a 960px column with 48px gutters, sheets become centred 640px dialogs, the dashboard splits into two columns, and the jobs list becomes a ruled five-column schedule. Under 360px padding tightens. Under 300px (a phone at about 200% zoom) the layout reflows rather than scrolling sideways: grids collapse to one column, paired buttons stack, the cover-head wordmark takes a row of its own above its buttons (at 22px, tracking eased to 0.16em), and the bottom nav wraps into rows of three 60px keys (3 + 3, or 3 + 2 for an operative, who has no Vals tab), icons only, with the labels kept for screen readers. The job bar puts back and setup on one row and the job name full width beneath. Property and workstream rows keep the name beside the tile and drop the amount to its own line; the dashboard board and its job amounts go one per line; the diary date takes its own line above its buttons, the labour stepper drops under its label, and photos sit two across; paired settings fields stack.

The page keeps scroll padding the height of the bottom nav, so a control that takes keyboard focus near the bottom scrolls clear of the bar instead of sitting under it (the desktop rail needs none).

## Elevation & Depth

Flat. There are no drop shadows on the board. Depth is told by tone: black shell bars sit above concrete ground, white panels sit on concrete with a 1px hairline, and an expanded row tints to Open Row. The only overlay is the sheet scrim, ink at 60%. A 1.5px inset ink line draws the outline of the neutral "wait" plate and slate badge, and a white ring outside a dark gap marks the chosen colour in photo mark-up; both are strokes, not elevation. The one true shadow lives on media, not the board: the white play glyph on a video thumbnail carries a soft Shell Black text shadow at 60% (shell-shadow) so it reads on a bright frame.

### Named Rules
**The Flat Board Rule.** Nothing floats. If something needs to stand out, it gets a sign colour or a black bar, not a shadow.

## Shapes

Square-ish corners throughout: 3px on plates, badges, tick boxes and thumbnails; 4px on buttons, inputs, chips, icon buttons and action plates; 6px on panels, strips, sheets and the dashboard board. Secondary controls are drawn with a 2px ink outline; panels with a 1px hairline. Progress bars are flat 6px tracks (4px on black).

Status shapes follow safety signs: **stop** is a red circle with a white bar, **warn** a yellow triangle with a black exclamation, **do** a blue circle with a white arrow, **ok** a green square with a white tick. These are inline SVG marks at 14px in plates and 22px in action plates.

## Components

### Buttons
Full-width blocks on a phone, confident and blunt.
- **Shape:** gently squared (4px), 52px tall, 0 18px padding, 2px border, Barlow 700 16px, optional 20px SVG icon.
- **Primary:** Next-Step Blue with white text; presses to Pressed Blue. Only the main action in a view.
- **Secondary:** white with a 2px ink outline; hover tints to Open Row.
- **Ghost:** no fill, slate underlined text, 44px tall, auto width. On a black bar it takes Shell Muted text; a bare ghost button that is disabled drops to 50%.
- **Danger:** Stop Red with white text.
- **Disabled:** Disabled Grey with slate text.
- **Press / Focus:** press nudges down 1px (off under reduced motion); focus is a 3px blue outline offset 2px, yellow on black bars.
- **Icon buttons:** 44px squares with a 2px ink outline; on black bars the outline is Shell Rule and turns white on hover.
- **File pickers:** a button or link label (`label.btn` in primary, secondary or ghost, or `label.linkish.tap` for an inline "add") wrapped around its `input type=file`, with the pointer cursor. The input is visually hidden with `.sr-only`, never `hidden`, so it stays in the tab order; when it has keyboard focus the 3px blue ring draws on the label. A tap anywhere on the label opens the picker (or the camera, where it captures).

### Sign Plates
The signature component. A solid plate of sign colour, condensed capitals, 3px corners, a sign mark on the left.
- **Stop / Warn / OK:** red, yellow (ink text), green, each led by its 14px shape mark.
- **Do (next step):** blue with white text and a leading arrow, naming the one thing we do next ("Price it", "Chase the client").
- **Wait:** white with a 1.5px ink outline, for things waiting on the client ("With client · Awaiting instruction · 4 days").
- A record that is overdue with the client shows the red plate followed by the blue "Chase the client" plate.
- **Badges** are the same plate at 13px for record states (INSTRUCTED, IDENTIFIED, REJECTED, Active).

### Action Plates
Full-width tappable signs on job home under "Action needed · N", red first then yellow, then green for a valuation ready to issue. 64px minimum, 14px padding, 4px apart, 22px sign mark, Barlow 700 16px heading with a 14px hint, ending in a chevron. Hover darkens slightly. When nothing is outstanding, a single green "all clear" plate.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** Panel White on Concrete.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Hairline; register and schedule heads use a 2px ink rule.
- **Internal Padding:** 16px; list panels drop padding and rule their rows instead.

### Figures and Summary Strips
White ruled strips of condensed figures over condensed labels. A cell that carries the headline total turns Shell Black with white figures ("hot"). Honest unknowns stay visible: an em dash, the word "Unpriced", or a yellow "+ N not priced" note under the figure.

### Inputs / Fields
- **Style:** white, 2px Field Line border (Hairline is for dividers only), 4px corners, 48px tall, 12px padding, 16px text; label above in Barlow 600 14px slate, hint below at 13px in Muted Ink.
- **Focus:** border turns ink plus the 3px blue focus outline.
- **Warn:** ink border and a bold ink hint led by the yellow triangle mark.
- **Disabled:** concrete fill with a dashed border.
- **Choice cards** (team role, kind of work, cost status): a radio inside a 52px card with the same 2px Field Line edge; the chosen card turns its edge ink on an Open Row fill.

### Chips
44px, 2px ink outline, white, Barlow 600 15px; selected fills ink with white text. Used for mode and filter choices.

### Tick Rows
Tick-to-include lists (BoQ review, pack facts, VO import lines, rate-book drafts, the note pin) make the whole row the target: a `label.check-row` with its checkbox as the first child. 48px minimum, 12px padding and gap, a 22px checkbox in Next-Step Blue, and a Hairline between consecutive rows. A row left out (`.off`) drops to 50% opacity but stays readable; a row that needs checking (`.flagged`) takes the Flag Row wash.

### Navigation
- **Job bar:** Shell Black, full bleed; back and setup icon buttons either side of the mono ref (Shell Muted), the job name in Display, and client · address beneath in Shell Muted.
- **Bottom nav:** 68px Shell Black bar with 24px icons over condensed uppercase labels in Shell Muted; the active tab turns white with a 4px yellow bar on top. The centre capture key is a 56 by 52px yellow plate with an ink plus. On desktop it becomes the left rail, with the yellow bar on the left edge. When it wraps to two rows under 300px, the active key is raised to Shell Raised and a second-row key carries its bar on its own bottom edge, so the bar never sits on the seam under the key above.
- **Cover head:** Shell Black with the white wordmark centred, a condensed tracked sub-line in Shell Muted, and the sync state beneath.
- **Banner:** Shell Raised strip for offline and sync messages.

### Sheets
Bottom sheets on a phone (6px top corners, rising from the edge in 0.26s), centred dialogs on desktop. A 44px outlined close square. Unsaved changes raise a sticky yellow ask bar; discard is red.

### Dashboard Board
A Shell Black block with condensed labels in Shell Muted, the headline figure in yellow, and cells ruled in Shell Rule. A red plate marks an alert figure. Bars below are flat: green certified, yellow in valuation, ink outline still to claim.

### Photo Mark-up
A full-screen Shell Black layer over the photo. Cancel and Undo are ghost buttons in Shell Muted; the title is a condensed tracked capital. Five 44px colour swatches in the site colours (red, yellow, blue, white, ink) and four 48px outlined tool toggles (arrow, circle, draw, text) both say which one is chosen (`aria-pressed`): the chosen swatch is ringed in white outside a dark gap, so it shows even on the yellow and white swatches, and the chosen tool's outline turns yellow. Text drawn on the photo gets an ink halo, or a white one when the text itself is ink.

### Opening Titles
Shell Black. The copper arch draws itself, the keystone drops in, the MΛSTΘR letters rise, and a yellow dimension line grows beneath. Reduced motion skips it.

## Do's and Don'ts

### Do:
- **Do** use a sign colour only for its meaning: yellow needs doing, red overdue or missing, green done, blue the next step or primary action.
- **Do** put ink text on yellow and white text on red, green and blue.
- **Do** pair every status colour with its shape mark (circle-bar, triangle, square-tick, circle-arrow) and a spoken word for screen readers.
- **Do** give each record one blue next-step plate that names the action in plain words.
- **Do** show unknowns honestly: "Unpriced", "not measured", an em dash, or a yellow "+ N not priced" note, never £0.
- **Do** keep tap targets at 44px minimum and primary controls at 48-64px.
- **Do** keep corners between 3px and 6px and outline secondary controls in 2px ink.
- **Do** set money and big figures in Barlow Condensed 700 with tabular figures, and VO/VAL refs as Roman numerals in the same face.

### Don't:
- **Don't** use drop shadows, glows, gradients or texture; the board is flat.
- **Don't** use yellow as a text colour.
- **Don't** use blue for status, decoration or chart fills.
- **Don't** use Cinzel outside the MΛSTΘR wordmark and opening titles, or Mono for anything but codes and references.
- **Don't** use copper anywhere but the opening-titles arch.
- **Don't** bring back paper, grid backgrounds, beige, serif capitals or the photographic house header.
- **Don't** set text below 13px, or size small text inline; use `.t-small`, `.hint` or `.t-note`. This is read outdoors in glare.
- **Don't** draw an input's edge in Hairline; fields use Field Line.
- **Don't** add a dark theme; light only is a decision (see the Light Board Rule).
