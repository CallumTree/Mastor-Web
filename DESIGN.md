---
name: Mastor
description: Job money for small UK builders. Black and white carry the structure, neon carries the one live thing, and red, yellow and green mean only warning, to-do and done.
colors:
  ink: "#0A0A0B"
  ink-2: "#3F3F46"
  ink-muted: "#5E5E66"
  ground: "#FFFFFF"
  panel: "#FFFFFF"
  line: "#E4E4E7"
  field-line: "#8B8B93"
  row-open: "#F4F4F5"
  flag-row: "rgba(255, 205, 0, 0.18)"
  disabled: "#E4E4E7"
  shell: "#0A0A0B"
  shell-2: "#18181B"
  shell-line: "#2E2E33"
  shell-text: "#FFFFFF"
  shell-muted: "#A1A1AA"
  shell-shadow: "rgba(10, 10, 11, 0.6)"
  neon: "#00E5FF"
  neon-press: "#66F0FF"
  volt: "#0040FF"
  volt-press: "#0033CC"
  warn-yellow: "#FFCD00"
  warn-red: "#C1121F"
  red-on-dark: "#FF9B9B"
  done-green: "#0B7A3E"
  arch-copper: "#C97B3F"
typography:
  display:
    fontFamily: "'Archivo Variable', Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(22px, 6.4vw, 30px)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 125"
  figure-xl:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "clamp(34px, 11vw, 48px)"
    fontWeight: 750
    lineHeight: 1.05
    fontFeature: "tnum"
    fontVariation: "'wdth' 112"
  figure:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "min(clamp(22px, 7vw, 32px), max(15px, calc(160cqi / var(--len, 6))))"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
    fontVariation: "'wdth' 112"
  figure-board:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 750
    lineHeight: 1.05
    fontFeature: "tnum"
    fontVariation: "'wdth' 112"
  figure-sm:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "min(clamp(19px, 5.6vw, 24px), max(15px, calc(160cqi / var(--len, 6))))"
    fontWeight: 750
    lineHeight: 1.05
    fontFeature: "tnum"
    fontVariation: "'wdth' 112"
  amount:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "tnum"
    fontVariation: "'wdth' 112"
  row-title:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 750
    lineHeight: 1.1
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 112"
  title:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "'Archivo Variable', Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  row-text:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  note:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  small:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  section-head:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 750
    letterSpacing: "0.07em"
    fontVariation: "'wdth' 125"
  label:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0.07em"
    fontVariation: "'wdth' 125"
  plate:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.03em"
    fontVariation: "'wdth' 112"
  roman-ref:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 125"
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
  sm: "6px"
  base: "10px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "999px"
spacing:
  hair: "4px"
  tight: "6px"
  inline: "8px"
  stack: "12px"
  cell: "14px"
  panel: "16px"
  section: "22px"
  empty: "32px"
  gutter-desktop: "48px"
  dock: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell-text}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "#27272A"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "52px"
  button-secondary-hover:
    backgroundColor: "{colors.row-open}"
  button-danger:
    backgroundColor: "{colors.warn-red}"
    textColor: "{colors.shell-text}"
    rounded: "{rounded.md}"
    height: "52px"
  button-disabled:
    backgroundColor: "{colors.disabled}"
    textColor: "{colors.ink-2}"
  button-ghost:
    textColor: "{colors.ink-2}"
    height: "44px"
  button-markup-primary:
    backgroundColor: "{colors.neon}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "52px"
  icon-button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    size: "44px"
  icon-button-on-dark:
    backgroundColor: "{colors.shell-2}"
    textColor: "{colors.shell-text}"
    rounded: "{rounded.md}"
    size: "44px"
  plate-do:
    backgroundColor: "{colors.volt}"
    textColor: "{colors.shell-text}"
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "5px 10px"
  plate-stop:
    backgroundColor: "{colors.warn-red}"
    textColor: "{colors.shell-text}"
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "5px 10px 5px 7px"
  plate-warn:
    backgroundColor: "{colors.warn-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "5px 10px 5px 7px"
  plate-ok:
    backgroundColor: "{colors.done-green}"
    textColor: "{colors.shell-text}"
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "5px 10px 5px 7px"
  plate-wait:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "5px 10px 5px 9px"
  badge:
    typography: "{typography.plate}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
  action-plate:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
    height: "64px"
  action-plate-do:
    backgroundColor: "{colors.volt}"
    textColor: "{colors.shell-text}"
  action-plate-stop:
    backgroundColor: "{colors.warn-red}"
    textColor: "{colors.shell-text}"
  action-plate-warn:
    backgroundColor: "{colors.warn-yellow}"
    textColor: "{colors.ink}"
  action-plate-ok:
    backgroundColor: "{colors.done-green}"
    textColor: "{colors.shell-text}"
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
    padding: "12px 14px"
    height: "50px"
  chip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell-text}"
  job-bar:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-text}"
    typography: "{typography.display}"
    rounded: "{rounded.xl}"
    padding: "14px 16px 16px"
  dock:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-muted}"
    rounded: "{rounded.xl}"
    height: "64px"
  capture-key:
    backgroundColor: "{colors.neon}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    width: "52px"
    height: "48px"
  title-block:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-text}"
    typography: "{typography.figure-board}"
    rounded: "{rounded.xl}"
    padding: "14px 16px"
  figure-cell-hot:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.neon}"
    typography: "{typography.figure-sm}"
    padding: "12px 14px 13px"
  property-tile:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell-text}"
    rounded: "{rounded.md}"
    size: "40px"
  property-tile-open:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.neon}"
  sheet:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.xl}"
    padding: "12px 18px 28px"
---

# Design System: Mastor

## Overview

**Creative North Star: "The Live Wire on the Drawing Board"**

Mastor is a white drawing board with black slabs bolted to it. The ground is pure white; structure is carried by near-black ink and by solid black slabs for the things that frame a job: the job header, the floating dock, the dashboard title block and the one figure on a screen that matters most. On top of that structure exactly one thing is lit: where you are, what's next, how far the job has got. On black it is lit in neon cyan; on white its twin, volt blue, takes over. Red, yellow and green are not decoration; they are warnings, and appear only where something is overdue, needs doing or is done.

The type is one variable family, Archivo, used at three widths: expanded capitals (125%) for headings and labels, a narrower expanded cut (112%) for figures so long amounts fit a phone cell, and normal width for anything that is read as sentences. JetBrains Mono sets codes and references; Cinzel lives only in the MΛSTΘR wordmark. The density is a site phone's: large targets, 13px floor, figures that shrink to their box rather than overflow it.

This world refuses the category default of a grey dashboard with a brand-blue button, and it refuses the dark neon "cyber" console: neon here is a signal on black slabs inside a light page, never an atmosphere, never a glow.

**Key Characteristics:**
- Pure white ground, hairline panels, no shadow at rest.
- Black slabs for structure: job header, dock, title block, hot figures, property tiles.
- One lit thing per screen: neon on black, volt on white.
- Warning colours carry meaning only, always paired with a sign shape and a word.
- Archivo at 125% (headings, labels), 112% (figures), 100% (reading).
- Signature: the neon progress rail along the foot of the job header.
- Light only, by decision.

## Colors

A black-and-white board with one live colour in two forms (neon on black, volt on white) and three warning colours that mean only what they say.

### Primary
- **Live Neon** (neon): the one live thing on a black slab. The progress rail and its tick, the active-tab bar on the dock, the capture key, the headline figure on the title block, a hot figure cell, the open property numeral, the mark-up layer's main action, focus rings on black. 13:1 on Shell Black; it is never text or a mark on white.
- **Volt Blue** (volt): neon's twin on white. Links, focus rings, checkbox and radio accents, the loading bar, the small accent dot in icons on white, and the next-step plate and action plate ("do this next"). Volt Press (volt-press) is its pressed state. 6.6:1 on white.

### Secondary (warning plates)
- **Warning Red** (warn-red): overdue, missing, urgent, destructive. Plates take white text; as text on white it marks a negative figure. On black it becomes **Red on Dark** (red-on-dark) for text, since the plate red is only 3:1 there.
- **To-do Yellow** (warn-yellow): needs doing. A plate colour only, always with ink text; the flagged-row wash (flag-row) and the unsaved-changes ask bar are the same yellow.
- **Done Green** (done-green): done, complete, certified, paid. Plates take white text; progress fills on white that measure claimed or complete work are green.

### Tertiary
- **Arch Copper** (arch-copper): the arch and keystone in the opening titles, and the app icon. Nowhere else.

### Neutral
- **Ink** (ink): text, outlines of secondary controls, the primary button fill, property tiles, 1.5px register header rules.
- **Slate Ink** (ink-2): codes and refs beside body text, ghost buttons, disabled-button text.
- **Muted Ink** (ink-muted): labels, hints, secondary lines.
- **White Ground / Panel** (ground, panel): page and panels; both are pure white.
- **Hairline** (line): dividers and panel edges only. Also the disabled fill (disabled).
- **Field Line** (field-line): input and choice-card edges, 3.4:1 on white.
- **Open Row** (row-open): hover, expanded rows, secondary-button hover.
- **Shell Black** (shell), **Shell Raised** (shell-2), **Shell Rule** (shell-line), **Shell Muted** (shell-muted): the black slabs, their raised controls, their rules and their secondary text. White (shell-text) is their primary text.

### Named Rules
**The One Live Thing Rule.** Neon (on black) or volt (on white) marks only where you are, what's next, or how far the job has got. If it isn't one of those, it is ink or white.

**The Neon Lives on Black Rule.** Neon is never placed on a light ground. Where a white-ground element needs to light up, it becomes a black tile with a neon mark (the open property tile is an ink tile with a neon numeral).

**The Warning Meaning Rule.** Red is overdue or missing, yellow is needs doing, green is done. Green means done only: an "Active" job status is an ink outline badge, not green.

**The Yellow Is a Plate Rule.** Yellow is a surface, never a text colour. "Needs doing" as text is ink beside a yellow sign.

**The Light Only Rule.** Mastor is light only, and that is a decision (`color-scheme: only light`). The black slabs are the only dark surfaces; there is no dark palette to keep in step.

## Typography

**Display Font:** Archivo Variable, expanded (with system-ui fallback)
**Body Font:** Archivo Variable, normal width
**Label/Mono Font:** JetBrains Mono for codes and references; Cinzel 600 for the wordmark only

**Character:** One grotesque stretched to three widths: wide, flat capitals that read like stencilled site lettering for headings and labels, a slightly narrower cut for figures, and a plain normal width for sentences. Width is the hierarchy, as much as size.

### Hierarchy
- **Display** (800, clamp 22–30px, 1.08, 125% width): the job name in the black header. 19–24px on the work tabs; 18px under 300px.
- **Headline** (800, 26px, 1.05, 125% width, uppercase): tab titles.
- **Figure XL** (750, clamp 34–48px, 112% width, tabular): the title block's headline figure, in neon.
- **Figure** (750, up to 32px, 112% width, tabular): job-home figures. Shrinks to its cell, down to 15px, then breaks.
- **Figure Board / Figure Small** (750, 26px / up to 24px, 112% width): title-block cells and summary strips.
- **Amount** (700, 18px, 112% width, tabular): right-hand amounts in registers, property rows and job rows (20px there).
- **Row Title** (750, 17px, 112% width, uppercase, 0.02em): property names, set deliberately between the 16px title and 18px amount steps.
- **Title** (700, 16px, 1.25, normal width): action-plate headings, button text (650).
- **Body** (400, 16px, 1.45, normal width): everything read as sentences. Notes 14px/1.4; small 13px/1.35.
- **Row text** (600, 15px, 1.3, normal width): the title line of a list row (a rate, a cost, a check result, a document) and short bold messages in bars and plates — between body and note, so a row's title outranks its meta without shouting.
- **Section Head** (750, 14px, 0.07em, 125% width, uppercase): section headings inside a screen.
- **Label** (650–700, 13px, 0.06–0.07em, 125% width, uppercase): figure labels, sheet titles, register heads.
- **Plate** (700, 13px, 0.03em plates / 0.05em badges, 112% width, uppercase): sign plates and badges.
- **Roman Ref** (750, 19px, 125% width): VO and valuation numbers (VO XII, VAL III).
- **Code** (JetBrains Mono 400/500, 13–14px, tabular): job refs, SoR codes, the rail's percentage.

### Named Rules
**The Three Widths Rule.** 125% for headings and labels, 112% for figures, 100% for reading. A figure at 112% runs about 0.6em a character, so a ten-character amount (£11,879.22) fits a three-across phone cell at the 15px floor; 125% does not.

**The Fit to the Box Rule.** Figures size themselves to their cell: the cell is a size container, `--len` carries the character count (a % counts as two), and the figure is `160cqi / --len`, capped at its step and floored at 15px. Never let a figure overflow or ellipsise.

**The Narrow Label Rule.** On phones (≤480px), labels in figure grids and the title block drop to 100% width at 0.05em and keep room for two lines (2.4em), so the figures across a row start level.

**The Roman Ref Rule.** VO and valuation references are Roman numerals in expanded Archivo 750, never in Mono and never in Cinzel.

**The 13px Floor Rule.** No text on screen is smaller than 13px; it is read outdoors, in glare. Small text uses the 13px small and hint styles and the 14px note style, not an inline size.

**The Wordmark Rule.** Cinzel exists only in the MΛSTΘR wordmark and the opening titles.

## Layout

Phone first, one column. Pages cap at 720px with 16px side padding and clear the floating dock (64px plus 20px). The black job header bleeds edge to edge above the column with 24px rounded foot corners. Panels stack 12px apart, inline groups use 8px gaps, rows pad at 12–14px, panels at 16px, and section heads sit 26px above and 10px below.

Job-home figures are a ruled grid, two across on a phone and four from 640px. Summary strips are two or three across; from 560px they go three or four. Title-block cells foot-align their figures so labels of different heights still share a baseline row. Registers are a 64px ref / description / right-aligned amount grid under a 1.5px ink header rule.

The dock floats 10px in from the sides and foot (max 560px). At 1024px and up it becomes a 104px black left rail with the capture key at the top and the active bar on its left edge; content moves to a 960px column with 48px gutters, the job header meets the rail square, sheets become centred 640px dialogs, the dashboard title block runs six cells across under its headline, the dashboard splits into two columns, and the jobs list becomes a ruled five-column schedule.

Under 360px cell padding tightens. Under 300px (a phone at about 200% zoom) the layout reflows instead of scrolling sideways: grids go to one column, paired buttons and fields stack, the wordmark takes its own row (22px, tracking 0.16em), the dock wraps into rows of three 60px keys with labels kept for screen readers (the active key raised to Shell Raised, a second-row bar on its own bottom edge), the job name goes full width at 18px beneath back and setup, property and workstream amounts drop to their own line, the title block goes one figure per row, and diary photos go one across.

The page keeps scroll padding the height of the dock so a focused control near the bottom scrolls clear of it.

## Elevation & Depth

Flat at rest. Panels are white on white, separated by a 1px hairline, never by shadow; an expanded row tints to Open Row. Black slabs are not lifted: they read as weight, not height. Only the two things that genuinely float cast a soft, ink-tinted shadow: the dock on a phone and the sheet. The scrim behind a sheet is ink at 55%. Outlined plates (wait, slate badge) are drawn with a 1.5px inset ink line; the open property tile and the chosen mark-up swatch are ringed by a gap and an outer ring. The one text shadow sits on media: the play glyph over a video frame.

### Shadow Vocabulary
- **Dock float** (`box-shadow: 0 16px 36px -14px rgba(10, 10, 11, .5)`): the floating dock on phones; removed on the desktop rail.
- **Sheet rise** (`box-shadow: 0 -18px 48px -20px rgba(10, 10, 11, .35)`): bottom sheets; on desktop dialogs `0 32px 80px -24px rgba(10, 10, 11, .45)`.
- **Media glyph** (`text-shadow: 0 1px 6px rgba(10, 10, 11, .6)`): a white glyph over a photo or video frame.

### Named Rules
**The Flat Board Rule.** Nothing at rest casts a shadow. To make something stand out, make it black or give it its warning plate; only floating layers (dock, sheet) cast shadow.

**The No Glow Rule.** Neon is a flat fill or line. No glow, no blur, no glass.

## Shapes

Softly rounded on a fixed scale: 6px for plates, badges and small tiles; 10px for choice cards, ask bars, tick boxes and thumbnails; 12px for buttons, inputs, icon buttons, action plates and the property tile; 16px for panels, figure grids, strips, the update bar and the capture key; 24px for the black slabs (job header foot, dock, title block) and sheet tops. Chips and the sheet close button are pills. The 2px ends on 4px progress bars are hairline rounding, not a scale step.

Lines: secondary controls take a 1.5px ink outline, inputs a 1.5px Field Line edge, panels a 1px Hairline. Icons are drawn on a 24-unit grid with a 1.6 stroke, square caps and mitred joins, plus one small accent dot (volt on white, neon on black).

Status shapes follow safety signs: **stop** a red circle with a white bar, **warn** a yellow triangle with an ink exclamation, **do** a volt circle with a white arrow, **ok** a green square with a white tick; 14px in plates, larger in action plates.

## Components

### Buttons
Full-width blocks on a phone, blunt and black.
- **Shape:** 12px corners, 52px tall, 0 20px padding, 1.5px border, Archivo 650 16px, optional 20px icon.
- **Primary:** ink fill, white text; hover lifts to a lighter black.
- **Secondary:** white with a 1.5px ink outline; hover Open Row.
- **Ghost:** no fill, underlined Slate Ink text, 44px, auto width; Shell Muted on black.
- **Danger:** Warning Red, white text. **Disabled:** Hairline grey fill, Slate Ink text.
- **Press / Focus:** press nudges down 1px (off under reduced motion); focus is a 2.5px volt outline offset 2px, neon on black slabs.
- **Icon buttons:** 44px, 12px corners, 1.5px ink outline; on black, Shell Raised with a Shell Rule edge that turns neon on hover.
- **On the mark-up layer** the main action is neon with ink text (Mark-up is a black layer).
- **File pickers** are button labels around a visually hidden file input, so the keyboard reaches them; the focus ring draws on the label.

### Sign Plates and Badges
- **Style:** solid plate, 6px corners, 13px capitals at 112% width, led by a 14px sign mark.
- **Stop / Warn / OK:** red, yellow (ink text), green.
- **Do:** volt with white text and a leading arrow, naming the one next step.
- **Wait:** white with a 1.5px inset ink line, for things waiting on someone else.
- **Badges** are the same plate at 3px 8px for record states; "Active" and "Instructed" are the ink outline badge.

### Action Plates
Full-width tappable signs on job home under "Action needed": 64px minimum, 14px 16px padding, 6px apart, 12px corners, a 16px 700 heading over a 14px hint, ending in a chevron. Red, yellow and green by meaning; volt for the next step. Hover darkens slightly. When nothing is outstanding, one green all-clear plate.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** white on white.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Hairline; register and schedule heads take a 1.5px ink rule.
- **Internal Padding:** 16px; list panels drop padding and rule their rows.

### Figures and Summary Strips
White ruled grids of 112% figures over 125% labels. The cell carrying the figure that matters turns black with a neon figure (hot). Honest unknowns stay visible: an em dash, "Unpriced", or a yellow note plate under the figure. A green 4px bar along the strip's foot measures claimed work.

### Inputs / Fields
- **Style:** white, 1.5px Field Line edge, 12px corners, 50px tall, 12px 14px padding, 16px text; label above in 600 14px, hint below at 13px Muted Ink.
- **Focus:** edge turns ink plus the 2.5px volt ring.
- **Warn:** ink edge and a bold ink hint led by the yellow triangle.
- **Disabled:** dashed edge on white.
- **Choice cards:** 52px, 10px corners, Field Line edge; chosen turns ink on Open Row.

### Chips
Pills, 44px tall, 1.5px ink outline, 600 15px; selected fills ink with white text.

### Navigation
- **Job header:** Shell Black, full bleed, 24px foot corners. Back and setup icon buttons flank the mono ref (Shell Muted), the job name in Display, and the setup line beneath; the neon progress rail runs along its foot.
- **Dock:** a floating 64px Shell Black bar, 24px corners, 24px icons over 13px 600 labels in Shell Muted. The active tab turns white with an 18px by 3px neon bar above its icon. The capture key is a 52 by 48px neon key with an ink plus, 16px corners. On desktop it becomes the left rail with the active bar on the left edge.
- **Cover head:** Shell Black with the white wordmark centred, a 125% tracked sub-line in Shell Muted, and the sync state.

### Dashboard Title Block
A Shell Black block, 24px corners, labels at 125% in Shell Muted, figures at 112% white, the headline figure in neon, cells ruled in Shell Rule and foot-aligned. A red plate marks an alert figure; scale bars are neon on Shell Rule.

### Property Rows
A 40px ink tile with a white numeral, the name in Row Title, and the amount right. Open, the row tints Open Row and the numeral turns neon inside a double ring; workstream groups indent beneath as 48px toggle rows with green progress bars.

### Neon Progress Rail (signature)
How far the job has got, along the foot of the job header on every tab. A 4px Shell Rule track with 2px ends: certified work is solid neon, the open valuation is a neon dash (4px on, 3px off) at 60%, and a 2 by 12px neon tick marks the certified point. Its label sits right in 13px mono, Shell Muted on job home and neon with just the figure on the work tabs. It grows in from the left over 0.9s (`cubic-bezier(.16, 1, .3, 1)`); under reduced motion it is simply drawn.

### Sheets
Bottom sheets on a phone (24px top corners, rising from the edge in 0.26s; a fade under reduced motion), centred 640px dialogs on desktop. A 44px pill close button with a 1.5px ink outline. Unsaved changes raise a sticky yellow ask bar; discard is red.

### Photo Mark-up
A full-screen black layer: ghost buttons in Shell Muted, a 125% tracked title, 44px colour swatches ringed white outside a dark gap when chosen, 48px outlined tool toggles whose outline turns neon when chosen, and a neon main action.

### Opening Titles
Shell Black. The copper arch draws itself, the keystone drops in, the MΛSTΘR letters rise, and a neon dimension line grows beneath. Reduced motion skips it.

## Do's and Don'ts

### Do:
- **Do** keep each screen to one lit thing: neon on black, volt on white.
- **Do** turn a white-ground element black before lighting it neon (the open property tile).
- **Do** use red, yellow and green only for overdue, needs doing and done, each with its sign shape and a spoken word.
- **Do** put ink text on yellow and neon; white text on red, green, volt and black.
- **Do** set headings and labels at 125% width, figures at 112%, and reading text at normal width.
- **Do** let figures fit their box (`--len`, container units, 15px floor) rather than truncate.
- **Do** keep panels flat with a 1px Hairline and 16px corners; stay on the 6 / 10 / 12 / 16 / 24px radius scale, with pills for chips and the close button.
- **Do** keep tap targets at 44px minimum and primary controls at 48–64px.
- **Do** show unknowns honestly: "Unpriced", "not measured", an em dash, never £0.

### Don't:
- **Don't** put neon on a white ground, or use it as text on white.
- **Don't** use green for anything but done; an active or in-progress state is an ink outline.
- **Don't** use yellow as a text colour.
- **Don't** add glow, glass, gradients or texture, or shadows on anything at rest.
- **Don't** build a grey dashboard with a brand-blue button, or a dark neon console.
- **Don't** use Cinzel outside the wordmark and opening titles, Mono outside codes and references, or copper outside the opening-titles arch.
- **Don't** set text below 13px, or size small text inline.
- **Don't** draw an input's edge in Hairline; fields use Field Line.
- **Don't** add a dark theme; light only is a decision.
