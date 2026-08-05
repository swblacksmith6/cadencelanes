import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarDays, Timer, UserCog, LogOut, Waves, Home,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useMode } from '../context/ModeContext.jsx'
import ModeSwitch from './ModeSwitch.jsx'

const sideLink = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
  }`

const tabLink = ({ isActive }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
    isActive ? 'text-sky-600' : 'text-slate-400'
  }`

export default function Layout() {
  const { user, logout } = useAuth()
  const { mode } = useMode()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // ── Coach mode: compact top bar + bottom tabs, built for poolside phones ──
  if (mode === 'coach') {
    return (
      <div className="flex min-h-screen flex-col bg-slate-100">
        <header className="no-print flex items-center justify-between bg-slate-800 px-4 py-2.5">
          <div className="flex items-center gap-2 text-white">
            <Waves className="h-5 w-5 text-sky-400" />
            <span className="max-w-40 truncate text-sm font-bold">{user?.club_name || 'SwimAcademy'}</span>
          </div>
          <div className="flex items-center gap-2">
            <ModeSwitch dark />
            <button onClick={handleLogout} className="p-2 text-slate-300 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-24">
          <Outlet />
        </main>

        <nav className="no-print fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <NavLink to="/dashboard" className={tabLink}>
            <Home className="h-5 w-5" /> Today
          </NavLink>
          <NavLink to="/sessions" className={tabLink}>
            <CalendarDays className="h-5 w-5" /> Sessions
          </NavLink>
          <NavLink to="/timings/entry" className={tabLink}>
            <Timer className="h-5 w-5" /> Timings
          </NavLink>
          <NavLink to="/students" className={tabLink}>
            <Users className="h-5 w-5" /> Students
          </NavLink>
        </nav>
      </div>
    )
  }

  // ── Analytics mode: full sidebar experience ──
  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="no-print flex w-56 flex-col bg-slate-800 p-4">
        <div className="mb-8 flex items-center gap-2 px-2 text-white">
          <Waves className="h-6 w-6 text-sky-400" />
          <span className="text-lg font-bold">SwimAcademy</span>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink to="/dashboard" className={sideLink}>
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </NavLink>
          <NavLink to="/students" className={sideLink}>
            <Users className="h-4 w-4" /> Students
          </NavLink>
          {user?.role === 'head_coach' && (
            <NavLink to="/coaches" className={sideLink}>
              <UserCog className="h-4 w-4" /> Coaches
            </NavLink>
          )}
          <NavLink to="/sessions" className={sideLink}>
            <CalendarDays className="h-4 w-4" /> Sessions
          </NavLink>
          <NavLink to="/timings/entry" className={sideLink}>
            <Timer className="h-4 w-4" /> Timings
          </NavLink>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div>
            <div className="font-semibold text-slate-800">{user?.club_name || 'My Club'}</div>
            <div className="text-xs text-slate-500">
              {user?.name} · {user?.role === 'head_coach' ? 'Head Coach' : 'Assistant Coach'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ModeSwitch />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
