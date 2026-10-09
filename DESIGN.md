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
  row-open: "#F3F5F6"
  shell: "#121316"
  shell-2: "#1D2024"
  shell-line: "#33373D"
  shell-muted: "#B4B9C0"
  sign-yellow: "#FFCD00"
  sign-red: "#C1121F"
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
  figure:
    fontFamily: "'Barlow Condensed', Barlow, system-ui, sans-serif"
    fontSize: "clamp(22px, 7vw, 32px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
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

Three things carry over from Mastor's earlier classical world at the user's request and live only where named: the MΛSTΘR wordmark in Cinzel, the copper Roman arch on the opening titles, and Roman numerals for valuation and VO references (VAL III, VO XII). Paper, grid backgrounds, beige, serif capitals elsewhere, and the photographic house header are retired.

**Key Characteristics:**
- Black shell bars (job bar, cover head, bottom nav or desktop rail) over concrete ground with white panels.
- Status told by solid ISO-style sign plates, by shape as well as colour, with a spoken word for screen readers.
- One blue next-step plate per record; blue buttons for the primary action only.
- Barlow for reading, Barlow Condensed capitals for labels, figures and plates; JetBrains Mono only for codes and refs; Cinzel only in the wordmark.
- Square-ish corners (3 to 6px), 2px ink outlines on secondary controls, no shadows.

## Colors

Four safety colours on a neutral black, concrete and white world; colour is reserved for meaning.

### Primary
- **Next-Step Blue** (sign-blue): the colour of acting. Primary buttons, the next-step plate on a record, text links and the keyboard focus ring. It presses to **Pressed Blue** (sign-blue-press). Never a status, never a data fill.

### Secondary
- **Sign Yellow** (sign-yellow): needs doing. Warn plates and action plates, the "+ N not priced" figure note, the yellow capture key, the active-tab bar in the nav, the open-property number tile, the sheet's unsaved-changes ask bar, "in a valuation" chart fills, text selection. Always carries ink text.
- **Stop Red** (sign-red): overdue, missing, blocking. Stop plates and action plates, danger buttons, the dashboard alert figure, the discard bar.
- **Done Green** (sign-green): done and certified. OK plates, the Active badge, ticked boxes, progress bars, certified chart fills, the "all clear" plate.

### Tertiary
- **Arch Copper** (arch-copper): the opening-titles arch and keystone only. It appears nowhere in the working app.

### Neutral
- **Site Ink** (ink): body text, 2px control outlines, register header rules, the selected chip.
- **Slate Ink** (ink-2): secondary text, ghost buttons, locked tick boxes.
- **Muted Ink** (ink-muted): labels, metadata, hints, nil figures.
- **Concrete** (ground): the page ground and inset progress tracks.
- **Panel White** (panel): work panels, sheets, secondary buttons, inputs.
- **Hairline** (line): 1px panel borders and row rules, the idle input border.
- **Open Row** (row-open): hover and expanded-row tint.
- **Shell Black** (shell), **Shell Raised** (shell-2), **Shell Rule** (shell-line), **Shell Muted** (shell-muted): the black bars, the offline/sync banner, rules inside bars, and secondary text on black.
- **Disabled Grey** (disabled): disabled buttons, with slate text.

### Named Rules
**The Sign Meaning Rule.** Yellow is needs doing, red is overdue or missing, green is done, blue is the next step. A colour never appears for any other reason; if it isn't a status or an action, it is ink, white or concrete.

**The Yellow Is a Plate Rule.** Yellow is a surface, never a text colour. "Needs doing" as text is ink beside a yellow sign.

**The One Blue Rule.** Each record carries at most one blue next-step plate, and each view region one blue primary button. Everything else is an ink outline.

## Typography

**Display Font:** Barlow (with system-ui, Segoe UI)
**Label Font:** Barlow Condensed (with Barlow)
**Mono Font:** JetBrains Mono, codes and references only
**Wordmark Font:** Cinzel 600, the MΛSTΘR wordmark only

**Character:** a highway-sign grotesk family. Barlow reads plainly at sentence length; its condensed cut gives the capitals and big figures the look of painted site boards.

### Hierarchy
- **Display** (Barlow 700, clamp(22px, 6.4vw, 30px), 1.08): the job name in the black job bar. Drops to clamp(19px, 5.4vw, 24px) when the bar is compact on inner tabs.
- **Headline** (Barlow Condensed 700, 28px, 1.05, uppercase): tab titles (VARIATIONS, VALUATIONS).
- **Figure** (Barlow Condensed 700, clamp(22px, 7vw, 32px), 1, tabular): the three job-home figures. Summary cells use the same face at clamp(19px, 5.6vw, 24px); the dashboard head figure goes to clamp(34px, 11vw, 48px) in yellow on black.
- **Title** (Barlow 700, 16px, 1.25): action-plate headings, VO descriptions, button text. Job rows use 19px.
- **Body** (Barlow 400, 16px, 1.4): everything else. Hints and metadata at 13-15px; 12px only for tertiary register metadata.
- **Label** (Barlow Condensed 700, 13px, 0.06em, uppercase): figure and summary labels, register column heads, nav labels. Section headings use the same voice at 15px in ink.
- **Plate** (Barlow Condensed 700, 14px, 0.03em, uppercase): sign plates; badges sit at 13px, 0.05em.
- **Code** (JetBrains Mono 400/500, 13px, tabular): contract refs, SoR codes, council refs.
- **Wordmark** (Cinzel 600, clamp(26px, 9vw, 40px), 0.28em): MΛSTΘR, with its drawn Λ and spirit-level Θ.

### Named Rules
**The Three Voices Rule.** Barlow reads, Barlow Condensed signs, Mono codes. Cinzel exists only inside the wordmark and the opening titles.

**The Roman Ref Rule.** VO and valuation references are Roman numerals set in Barlow Condensed 700 (VO XII, VAL III), never in Mono and never in Cinzel.

**The Condensed Money Rule.** Money amounts are Barlow Condensed with tabular figures, even where the markup says mono.

## Layout

Mobile first, one column. Pages are capped at 720px with 16px side padding and clear the fixed 68px bottom nav. The black job bar bleeds edge to edge above the column. Panels stack 12px apart, inline groups use 8px gaps, and rows pad at 14px. Section headings sit 22px above and 10px below.

Summary strips are ruled grids, two columns on a phone, three or four from 560px. Job-home figures are a three-up ruled strip. Registers (VOs, valuations) are 64px ref / description / right-aligned amount grids under a 2px ink header rule.

At 1024px and up, the bottom nav becomes a 104px black left rail with the yellow capture key at the top. Content moves to a 960px column with 48px gutters, sheets become centred 640px dialogs, the dashboard splits into two columns, and the jobs list becomes a ruled five-column schedule. Under 360px padding tightens; under 300px (a phone at 200% zoom) grids collapse to one column, nav labels go screen-reader only, and paired buttons stack.

## Elevation & Depth

Flat. There are no drop shadows anywhere in the system. Depth is told by tone: black shell bars sit above concrete ground, white panels sit on concrete with a 1px hairline, and an expanded row tints to Open Row. The only overlay is the sheet scrim, ink at 60%. A 1.5px inset ink line draws the outline of the neutral "wait" plate and slate badge; it is a stroke, not elevation.

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
- **Ghost:** no fill, slate underlined text, 44px tall, auto width.
- **Danger:** Stop Red with white text.
- **Disabled:** Disabled Grey with slate text.
- **Press / Focus:** press nudges down 1px (off under reduced motion); focus is a 3px blue outline offset 2px, yellow on black bars.
- **Icon buttons:** 44px squares with a 2px ink outline; on black bars the outline is Shell Rule and turns white on hover.

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
- **Style:** white, 2px Hairline border, 4px corners, 48px tall, 12px padding, 16px text; label above in Barlow 600 14px slate.
- **Focus:** border turns ink plus the 3px blue focus outline.
- **Warn:** ink border and a bold ink hint led by the yellow triangle mark.
- **Disabled:** concrete fill with a dashed border.

### Chips
44px, 2px ink outline, white, Barlow 600 15px; selected fills ink with white text. Used for mode and filter choices.

### Navigation
- **Job bar:** Shell Black, full bleed; back and setup icon buttons either side of the mono ref (Shell Muted), the job name in Display, and client · address beneath in Shell Muted.
- **Bottom nav:** 68px Shell Black bar with 24px icons over condensed uppercase labels in Shell Muted; the active tab turns white with a 4px yellow bar on top. The centre capture key is a 56 by 52px yellow plate with an ink plus. On desktop it becomes the left rail, with the yellow bar on the left edge.
- **Cover head:** Shell Black with the white wordmark centred, a condensed tracked sub-line in Shell Muted, and the sync state beneath.
- **Banner:** Shell Raised strip for offline and sync messages.

### Sheets
Bottom sheets on a phone (6px top corners, rising from the edge in 0.26s), centred dialogs on desktop. A 44px outlined close square. Unsaved changes raise a sticky yellow ask bar; discard is red.

### Dashboard Board
A Shell Black block with condensed labels in Shell Muted, the headline figure in yellow, and cells ruled in Shell Rule. A red plate marks an alert figure. Bars below are flat: green certified, yellow in valuation, ink outline still to claim.

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
- **Don't** set text below 12px, or uppercase labels below 13px; this is read outdoors in glare.
