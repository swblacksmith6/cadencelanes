import { createContext, useContext, useEffect, useState } from 'react'

// 'coach' = poolside phone layout (big buttons, bottom tabs)
// 'analytics' = full desktop layout (sidebar, dashboards, reports)
//
// On a phone-width screen the layout is always 'coach', whatever was chosen
// before, because the desktop layout cannot fit. `mode` is what the UI should
// render now; `preferred` is the saved choice used by the switch on wide screens.
const ModeContext = createContext(null)

const NARROW_QUERY = '(max-width: 767px)'

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => !!window.matchMedia?.(NARROW_QUERY).matches)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(NARROW_QUERY)
    const onChange = (e) => setNarrow(e.matches)
    setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

export function ModeProvider({ children }) {
  const narrow = useIsNarrow()
  const [preferred, setPreferred] = useState(() => {
    const saved = localStorage.getItem('ui_mode')
    if (saved === 'coach' || saved === 'analytics') return saved
    return window.innerWidth < 768 ? 'coach' : 'analytics'
  })

  const setUiMode = (m) => {
    localStorage.setItem('ui_mode', m)
    setPreferred(m)
  }

  const mode = narrow ? 'coach' : preferred

  return (
    <ModeContext.Provider value={{ mode, preferred, narrow, setUiMode }}>
      {children}
    </ModeContext.Provider>
  )
}

export const useMode = () => useContext(ModeContext)
