# Mastor (web)

Site diary, variations and valuations for builders. React + Vite + TypeScript.
Runs in any browser; installable to the home screen.

- `npm install` · `npm run dev` · `npm run build`
- Deployed automatically by Vercel on every push to `main`.

**Status: test mode** — data is stored on the device (IndexedDB). `src/lib/db.ts` is the
only file that touches storage; a shared database replaces it later.

Rules carried over from the Android build (V2-Mastor):
- Never invent data. Missing qty = "not measured", missing rate = "unpriced", never £0.
- VO numbers are sequential per job (highest + 1), never reused.
- PO number blank until the client issues one; flagged until set.
- One way to do each thing.
