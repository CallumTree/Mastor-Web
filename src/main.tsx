import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ButtonLab } from './screens/ButtonLab'
import './styles.css'
// Data is stored per web address, so there must only ever be ONE address. Vercel's deployment and
// branch links (mastor-xxxx-callumtree-1200.vercel.app) would open an empty app — send them home.
const HOME = 'mastor-web.vercel.app'
if (location.hostname.endsWith('.vercel.app') && location.hostname !== HOME) {
  location.replace(`https://${HOME}${location.pathname}${location.search}${location.hash}`)
}
// #lab = style lab (design experiments), everything else = the app
const Root = () => (location.hash === '#lab' ? <ButtonLab /> : <App />)
window.addEventListener('hashchange', () => location.reload())
createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
