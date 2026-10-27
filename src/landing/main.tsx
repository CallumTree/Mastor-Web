import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cinzel/600.css'   // the wordmark only
import '@fontsource-variable/archivo/wdth.css'
import './landing.css'
import { Landing } from './Landing'

createRoot(document.getElementById('root')!).render(<StrictMode><Landing /></StrictMode>)
