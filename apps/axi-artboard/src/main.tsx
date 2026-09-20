import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// CSS pipeline order matters: tailwind first (so utilities + @theme
// tokens resolve), then the SCSS index (which @use's tokens.scss).
import './styles/tailwind.css'
import './index.scss'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
