import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, domAnimation } from 'motion/react'
import { App } from './app/App'
import { watchInstallPrompt } from './platform/capabilities'
import './index.css'

// Registered before mount: `beforeinstallprompt` can fire very early, and a
// listener attached after the fact simply never sees it.
watchInstallPrompt()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root element is missing from index.html')

createRoot(rootElement).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <App />
    </LazyMotion>
  </StrictMode>,
)
