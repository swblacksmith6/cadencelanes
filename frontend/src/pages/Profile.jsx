import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useMode } from '../context/ModeContext.jsx'
import { TEXT_SIZES, getTextSize, setTextSize } from '../utils/textSize.js'

const ROLE_LABEL = { head_coach: 'Head Coach', assistant_coach: 'Assistant Coach' }

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?'

function Choice({ name, label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label key={o.id}
          className="cursor-pointer rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition has-[:checked]:bg-sky-600 has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sky-500">
          <input type="radio" name={name} value={o.id} checked={value === o.id}
            onChange={() => onChange(o.id)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  )
}

export default function Profile() {
  const { user, logout } = useAuth()
  const { preferred, narrow, setUiMode } = useMode()
  const navigate = useNavigate()
  const [size, setSize] = useState(getTextSize)

  const pickSize = (id) => {
    setTextSize(id)
    setSize(id)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="mx-auto max-w-md space-y-3 md:space-y-4">
      <h1 className="text-lg font-bold tracking-tight text-slate-800 md:text-2xl md:font-extrabold">Profile</h1>

      <section className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm md:p-4">
        <div aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-600 text-lg font-bold text-white">
          {initials(user?.name)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-slate-800">{user?.name}</div>
          <div className="text-sm text-slate-500">{ROLE_LABEL[user?.role] || user?.role}</div>
          <div className="truncate text-sm text-slate-500">{user?.club_name}</div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-3 shadow-sm md:p-4">
        <h2 className="text-sm font-semibold text-slate-800">Settings</h2>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Text size</div>
          <Choice name="text-size" label="Text size" options={TEXT_SIZES} value={size} onChange={pickSize} />
        </div>

        {!narrow && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-500">Layout</div>
            <Choice name="layout" label="Layout" value={preferred} onChange={setUiMode}
              options={[{ id: 'coach', label: 'Phone' }, { id: 'analytics', label: 'Desktop' }]} />
          </div>
        )}
      </section>

      <button onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-white py-3 text-sm font-semibold text-red-600 hover:bg-red-50">
        <LogOut className="h-4 w-4" /> Log out
      </button>
      <p className="text-center text-xs text-slate-500">Signing in on another device ends this session.</p>
    </div>
  )
}
