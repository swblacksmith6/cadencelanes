import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarDays, Timer, UserCog, LogOut, Waves, Home,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useMode } from '../context/ModeContext.jsx'
import ModeSwitch from './ModeSwitch.jsx'
import { NoticeBar } from '../context/NoticeContext.jsx'

const sideLink = ({ isActive }) =>
  `flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
    isActive ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
  }`

const tabLink = ({ isActive }) =>
  `flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[11px] font-semibold transition ${
    isActive ? 'bg-sky-600 text-white' : 'text-slate-500'
  }`

export default function Layout() {
  const { user, logout } = useAuth()
  const { mode } = useMode()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // ── Coach mode: compact top bar + floating bottom tabs, built for poolside phones ──
  if (mode === 'coach') {
    return (
      <div className="flex min-h-dvh flex-col bg-slate-100">
        <header className="no-print sticky top-0 z-20 bg-slate-800 pt-safe">
          <div className="px-safe flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-2 text-white">
              <Waves className="h-5 w-5 shrink-0 text-sky-400" />
              <span className="truncate text-sm font-extrabold tracking-tight">{user?.club_name || 'Cadence Lanes'}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ModeSwitch dark />
              <button onClick={handleLogout} aria-label="Log out"
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="px-safe pointer-events-none absolute inset-x-0 top-full pt-2">
            <div className="pointer-events-auto"><NoticeBar /></div>
          </div>
        </header>

        <main className="px-safe flex-1 pt-4 pb-28">
          <Outlet />
        </main>

        <nav className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-20 pb-safe">
          <div className="pointer-events-auto mx-3 mb-3 flex gap-1 rounded-full border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur md:mx-auto md:max-w-md">
            <NavLink to="/dashboard" className={tabLink}>
              <Home className="h-5 w-5" /> Home
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
          </div>
        </nav>
      </div>
    )
  }

  // ── Analytics mode: full sidebar experience ──
  return (
    <div className="flex min-h-dvh bg-slate-100">
      <aside className="no-print sticky top-0 flex h-dvh w-60 shrink-0 flex-col bg-slate-800 p-4">
        <div className="mb-8 flex items-center gap-2 px-2 text-white">
          <Waves className="h-6 w-6 text-sky-400" />
          <span className="text-lg font-extrabold tracking-tight">Cadence Lanes</span>
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print relative z-20 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
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
        <div className="pointer-events-none absolute inset-x-0 top-full px-6 pt-2">
            <div className="pointer-events-auto"><NoticeBar /></div>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
