---
name: Mastor
description: Job money for small UK builders, read like a field instrument. A void-black ground, charcoal panels and 1px rules carry the structure, white type carries the facts, and colour is only ever a lit signal with one meaning.
colors:
  void: "#0B0C0E"
  slate: "#14171F"
  slate-2: "#1B1F29"
  rule: "#262C38"
  rule-ctl: "#687488"
  white: "#FFFFFF"
  ink-2: "#B4BDCA"
  meta: "#7E8B9F"
  red: "#FF5247"
  amber: "#FFB703"
  cyan: "#00F0FF"
  emerald: "#10B981"
  on-signal: "#0B0C0E"
  white-press: "#DCE1E8"
  arch-copper: "#C97B3F"
  core-clay: "#C46A49"
  core-bronze: "#B07D36"
  core-olive: "#8A9348"
  core-teal: "#2A9C9C"
  core-slate: "#7187A6"
  core-violet: "#9670BF"
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
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 87.5"
  label:
    fontFamily: "'Archivo Variable', Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0.06em"
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
  sm: "2px"
  r: "3px"
  md: "4px"
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
    backgroundColor: "{colors.red}"
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
    backgroundColor: "{colors.white}"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.md}"
    width: "52px"
    height: "46px"
  sheet:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "12px 18px 28px"
---

# Design System: Mastor

## Overview

**Creative North Star: "The Field Instrument"**

The app reads like an instrument a site manager carries on a walk round the job: a void-black ground, charcoal panels drawn with 1px rules, white type for every fact, and colour only where a light would be lit on a real panel. It is dense on purpose. Figures, refs and codes are set in a tabular mono so a column of money lines up to the penny; labels are short uppercase markings in a semi-condensed grotesque; corners are cut at 2–4px. Nothing glows, nothing floats on a shadow, nothing is tinted to look friendly.

Colour follows the avionics order and nothing else: red is a warning (stop, overdue, refused), amber is caution and the active state (to-do, the next step, recording, the one live thing), cyan is advisory (variations, discrepancies, a record Claude changed), emerald is normal (done, approved, matched to the contract). The primary action is a white block with black type, the brightest thing on any screen because it is the one you press; everything else you operate is outlined.

The user chose this world in November 2026 for one-handed use on site in direct sun, replacing the light white-and-neon look. The brand stays: the MΛSTΘR wordmark in Cinzel, the copper arch, Roman numerals for valuations and VOs.

**Key Characteristics:**
- Void ground, charcoal panels, 1px rules; no shadows at rest
- White for facts, precision grey for metadata, never grey text below 4.5:1
- Four signal colours, one meaning each, always as a lit mark or a 1px frame
- Tabular mono for every figure, code, ref, quantity and date number
- Uppercase semi-condensed micro-headers; section heads in [ brackets ]
- The reticle: four amber corner brackets lock onto the one live thing on a screen

## Colors

A near-black instrument with four lit signals; every neutral is cool and every signal is fully saturated.

### Primary
- **White** (#FFFFFF): every fact (names, figures, descriptions), the primary button's block, the focus ring, the nav's current tab, today on the job's line. 17.9:1 on a panel.

### Signals
- **Warning Red** (#FF5247): overdue money, a late to-do, refused or rejected, destructive actions. 5.6:1 on a panel; type on it is On-Signal black.
- **Sodium Amber** (#FFB703): to-do and caution marks, the next step, the open valuation, the mic while recording, the reticle, the caret and text selection. 10.3:1 on a panel.
- **Cyan Advisory** (#00F0FF): changed by Claude, discrepancies against the framework (rate check). 12.7:1 on a panel.
- **Precision Emerald** (#10B981): done, claimed, paid, the certified part of the job's rail, ticks in the valuation. 7.1:1 on a panel.

### Trade Cores (categorical)
- Clay #C46A49, Bronze #B07D36, Olive #8A9348, Teal #2A9C9C, Slate #7187A6, Violet #9670BF, Rose #CC6994, Graphite #80858D: one per trade, only ever a 14×5px band beside the trade's name (`src/lib/trade.ts`). They identify, they never signal.

### Neutral
- **Void** (#0B0C0E): the ground, inputs, the inside of a status tag, the job header.
- **Slate** (#14171F): panels, the dock and rail, sheets.
- **Slate Raised** (#1B1F29): an open, hovered or hot row; Clerk's "you said" block.
- **Rule** (#262C38): structure only: dividers, panel edges, the spine behind today.
- **Control Edge** (#687488): the edge of anything you operate (inputs, outlined buttons, chips, ticks). 3.8:1 on a panel, for WCAG 1.4.11.
- **Ink 2** (#B4BDCA): quieter reading text and field labels. 9.5:1.
- **Precision Grey** (#7E8B9F): metadata and labels. 5.2:1 on a panel, 4.8:1 on a raised row; never used below that.
- **On-Signal** (#0B0C0E): type and marks laid on a lit block (the white button, a red or amber plate, an emerald tick).
- **Arch Copper** (#C97B3F): the app icon's arch and the opening titles only.

### Named Rules
**The One Meaning Rule.** Red warns, amber cautions and marks what is active, cyan advises, emerald confirms. A colour is never used for anything outside its meaning, and nothing is coloured to decorate.

**The Lit Signal Rule.** A status is a mark (red disc with a bar, amber triangle, amber disc with an arrow, emerald square with a tick) or a 1px frame in the signal colour with capitals in the same colour, on Void. Never a tinted chip, never a pastel ground.

**The White Block Rule.** The primary action on a screen is a white block with On-Signal type. Everything else you can press is outlined in Control Edge and lights to white on hover.

**The Dark Instrument Rule.** The app is dark only (`color-scheme: only dark`): native controls, pickers and scrollbars follow. The client's PDFs stay print-white; the front page keeps its own register until it is redesigned (`.impeccable/surfaces/src-landing-landing-tsx.md`, `src/landing/landing.css`).

## Typography

**UI Font:** Archivo Variable (with system-ui), at normal width for reading and 87.5% for markings
**Data Font:** JetBrains Mono Variable (with ui-monospace)
**Wordmark:** Cinzel 600, MΛSTΘR only

**Character:** a working grotesque that tightens for headings and narrows into uppercase markings, beside a tabular mono that carries every number the client's QS will check.

### Hierarchy
- **Headline figure** (Mono 560, clamp(32px, 10vw, 44px), -0.04em): the dashboard's owed figure.
- **Job name / Tab title** (Archivo 720, 26–28px, 1.05–1.08, -0.02em): the one heavy line on a screen.
- **Figure** (Mono 520, clamp(22px, 6.4vw, 28px), -0.03em): figure grids and summary strips, fitted to their cell.
- **Title** (Archivo 700, 16px, 1.25, -0.01em): an action row's title, a sheet's question, a property.
- **Body** (Archivo 450, 16px, 1.45): reading text; Clerk's answers to 62ch.
- **Section head** (Archivo 87.5% 700, 14px, 0.08em, uppercase, in [ brackets ]): ACTION NEEDED, NOTES & DECISIONS.
- **Label** (Archivo 87.5% 650, 13px, 0.06em, uppercase, Precision Grey): figure labels, register heads, field labels (in Ink 2).
- **Status** (Archivo 87.5% 700, 13px, 0.05em, uppercase): tags and plates.
- **Amount / Code** (Mono 520 / 450, 13–17px): amounts in rows, SoR codes, contract refs, dates on the line.

### Named Rules
**The Mono Is Data Rule.** JetBrains Mono sets figures, amounts, codes, refs, quantities and date numbers, with tabular numerals so decimals align. Never words, never labels, never headings.

**The Roman Ref Rule.** VAL III and VO XII are markings, not data: Archivo 87.5% at 720 with 0.04em tracking, never Mono.

**The 13px Floor Rule.** Nothing on screen is smaller than 13px; it is read outdoors, in glare. Small text is 450 weight or heavier.

**The Fit to the Box Rule.** A figure sizes itself to its cell: the cell is a size container, `--len` carries the character count, and a mono figure is 0.6em a character, down to a 15px floor, then it breaks.

## Layout

One column on a phone (16px gutters, 720px max), a 104px rail and a 960px column from 1024px. Panels are ruled registers: rows divided by 1px Rule, never cards inside cards. Rhythm: 6px inside groups, 12px between rows of controls, 28px above a section head and 10px below it. Touch targets are 44px or more everywhere (52px for buttons) for gloves. Under 360px button pairs stack and the dock shares its width evenly; under 300px the dock goes to two rows.

## Elevation & Depth

Flat. Depth is told by value: Void ground, Slate panels, Slate Raised for what is open, hovered or hot, and a dimmed backdrop (black at 72%) under sheets. The only shadow in the app is a drop shadow under the white play mark laid over a video frame.

### Named Rules
**The No Glow Rule.** Signals are flat fills and flat lines. No glow, no blur, no glass, no gradients except the dashed open-valuation segment of the rail.

## Shapes

Razor corners: 2px for tags, chips, ticks and thumbnails, 3px for inputs, 4px for panels, buttons, rows, sheets and the dock. Squares replace circles everywhere except the sign marks (the stop and next discs are sign shapes, kept for colour-blind reading): the job line's day nodes, status dots and the "cancelled" mark are squares. Every line is 1px.

## Components

### Buttons
- **Shape:** 4px corners, 52px tall, full width on a phone.
- **Primary:** White block, On-Signal 650 type; hover #DCE1E8; press moves down 1px.
- **Secondary:** transparent, white type, Control Edge border; hover lifts to Slate Raised with a white border.
- **Ghost:** Ink 2 text with a Control Edge underline that turns white on hover.
- **Danger:** Warning Red block with On-Signal type.
- **Focus:** a 2px white ring at 2px offset (3px on the white block).

### Status Tags (badges and plates)
- **Style:** Void inside, 1px frame and capitals in the signal colour; a plate leads with its sign mark, a badge with a 6px square.
- **Variants:** emerald (done, claimed, paid), red (overdue, late), amber (to-do, the open valuation), cyan (by Claude), Ink 2 on Control Edge (neutral states), Precision Grey on Rule (waiting on someone else).

### Action Rows
- Slate rows, 64px tall, led by their sign mark, title in white, hint in Precision Grey, chevron right. A stop row's frame is red; a next-step row's frame is amber; the live next step drops its frame for the reticle.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** Slate on Void.
- **Shadow Strategy:** none.
- **Border:** 1px Rule.
- **Internal Padding:** 14px; registers carry their own 12–14px row padding.

### Figures and Summary Strips
- Ruled grids of mono figures over uppercase labels; the hot cell sits on Slate Raised inside the reticle. The bar under a strip is 3px: emerald on Rule.

### Inputs / Fields
- **Style:** Void field, 1px Control Edge, 3px corners, 50px tall; numbers and dates in Mono. Labels above in uppercase Ink 2.
- **Focus:** the border turns white; the caret is amber.
- **Warn / Disabled:** an amber border with an amber hint led by the triangle; disabled is dashed on Slate.

### Chips and Switches
- 2px corners, Control Edge outline, white type; the chosen one is a white block. The two-way switch is the same, divided by a Control Edge rule.

### Navigation
- **Phone:** a Slate dock with a Control Edge border, 4px corners, at the foot of the page. Tabs are Precision Grey markings; the current one is white with a 22×2px white bar at its top edge. The capture key is a white block with a drawn plus.
- **Desktop:** the same as a 104px Slate rail with a Rule edge; the current tab carries a 2px white bar on its left.

### The Job Header and Certified Rail (signature)
- Void, ruled underneath. The contract ref sits above the name as a mono telemetry line; the rail runs along the foot: certified in emerald, the open valuation dashed in amber, a 1px white tick at each valuation, the figure beside it in mono.

### The Reticle (signature)
- The one live thing on a screen (the next step on the job home, the hot figure in a strip, the change waiting for Do it in Clerk) is framed by four 12×2px amber corner brackets, 3px inside its edge. They close in from outside once (460ms, ease-out) like a camera's focus lock, and hold. While Clerk works, its status row carries the reticle and it breathes. Under reduced motion it is simply there.

### The Job Line (Diary) and the Week Line
- One spine of days: a Rule line behind today, a white line from today, a Control Edge line ahead. Each day is a 48px mono date column, a 9px square node (today a filled white 11px square), then the day's site record, to-dos (with ticks) and key dates (led by their trade core). The week across all jobs on the jobs screen is the same line with each item's job named.

### The Valuation Week
- Two figures in a panel (last sent, next due) in mono, the "this week" line in amber, and "Wait till next month" as a ghost link. Quiet: the open valuation's figure is the live thing.

### Clerk (the assistant tab)
- What you said sits in a Slate Raised block; Clerk answers in plain text on the ground; a change waits as a Slate Raised panel locked in the reticle with a white Do it and an outlined Cancel. The mic lights amber while recording.

### Sheets
- Slate, 4px top corners, a Control Edge edge, a 36×3px handle; the title is a bracketed section head. The sticky "unsaved" bar is an amber block with On-Signal type.

### Photo Mark-up
- A Void toolbar over the photo. Swatches are the drawing colours themselves (red, yellow, blue, white, black, kept for drawing on photos), ringed white when chosen.

### Opening Titles
- On Void: the copper arch draws itself, the keystone drops, MΛSTΘR rises letter by letter, a 1px white dimension line grows beneath it. Played once on first open.

## Do's and Don'ts

### Do:
- **Do** set every figure, amount, code, ref and quantity in JetBrains Mono with tabular numerals.
- **Do** keep each signal colour to its one meaning: red warning, amber caution and active, cyan advisory, emerald normal.
- **Do** draw a status as a sign mark or a 1px frame with capitals in its colour, on Void.
- **Do** make the screen's primary action the white block, and outline everything else in Control Edge (#687488).
- **Do** give the one live thing on a screen the amber reticle, and only that thing.
- **Do** keep corners at 2–4px and every line at 1px.
- **Do** keep metadata at Precision Grey (#7E8B9F) or brighter, 13px or larger.

### Don't:
- **Don't** tint a surface with a signal colour or use a pastel status chip.
- **Don't** add shadows, glows, blur or glass; depth is Void, Slate and Slate Raised.
- **Don't** use Mono for words, labels, headings or Roman refs.
- **Don't** use amber, cyan or emerald to decorate, or a signal colour for the current tab.
- **Don't** round corners past 4px or draw pills.
- **Don't** add a kicker or eyebrow label above a heading.
- **Don't** put grey text on Slate Raised darker than Precision Grey.
