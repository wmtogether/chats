import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Main from './Main.tsx'
import './Styles/index.css'
import '@fontsource-variable/inter';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Main />
  </StrictMode>,
)