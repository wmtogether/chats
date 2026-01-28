import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Main from './Main.tsx'
import { AuthProvider } from './Library/Authentication/AuthContext.tsx'
import './Styles/index.css'
import '@fontsource-variable/inter';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Main />
    </AuthProvider>
  </StrictMode>,
)