#!/bin/sh
# Test → build → push. Stops at the first failure; nothing ships unless every test passes.
set -e
npx tsc --noEmit
npm test > /tmp/test.log 2>&1 || { grep -E "✗|×|→|failed" /tmp/test.log | head -20; echo "TESTS FAILED — not pushing"; exit 1; }
grep -E "[0-9]+ passed, [0-9]+ failed|Tests .*passed" /tmp/test.log
npm run build > /tmp/build.log 2>&1 || { tail -20 /tmp/build.log; echo "BUILD FAILED — not pushing"; exit 1; }
git add -A
git commit -q -m "$1"
git push -q
git log --oneline -1
