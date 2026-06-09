import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import $ from 'jquery'
import './index.css'
import App from './App.tsx'

(window as any).global = window;
(window as any).jQuery = $;
(window as any).$ = $;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
