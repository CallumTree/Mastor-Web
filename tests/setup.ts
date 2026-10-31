import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
// each test starts at the app's address with no job or tab kept in it (src/lib/place.ts)
afterEach(() => { history.replaceState(null, '', '/') })
