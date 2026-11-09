---
name: Mastor
description: Job money for small UK builders, drawn like a technical drawing. Deep ink navy with a faint drafting grid, milled-steel panels and hairlines carry the structure, drafting white carries the facts, and two signals do all the work: blueprint cyan for what is selected, surveyor gold for what needs you.
colors:
  void: "#0A0F1D"
  slate: "#101827"
  slate-2: "#16213A"
  rule: "#1E293B"
  rule-ctl: "#64748B"
  white: "#F8FAFC"
  ink-2: "#CBD5E1"
  meta: "#8291A7"
  grid: "rgba(148, 163, 184, 0.06)"
  cyan: "#38BDF8"
  gold: "#F59E0B"
  on-signal: "#0A0F1D"
  white-press: "#DCE1E8"
  cyan-press: "#6CCFFA"
  scrim: "rgba(0, 0, 0, 0.72)"
  arch-copper: "#C97B3F"
  core-clay: "#C46A49"
  core-bronze: "#B07D36"
  core-olive: "#8A9348"
  core-teal: "#2A9C9C"
  core-slate: "#7187A6"
  core-moss: "#5E8C61"
  core-rose: "#CC6994"
  core-graphite: "#80858D"
typography:
  job-name:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "clamp(22px, 6.4vw, 28px)"
    fontWeight: 720
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  tab-title:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 720
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 450
    lineHeight: 1.45
  small:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 450
    lineHeight: 1.35
  section-head:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.1em"
    fontVariation: "'wdth' 87.5"
  label:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 87.5"
  status:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
    fontVariation: "'wdth' 87.5"
  roman-ref:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 720
    letterSpacing: "0.04em"
    fontVariation: "'wdth' 87.5"
  figure:
    fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace"
    fontSize: "clamp(22px, 6.4vw, 28px)"
    fontWeight: 520
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "'tnum'"
  headline-figure:
    fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace"
    fontSize: "clamp(32px, 10vw, 44px)"
    fontWeight: 560
    lineHeight: 1.05
    letterSpacing: "-0.04em"
    fontFeature: "'tnum'"
  amount:
    fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace"
    fontSize: "17px"
    fontWeight: 520
    letterSpacing: "-0.02em"
    fontFeature: "'tnum'"
  code:
    fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 450
    fontFeature: "'tnum', 'zero'"
  wordmark:
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif"
    fontSize: "clamp(26px, 9vw, 40px)"
    fontWeight: 600
    letterSpacing: "0.28em"
rounded:
  sm: "0px"
  r: "1px"
  md: "2px"
spacing:
  hair: "1px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  page: "16px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.on-signal}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.white-press}"
    textColor: "{colors.on-signal}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "52px"
  button-danger:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.md}"
    height: "52px"
  icon-button:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    size: "44px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "44px"
  chip-on:
    backgroundColor: "{colors.white}"
    textColor: "{colors.on-signal}"
  panel:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "14px"
  input:
    backgroundColor: "{colors.void}"
    textColor: "{colors.white}"
    typography: "{typography.body}"
    rounded: "{rounded.r}"
    padding: "12px 14px"
    height: "50px"
  status-tag:
    backgroundColor: "{colors.void}"
    typography: "{typography.status}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  action-row:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "13px 16px"
    height: "64px"
  dock:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.meta}"
    rounded: "{rounded.md}"
    height: "64px"
  capture-key:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.on-signal}"
    rounded: "50%"
    width: "60px"
    height: "60px"
  sheet:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "12px 18px 28px"
---

# Design System: Mastor

## Overview

**Creative North Star: "The Drawing Office"**

The app is drawn like a technical drawing. The ground is deep ink navy with a faint 24px alignment grid under everything, panels are milled steel, and every line is a drafting hairline. Each data block is drawn twice, its own edge and a bounding box 3px outside it, the way a title block sits on a sheet. Facts are in drafting white; dimensions and notes are in slate. Figures, refs and codes are set in a tabular mono so a column of money lines up to the penny, and labels are short uppercase markings tracked wide.

Two signals do all the work, the drafting office's own: blueprint cyan is the selection (the next step and the one live thing, variations, a record Claude changed, progress, ticks into the valuation) and surveyor gold is the mark that needs you (overdue, to-do, caution, recording). Overdue and to-do share gold, so the sign's shape tells them apart: a disc with a bar for overdue, a triangle for to-do. Done is drafting white. The primary action is a white block; everything else is outlined in slate.

The user chose this world in November 2026 from three dark directions, after the field-instrument look. The brand stays: the MΛSTΘR wordmark in Cinzel, the copper arch, Roman numerals for valuations and VOs.

**Key Characteristics:**
- Ink navy ground with a faint drafting grid; milled-steel panels; 1px hairlines; no shadows
- Every data block drawn twice: its edge and a bounding box 3px outside
- Two signals: cyan for the selection, gold for what needs you; done is white
- Tabular mono for every figure, code, ref, quantity and date number
- Uppercase micro-labels tracked at 0.08em; section heads are cyan title lines over a hairline
- The one live thing on a screen, always something you can act on, is marked at its corners in cyan, like a selection in a drawing program. A figure is a reading and is never marked

## Colors

A drafting sheet with two signals; every neutral leans blue.

### Primary
- **Drafting White** (#F8FAFC): every fact, the primary button's block, done marks, the certified part of the job's rail, the focus ring. 17:1 on a panel.

### Signals
- **Blueprint Cyan** (#38BDF8): the selection. The next step and its corner marks, the open valuation, variations and "by Claude", progress bars, ticks into the valuation, today on the job's line, the current tab, section heads, the caret and text selection. 8.3:1 on a panel.
- **Surveyor Gold** (#F59E0B): what needs you. Overdue money, late to-dos, things to do, caution notes, destructive actions, the mic while recording. 8.3:1 on a panel; type on it is On-Signal ink.

### Trade Cores (categorical)
- Clay #C46A49, Bronze #B07D36, Olive #8A9348, Teal #2A9C9C, Slate #7187A6, Moss #5E8C61, Rose #CC6994, Graphite #80858D: one per trade, only ever a 14×5px band beside the trade's name (`src/lib/trade.ts`). They identify, they never signal.

### Neutral
- **Ink Navy** (#0A0F1D): the ground, inputs, the inside of a status tag.
- **Drafting Grid** (rgba(148, 163, 184, 0.06)): the 24px alignment grid drawn on the ground, fixed behind the page. Drafting-neutral slate, not cyan: cyan is a signal and never wallpaper.
- **Milled Steel** (#101827): panels, the dock and rail, sheets.
- **Steel Raised** (#16213A): an open, hovered or hot row; Clerk's "you said" block.
- **Hairline** (#1E293B): dividers, panel edges and the bounding boxes.
- **Slate Edge** (#64748B): the edge of anything you operate (inputs, outlined buttons, chips, ticks). 3.7:1 on a panel, for WCAG 1.4.11.
- **Ink 2** (#CBD5E1): quieter reading text and field labels. 11:1.
- **Slate Note** (#8291A7): dimensions, notes and labels. 5.6:1 on a panel, 5.1:1 on a raised row. The brief's #64748B is kept for control edges only: at 3.7:1 it is too faint for small text outdoors.
- **On-Signal** (#0A0F1D): type and marks laid on a lit block.
- **Arch Copper** (#C97B3F): the app icon's arch and the opening titles only.

### Named Rules
**The Two Signals Rule.** Cyan is the selection, gold is what needs you. Nothing else is coloured, and neither is used to decorate.

**The Shape Carries It Rule.** Overdue and to-do are both gold, so they are never told apart by colour: overdue is a disc with a bar, to-do a triangle, the next step a cyan disc with an arrow, done a white square with a tick. Every sign also has its word for screen readers.

**The Drawn Twice Rule.** A block you work in (panel, action row, job list, title block) carries a 1px Hairline bounding box 3px outside its own edge. A block inside a sheet or inside another block is drawn once. The money ledger is never boxed: it's a reading, not a window.

**The Drafting Sheet Rule.** The app and the front page are dark only (`color-scheme: only dark`) and drawn on the grid; the front page carries the same tokens in `src/landing/landing.css` (its brief: `.impeccable/surfaces/src-landing-landing-tsx.md`). The client's PDFs stay print-white.

## Typography

**UI Font:** Archivo Variable (with system-ui), at normal width for reading and 87.5% for markings
**Data Font:** JetBrains Mono Variable (with ui-monospace)
**Wordmark:** Cinzel 600, MΛSTΘR only

**Character:** a working grotesque that tightens for headings and narrows into uppercase markings, beside a tabular mono that carries every number the client's QS will check.

### Hierarchy
- **Headline figure** (Mono 560, clamp(32px, 10vw, 44px), -0.04em): the dashboard's owed figure.
- **Job name / Tab title** (Archivo 720, 26–28px, 1.05–1.08, -0.02em): the one heavy line on a screen.
- **Figure** (Mono 520, 19px; the key figure 600 at 26px; -0.02em): the money ledger's column, shrunk to fit beside its label (down to 15px) rather than cut off.
- **Title** (Archivo 700, 16px, 1.25, -0.01em): an action row's title, a sheet's question, a property.
- **Body** (Archivo 450, 16px, 1.45): reading text; Clerk's answers to 62ch.
- **Section head** (Archivo 87.5% 700, 13px, 0.1em, uppercase, cyan, over a 1px Hairline): ACTION NEEDED, PINNED NOTES.
- **Label** (Archivo 87.5% 650, 13px, 0.08em, uppercase, Slate Note): figure labels, register heads, field labels (in Ink 2).
- **Status** (Archivo 87.5% 700, 13px, 0.05em, uppercase): tags and plates.
- **Amount / Code** (Mono 520 / 450, 13–17px): amounts in rows, SoR codes, contract refs, dates on the line.

### Named Rules
**The Mono Is Data Rule.** JetBrains Mono sets figures, amounts, codes, refs, quantities and date numbers, with tabular numerals so decimals align. Never words, never labels, never headings.

**The Roman Ref Rule.** VAL III and VO XII are markings, not data: Archivo 87.5% at 720 with 0.04em tracking, never Mono.

**The 13px Floor Rule.** Nothing on screen is smaller than 13px; it is read outdoors, in glare. Small text is 450 weight or heavier.

**The Fit to the Box Rule.** A figure sizes itself to its cell: the cell is a size container, `--len` carries the character count, and a mono figure is 0.6em a character, down to a 15px floor, then it breaks.

## Layout

One column on a phone (16px gutters, 720px max), a 104px rail and a 960px column from 1024px. Panels are ruled registers: rows divided by 1px Hairline, never cards inside cards, each panel inside its bounding box. Rhythm: 6px inside groups, 12px between rows of controls, 28px above a section head and 10px below it. Touch targets are 44px or more everywhere (52px for buttons) for gloves. Under 360px button pairs stack and the dock shares its width evenly; under 300px the dock goes to two rows.

## Elevation & Depth

Flat. Depth is told by value and by drawing: Ink Navy ground, Milled Steel panels, Steel Raised for what is open, hovered or hot, the bounding box around each data block, and the one dim, Scrim (black at 72%, never milky), under sheets. The only shadow in the app is a drop shadow under the white play mark laid over a video frame.

### Named Rules
**The No Glow Rule.** Signals are flat fills and flat lines. No glow, no blur, no glass, and no smooth gradient anywhere: the only gradients are hard-edged patterns (the drafting grid, the dashed open-valuation segment of the rail, the corner marks, scale bars).

## Shapes

Drafted corners: 0px for tags, chips and thumbnails, 1px for inputs, 2px for panels, buttons, rows, sheets and the dock. Squares replace circles everywhere except the sign marks (the overdue and next-step discs are sign shapes, kept so meaning never rests on colour alone): the job line's day nodes, status dots and the "cancelled" mark are squares. Every line is 1px.

## Components

### Buttons
- **Shape:** 2px corners, 52px tall, full width on a phone.
- **Primary:** Drafting White block, On-Signal 650 type; hover #DCE1E8; press moves down 1px.
- **Secondary:** transparent, white type, Slate Edge border; hover lifts to Steel Raised with a white border.
- **Ghost:** Ink 2 text with a Slate Edge underline that turns white on hover.
- **Danger:** a Surveyor Gold block with On-Signal type.
- **Focus:** a 2px white ring at 2px offset (3px on the white block).

### Status Tags (badges and plates)
- **Style:** Ink Navy inside, 1px frame and capitals in the signal colour; a plate leads with its sign mark, a badge with a 6px square.
- **Variants:** gold (overdue, late, to-do), cyan (the open valuation, the next step, by Claude), white (done, claimed, paid), Ink 2 on Slate Edge (neutral states), Slate Note on Hairline (waiting on someone else).

### Action Rows
- Milled Steel rows, 64px tall, inside their bounding box, led by their sign mark, title in white, hint in Slate Note, chevron right. An overdue row's frame is gold; a next-step row's frame is cyan; the live next step is marked at its corners instead.

### Cards / Containers
- **Corner Style:** 2px.
- **Background:** Milled Steel on Ink Navy.
- **Shadow Strategy:** none.
- **Border:** 1px Hairline, plus the bounding box 3px outside.
- **Internal Padding:** 14px; registers carry their own 12–14px row padding.

### The operative's site list
- Houses fold to a 60px row (name in white, "10 lines · 6 done · 1 VO" in Slate Note, a filled white tick square when the house is all done). Inside, each line ends in a Done button at least 48px tall: an outlined 20px square and the word; marked, the square fills drafting white with a tick and the edge turns white. Signed off is the same, greyed and fixed. Gloves and glare: nothing under 44px, the word always beside the mark.
- The capture sheet leads with Photo as the one white block (64px); video, voice, variation, dayworks and note sit under it, outlined, two across.

### Small rules the polish pass settled
- Every money figure on every screen is in pence, the same as Vals: no "£12.5k" anywhere in the app (the Dashboard's figures are a ledger now, like the job's).
- Radio choices are drafted squares (an outlined square, a smaller white square inside when chosen), never round.
- A disabled menu item is said in Slate Note, never faded with opacity.
- Valuation and VO refs are set as Roman markings (`.ref-roman`) even inside a mono line.
- VO units are the client's schedule units (IT, NO, LM, SM, M3). "0 days" is "sent today".
- Every sheet's title is the cyan ruled title, menus included.
- The job header's icon buttons carry a word under the icon (Clerk, Setup): an unlabelled icon in the header was guessed at.

### First run
- **Getting set up** sits at the top of the jobs screen for a new firm: a ruled list (2px head and foot, hairlines between), each step a 60px row with a 20px square that fills drafting white with a tick when the app sees it done, the step's name in white and one line of why in Slate Note; a step that may not apply carries a quiet link to set it aside. No progress bar, no percentages: "2 of 4" in the heading. Gone when done or hidden.
- **Sign-in's two modes are tabs, not blocks:** white type over the dock's 2px cyan marker, so the white button below stays the only thing that says press me.

### Figures: the ledger
- The money is read like a statement (`SumStrip`, `.ledger`): each label and its note on the left, its figure on the right, so the amounts stand in one column and compare at a glance. Head and foot rules at 2px Hairline, 1px Hairline between rows. No box, no fill, no corner marks: nothing about it says tap. The key figure (the one the screen is about) is set heavier and larger, and nothing else. A row that opens something (Margin on the job home) is a button with a chevron, the only row that looks like one. From 560px the rows run in two columns.
- **Certified means agreed.** A valuation sent for review is "with client", not certified, until the client agrees it (or it's invoiced or paid); `isCertified` / `isWithClient` decide it for every screen and for Clerk. Each ledger names its basis once: Scope at base rates (its caption), Home and Vals with uplifts and without VAT; a VAT figure is only ever an invoice's own. Margin is "so far": costs so far against the job's value.
- **Where the money is (Valuations):** the ledger's whole, Contract + VOs, carries a 12px split bar of its parts, end to end with 2px of ground between them, the more settled the more filled: Paid in solid drafting white, Certified and unpaid in white hatching, With client (sent, not agreed) as a white outline (drawn, not yet signed), the open valuation in cyan (as on the job's line), Still to claim the empty track. Each part's row carries its swatch, so the ledger is the key and every figure is on the page, never behind a tap. All without VAT so the parts add up to the whole exactly: a payment against a VAT invoice counts less its VAT, its note gives what landed. Before the first valuation only the whole shows. Never orange: gold is for what needs you. No pie: the figures overlap (Certified holds Paid, Owed adds VAT) and lengths compare where angles don't.
- **One chart per screen: the job's line.** Progress is charted once, on the job's line under the header (solid white certified, i.e. agreed by the client; dashed white with the client; dashed cyan the open valuation), against the same worth as Vals (`jobWorth`), which keeps its length on a phone and drops its label underneath. A ledger never repeats progress as a bar along its foot: that reads as a scrollbar. The split bar answers a different question (where the money sits) and sits under its whole, keyed to its rows.

### Inputs / Fields
- **Style:** Ink Navy field, 1px Slate Edge, 1px corners, 50px tall; numbers and dates in Mono. Labels above in uppercase Ink 2.
- **Focus:** the border turns white; the caret is cyan.
- **Warn / Disabled:** a gold border with a gold hint led by the triangle; disabled is dashed on Milled Steel.

### Chips and Switches
- 0px corners, Slate Edge outline, white type; the chosen one is a white block. The two-way switch is the same, divided by a Slate Edge rule.

### Navigation
- **Phone (360px and up): the scooped dock.** A Milled Steel dock edged in Slate Edge, flat, square-cornered, its outline drawn as one path (`src/components/Dock.tsx`) so the scoops are part of its edge. Its four tabs, Home, Diary, Scope and Vals (three for operatives), share it around a middle column of their own for the capture key. The capture key is a 60px Blueprint Cyan disc with an ink plus, sitting in a scoop cut into the dock's top edge that follows its circle with a 5px gap and rounded shoulders: the one thing you can always do. The open tab rises into a second, smaller scoop: its icon in a 44px Milled Steel disc ringed 2px in cyan, its label white below; inactive tabs are Slate Note icon and label. Tap a tab and its scoop slides across (280ms, eased out, frame by frame); side by side, the two scoops run into one edge. While the page scrolls the + sinks and its scoop closes flat, both returning when it stops; with Clerk open there's no + and no open tab, so the dock is a plain bar. Reduced motion: everything jumps to place. No shadow anywhere (the round shapes are the capture key and the open-tab disc, by the owner's choice: the look of the 8 Nov reference). Under 360px, and as the desktop rail, the dock is the plain bar: tabs evenly spaced, a 22×2px cyan marker sliding along its bottom edge, the + key standing on its top edge. When the + opens the capture menu, the menu rises behind it and the plus turns a quarter and a half into an × (300ms) that closes the menu where the thumb already is. Clerk sits in the job's header beside Job setup, not in the dock.
- **Desktop:** the same as a 104px Milled Steel rail with a Hairline edge; the current tab carries a 2px cyan bar on its left, which slides down the rail. The capture disc heads the rail; its menu keeps its own ×.

### The Job Header and Certified Rail (signature)
- Solid Ink Navy, ruled underneath. The contract ref sits above the name as a mono line; the rail runs along the foot: certified in white, the open valuation dashed in cyan, a 1px tick at each valuation, the figure beside it in mono.

### The Selection (signature)
- The one live thing on a screen (the next step on the job home, the change waiting for Do it in Clerk: always something you act on, never a figure) is marked by four 12×2px cyan corner marks, 3px inside its edge, the way a drawing program marks what's selected. They close in from outside once (460ms, ease-out) and hold. While Clerk works, its status row carries the marks and they breathe. Under reduced motion they are simply there.

### Variations in the Scope
- **A house is one line, one tap** (office Scope): its number in white, "22 lines · 1 VO" in Slate Note on the same line, its value in mono on the right, and under it a 6px trade bar: each trade's share of the house's work in its trade core, a 2px line of that colour along the foot so every trade shows, filling solid as its lines are claimed, with the % claimed in mono at the end. One tap opens the house sheet: the house and value, the same bar, Tick all remaining, trade chips to jump (more than two trades), then every line already open under a trade heading that stays in view as you scroll (core, name, count, subtotal, Tick all). No second tap per trade. A location reads only when it says something: never "Property", never the trade again.
- A VO is a row of the house's work, above its scope lines and never folded away: the VO's number as a cyan outlined badge (no dot: the dot marks the open valuation), its code, where, the description, quantity and rate in mono, the client's court plate, and the same tick once priced. A house's row says "1 VO" beside its line count, so the house list still says it has extra work. Unpriced reads "unpriced", never £0.
- **A tab's ways in sit under its heading, never at the foot of a long list:** compact 44px buttons, left-aligned (`.tab-actions`, `.btn-sm`), the white block first. Scope has two: Add VO, and Import (one question: the scope or VOs). With no scope yet, Import takes the white block. Anything rarer goes in the ⋯ menu.

### Motion: what just happened
Motion explains a change you made or that arrived; nothing plays when a screen first opens, and nothing loops except an upload in progress. In: exponential ease-out (cubic-bezier(.16, 1, .3, 1)); out: a quicker ease-in. Transform, clip, stroke and opacity only, so an old phone outdoors keeps up. Under reduced motion the movement goes and the colour change that confirms it stays. (src/lib/motion.ts, styles.css "MOTION")
- **A tick moves the money:** the tick draws itself like a pen stroke (150ms); the job's dashed cyan valuation piece grows by the line's share (400ms, clipped so the dashes never stretch), the part just added lit solid cyan as it grows; Claimed and Still to do roll.
- **Figures roll:** a money total that changes rolls only the characters that changed, the rightmost first (380ms each, 28ms apart); a rise rolls up, a fall rolls down. Reduced motion: the new figure lit cyan for a moment.
- **From site:** a decided suggestion's button confirms in cyan, then the row folds shut (300ms) as the count rolls down; suggestions that arrive while you look come in 70ms apart under the corner marks, which close in, hold and fade.
- **A capture's upload:** a new photo develops in like a print (750ms); a 1.5px cyan line runs round its tile while it uploads (dashed and still with no signal), then closes solid and fades once it's up.
- **The capture key gets out of the way:** while the page scrolls it sinks into the dock's top edge at 70% (200ms), so it never sits on a row you're reading, and rises a moment after the scroll stops (340ms, ease-out). Reduced motion: it moves without the glide.
- **Paid:** the white tick square stamps in (180ms), its tick draws (200ms) and the row settles from Raised Steel.

### The Job Line (Diary) and the Week Line
- One spine of days: a Hairline behind today, a cyan line from today, a Slate Edge line ahead. Each day is a 48px mono date column, a 9px square node (today a filled cyan 11px square), then the day's site record, to-dos (with ticks) and key dates (led by their trade core). The week across all jobs on the jobs screen is the same line with each item's job named.

### The Valuation Week
- Two figures in a panel (last sent, next due) in mono, the "this week" line in gold, and "Wait till next month" as a ghost link. Quiet: the open valuation's figure is the live thing.

### Clerk (the assistant tab)
- What you said sits in a Steel Raised block; Clerk answers in plain text on the sheet; a change waits as a Steel Raised panel marked at its corners, with a white Do it and an outlined Cancel. The mic lights gold while recording.

### Sheets
- Milled Steel, 2px top corners, a Slate Edge edge, a 36×3px handle; the title is a cyan title line over a hairline. The sticky "unsaved" bar is a gold block with On-Signal type.

### Photo Mark-up
- An Ink Navy toolbar over the photo. Swatches are the drawing colours themselves (red, yellow, blue, white, black, kept for drawing on photos), ringed white when chosen.

### AI this month (Settings)
- The plan's name and the share used (figure in mono) on one line, a plain 8px rule under it filled drafting white to that share on Slate Edge; then site days left at the firm's own rate and today's Clerk questions, in Slate Note. Never credits, tokens or prices. A closing line says AI pauses and records carry on, and nothing is ever charged.
- Vals → From site says plainly when captures are with the reader ("2 site captures are with the reader. What they show arrives here, usually within the hour."), so a quiet panel never reads as nothing happening.

### How Mastor works (help)
- One sheet, the month as six ruled steps, each led by its Roman numeral in cyan (`.ref-roman`) like a valuation: the step's name in white, two or three lines of plain how-to in Ink 2. No screenshots, no tooltips, no tour.

### Plans and questions (front page)
- The three plans are ruled columns, not cards: Minerva carries the 2px cyan top rule and "Most firms choose this"; each plan's price is mono, with VAT and yearly underneath as a ruled list. Questions are plain details rows with a + that turns to − when open, answers in Ink 2.

### The Street Print (front page)
- Behind the header and headline, a real photograph of a terraced street printed like a cyanotype: its light in Prussian blue (#1B4A80, luminosity blend), printed dark enough on its own (no scrim, no fade) under the drafting grid, and cut off on a 1px Slate Edge rule just under the offer. Decorative and credited; measured over a pure white sky, the lede holds 6.8:1 and white type 9.7:1.

### Founding Register (front page)
- Fifty Roman-numeral places on a steel board inside its bounding box: free places outlined in Slate Edge, taken places filled #273449, the next place lit cyan with an ink numeral, the visitor's own place white with a cyan ring. The claim button is the white block naming the next numeral; the place count is mono.

### Opening Titles
- On Ink Navy: the copper arch draws itself, the keystone drops, MΛSTΘR rises letter by letter, a 1px white dimension line grows beneath it. Played once on first open.

## Do's and Don'ts

### Do:
- **Do** set every figure, amount, code, ref and quantity in JetBrains Mono with tabular numerals.
- **Do** keep to two signals: cyan for the selection, gold for what needs you; done is white.
- **Do** let the sign's shape carry the difference between overdue and to-do.
- **Do** draw each data block twice: its edge and a Hairline bounding box 3px outside.
- **Do** make the screen's primary action the white block, and outline everything else in Slate Edge (#64748B).
- **Do** mark the one live thing on a screen at its corners in cyan, and only that thing.
- **Do** keep small text at Slate Note (#8291A7) or brighter, 13px or larger.

### Don't:
- **Don't** add a third signal colour, or colour anything to decorate.
- **Don't** use #64748B for text: it is an edge colour.
- **Don't** add shadows, glows, blur or glass; depth is value and drawing.
- **Don't** use Mono for words, labels, headings or Roman refs.
- **Don't** round corners past 2px or draw pills.
- **Don't** add a kicker or eyebrow label above a heading.
- **Don't** draw a bounding box around a block that sits inside another block or a sheet.

## Guardrails (enforced)
Set by the owner on 4 Nov 2026 as zero tolerance, and checked on every test run by `tests/guardrails.test.ts`, so a change that breaks one fails the build:
1. **No decorative light.** No `backdrop-filter`, blur, frosted glass or milky overlays; no glowing orbs, radial blooms or halos; no shadow that blurs more than 4px. Depth comes from 1px rules, value steps and the bounding box.
2. **No gradient wallpaper, no SaaS purple.** No smooth or multi-stop gradients: only hard-edged patterns. Nothing in the purple or indigo range (the test rejects any hue from 245° to 320°). Surfaces are solid dark neutrals; colour is a signal only. Every colour is a token defined once in `:root`; no hex or rgba written into a screen.
3. **Industrial geometry.** Corners 4px at most (the design's own are 0–2px); no pills, no bubbles, no soft circular cards.
4. **One level of container.** No card inside a card; rows are divided by hairlines on a grid. No decorative icons, emoji or filler badges.
5. **Figures are mono and tabular.** Every amount, rate, quantity, percentage, code and ref is JetBrains Mono with tabular numerals, inside a sentence, a button or a note too (`src/components/Figs.tsx`: `fig`, `figs`); any digit left in Archivo is tabular. Text keeps its contrast at full strength: nothing fades by opacity.

Recorded exceptions, each named in the test: the capture key stays round (the owner's choice, kept on 4 Nov 2026); photo mark-up ink (red, yellow, blue, white, black) is drawn onto the client's photos, not the interface; the sign marks keep their circle and triangle shapes, because the shape carries the meaning; the sheet's dim is the Scrim token.
