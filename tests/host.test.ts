import { isBranchPreview, shouldGoHome } from '../src/lib/host'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
ok(!shouldGoHome('mastor-web.vercel.app'), 'live address stays')
ok(shouldGoHome('mastor-abc123xyz-callumtree-1200.vercel.app'), 'one-off deployment link goes to the live address')
ok(!shouldGoHome('mastor-web-git-claude-admiring-davinci-a4jumi-callumtree-1200.vercel.app'), 'branch preview stays, so it can be checked before merging')
ok(isBranchPreview('mastor-web-git-main-callumtree-1200.vercel.app'), 'branch alias recognised')
ok(!shouldGoHome('localhost') && !isBranchPreview('localhost'), 'local development untouched')
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
