import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// The app mounted, so the "needs the dev server" fallback card in index.html is not needed.
document.getElementById('devnotice')?.remove()
