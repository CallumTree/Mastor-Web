import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ButtonLab } from './screens/ButtonLab'
import './styles.css'
// #lab = style lab (design experiments), everything else = the app
const Root = () => (location.hash === '#lab' ? <ButtonLab /> : <App />)
window.addEventListener('hashchange', () => location.reload())
createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
