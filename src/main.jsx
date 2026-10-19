import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ChibiLab } from './ui/ChibiLab.jsx'
import './index.css'
import { installPerf } from './lib/perf'

installPerf()                 // D5: performance mode before the first frame

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/[?&]chibilab\b/.test(window.location.search) ? <ChibiLab /> : <App />}
  </React.StrictMode>
)

// The app mounted, so the "needs the dev server" fallback card in index.html is not needed.
document.getElementById('devnotice')?.remove()
