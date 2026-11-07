import { Smartphone, Monitor } from 'lucide-react'
import { useMode } from '../context/ModeContext.jsx'

// Only shown on wide screens. A phone-width screen always uses the phone layout.
export default function ModeSwitch({ dark = false }) {
  const { preferred, narrow, setUiMode } = useMode()
  if (narrow) return null
  const base = 'flex items-center rounded-full p-2 transition'
  const idle = dark ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-700'

  return (
    <div className={`flex rounded-full p-0.5 ${dark ? 'bg-slate-700' : 'bg-slate-100'}`}>
      <button onClick={() => setUiMode('coach')} title="Phone mode" aria-label="Phone mode"
        className={`${base} ${preferred === 'coach' ? 'bg-sky-600 text-white shadow' : idle}`}>
        <Smartphone className="h-4 w-4" />
      </button>
      <button onClick={() => setUiMode('analytics')} title="Desktop mode" aria-label="Desktop mode"
        className={`${base} ${preferred === 'analytics' ? 'bg-sky-600 text-white shadow' : idle}`}>
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  )
}
