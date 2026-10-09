import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cinzel/500.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import App from './App'
import { PhotoPicker } from './screens/PhotoPicker'
import { Gate } from './screens/Gate'
import { Splash, shouldPlaySplash } from './components/Splash'
import { UpdateBar } from './components/UpdateBar'
import { useState } from 'react'
import './styles.css'
import { HOME, isBranchPreview, shouldGoHome } from './lib/host'
// One live address; branch previews stay where they are so changes can be checked before merging
if (shouldGoHome(location.hostname)) {
  location.replace(`https://${HOME}${location.pathname}${location.search}${location.hash}`)
}
if (isBranchPreview(location.hostname)) document.title = 'Preview · Mastor'
// #photos = cover photo picker, everything else = the app
function Root() {
  const [splash, setSplash] = useState(() => !location.hash && shouldPlaySplash())
  if (location.hash === '#photos') return <PhotoPicker />
  // the app loads underneath while the opening titles play
  return <>{<Gate><App /></Gate>}{splash && <Splash onDone={() => setSplash(false)} />}<UpdateBar /></>
}
window.addEventListener('hashchange', () => location.reload())
// The beam goes once round a main button when it's pressed — motion that means "got it", not decoration
document.addEventListener('pointerdown', e => {
  const b = (e.target as Element | null)?.closest?.('.btn-primary:not(:disabled)')
  if (!b || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  b.classList.remove('sweep'); void (b as HTMLElement).offsetWidth; b.classList.add('sweep')
}, { capture: true, passive: true })
document.addEventListener('animationend', e => { if (e.animationName === 'spinAng') (e.target as Element).classList.remove('sweep') }, true)
createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
