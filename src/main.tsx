import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cinzel/500.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import App from './App'
import { ButtonLab } from './screens/ButtonLab'
import { PhotoPicker } from './screens/PhotoPicker'
import { Gate } from './screens/Gate'
import { Splash, shouldPlaySplash } from './components/Splash'
import { useState } from 'react'
import './styles.css'
// Data is stored per web address, so there must only ever be ONE address. Vercel's deployment and
// branch links (mastor-xxxx-callumtree-1200.vercel.app) would open an empty app — send them home.
const HOME = 'mastor-web.vercel.app'
if (location.hostname.endsWith('.vercel.app') && location.hostname !== HOME) {
  location.replace(`https://${HOME}${location.pathname}${location.search}${location.hash}`)
}
// #lab = style lab (design experiments), everything else = the app
function Root() {
  const [splash, setSplash] = useState(() => !location.hash && shouldPlaySplash())
  if (location.hash === '#lab') return <ButtonLab />
  if (location.hash === '#photos') return <PhotoPicker />
  // the app loads underneath while the opening titles play
  return <>{<Gate><App /></Gate>}{splash && <Splash onDone={() => setSplash(false)} />}</>
}
window.addEventListener('hashchange', () => location.reload())
createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
