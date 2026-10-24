import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cinzel/600.css'   // the wordmark only
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import App from './App'
import { Gate } from './screens/Gate'
import { Splash, shouldPlaySplash } from './components/Splash'
import { UpdateBar } from './components/UpdateBar'
import { ProblemBar, ProblemBoundary } from './components/Problem'
import { useState } from 'react'
import './styles.css'
import { HOME, isBranchPreview, shouldGoHome } from './lib/host'
// One live address; branch previews stay where they are so changes can be checked before merging
if (shouldGoHome(location.hostname)) {
  location.replace(`https://${HOME}${location.pathname}${location.search}${location.hash}`)
}
if (isBranchPreview(location.hostname)) document.title = 'Preview · Mastor'
// everything renders the app
function Root() {
  const [splash, setSplash] = useState(() => !location.hash && shouldPlaySplash())
  // the app loads underneath while the opening titles play
  return <><ProblemBoundary><Gate><App /></Gate></ProblemBoundary>{splash && <Splash onDone={() => setSplash(false)} />}<UpdateBar /><ProblemBar /></>
}
window.addEventListener('hashchange', () => location.reload())
// local-first: ask the browser not to clear Mastor's data when the phone runs low on space
// (granted quietly for an installed app; asked only once it's installed, so no prompt on a first visit)
if (matchMedia('(display-mode: standalone)').matches) navigator.storage?.persisted?.().then(p => { if (!p) navigator.storage.persist().catch(() => {}) }).catch(() => {})
createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
