import { createContext, useContext, useState } from 'react'

// 'coach' = poolside phone mode (big buttons, bottom tabs)
// 'analytics' = full desktop mode (sidebar, dashboards, reports)
const ModeContext = createContext(null)

export function ModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('ui_mode')
    if (saved === 'coach' || saved === 'analytics') return saved
    return window.innerWidth < 768 ? 'coach' : 'analytics'
  })

  const setUiMode = (m) => {
    localStorage.setItem('ui_mode', m)
    setMode(m)
  }

  return <ModeContext.Provider value={{ mode, setUiMode }}>{children}</ModeContext.Provider>
}

export const useMode = () => useContext(ModeContext)
