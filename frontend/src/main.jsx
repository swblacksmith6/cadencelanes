import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ModeProvider } from './context/ModeContext.jsx'
import { NoticeProvider } from './context/NoticeContext.jsx'
import './index.css'
import { applyTextSize } from './utils/textSize.js'

applyTextSize()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ModeProvider>
          <NoticeProvider>
            <App />
          </NoticeProvider>
        </ModeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
