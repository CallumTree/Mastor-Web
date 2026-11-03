import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
// each test starts at the app's address with no job or tab kept in it (src/lib/place.ts)
afterEach(() => { history.replaceState(null, '', '/') })
// the test browser has no file URLs: a stand-in, so handing over a PDF (certificate, invoice) runs to the end
if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = () => 'blob:test'
if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = () => {}
// …and a download link does nothing, rather than the test browser trying to navigate to it
const anchorClick = HTMLAnchorElement.prototype.click
HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { if (!this.download) anchorClick.call(this) }
