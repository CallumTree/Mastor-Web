---
version: 1
slug: "src-screens-plan-tsx"
primary_target: "src/screens/Plan.tsx"
related_targets: ["src/screens/Diary.tsx","src/screens/JobsList.tsx"]
---

# Surface: the job line (Diary) and the week line (jobs screen)

Mode: Operate. Audience: the director in the office and site managers/operatives on a phone, gloves on, patchy signal. Job: book key dates ("Kitchen refit starts · No. 6 · Mon 2 Nov"), keep the to-dos that lead up to them ("Speak to tenant about the 2 Nov start"), tick them off, and see every job's week from the jobs screen. Constraints: operatives see everything except office-only items; property and trade optional on any item; Mastor only (no phone-calendar sync yet); stored as diary records (types todo / event), so no new table.

## Direction contract

THESIS: A job is one line of days. Site days behind, today lit, booked dates and to-dos ahead, on a single spine; it refuses the category default of a month grid beside a separate checklist.

OWN-WORLD: White board, ink type, Archivo at 112% for day labels. The spine is a one-device-pixel line: Hairline behind today, neon at today (a black-filled node ringed in neon), volt ahead (hollow volt nodes). Trade core bands lead dated items; to-dos use the app's tick; late is the red sign mark on its pastel; links are volt tint chips.

STORY: Open Diary and see what is late, what is today and what is coming, then tick a to-do or follow its link to the date it serves (and back). The jobs screen shows the same line for the week across all jobs.

FIRST VIEWPORT: Tab title DIARY with + To-do and + Date at the right; a quiet tray "N to-dos with no date"; the line from the last site day through today into the next days; the dock below.

FORM: The one timeline, number 1 of 7 on the ordered list (dealt as the third card); seed key bf71006f (degraded roll, no challengers).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
