import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, CalendarDays, Percent, Plus, Sunrise, Sunset, Timer, ChevronRight } from 'lucide-react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useMode } from '../context/ModeContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function Dashboard() {
  const { user } = useAuth()
  const { mode } = useMode()
  const navigate = useNavigate()
  const [students, setStudents] = useState(null)
  const [todaySessions, setTodaySessions] = useState([])
  const [weekSessions, setWeekSessions] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [st, ts, ws] = await Promise.all([
          api.get(`/club/${user.club_id}/students`),
          api.get(`/club/${user.club_id}/sessions`, { params: { from: today(), to: today() } }),
          api.get(`/club/${user.club_id}/sessions`, { params: { from: daysAgo(7), to: today() } }),
        ])
        setStudents(st.data)
        setTodaySessions(ts.data)
        setWeekSessions(ws.data)
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load dashboard')
      }
    }
    load()
  }, [user.club_id])

  if (error) return <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
  if (!students) return <LoadingSpinner />

  const weekTotal = weekSessions.reduce((n, s) => n + s.total_count, 0)
  const weekPresent = weekSessions.reduce((n, s) => n + s.present_count, 0)
  const weekPct = weekTotal ? Math.round((weekPresent / weekTotal) * 100) : 0

  const hasMorning = todaySessions.some((s) => s.session_type === 'morning')
  const hasEvening = todaySessions.some((s) => s.session_type === 'evening')

  const createSession = async (type) => {
    try {
      const res = await api.post(`/club/${user.club_id}/sessions`, {
        session_date: today(),
        session_type: type,
      })
      navigate(`/sessions/${res.data.id}/attendance`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create session')
    }
  }

  // ── Coach mode: big-button poolside home ──
  if (mode === 'coach') {
    const tile = 'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.99]'
    const iconWrap = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl'
    return (
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-slate-800">Today</h1>

        {['morning', 'evening'].map((type) => {
          const s = todaySessions.find((x) => x.session_type === type)
          const Icon = type === 'morning' ? Sunrise : Sunset
          const color = type === 'morning' ? 'bg-amber-100 text-amber-600' : 'bg-sky-100 text-sky-600'
          return s ? (
            <button key={type} onClick={() => navigate(`/sessions/${s.id}/attendance`)}
              className={`${tile} bg-white shadow-sm active:bg-slate-50`}>
              <span className={`${iconWrap} ${color}`}><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold capitalize text-slate-800">{type} session</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          ) : (
            <button key={type} onClick={() => createSession(type)}
              className={`${tile} border-2 border-dashed border-slate-300 bg-white/60 active:bg-white`}>
              <span className={`${iconWrap} ${color}`}><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold capitalize text-slate-700">Start {type} session</div>
              </div>
              <Plus className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          )
        })}

        <button onClick={() => navigate('/timings/entry')}
          className={`${tile} bg-sky-600 text-white shadow-sm active:bg-sky-700`}>
          <span className={`${iconWrap} bg-white/15`}><Timer className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">Record Timings</div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-sky-200" />
        </button>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </div>
    )
  }

  // ── Analytics mode: full dashboard ──
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<Users className="h-6 w-6 text-sky-600" />} label="Active students" value={students.length} />
        <StatCard icon={<CalendarDays className="h-6 w-6 text-sky-600" />} label="Today's sessions" value={todaySessions.length} />
        <StatCard icon={<Percent className="h-6 w-6 text-sky-600" />} label="This week's attendance" value={weekTotal ? `${weekPct}%` : '—'} />
      </div>

      <div className="flex flex-wrap gap-3">
        {!hasMorning && (
          <button onClick={() => createSession('morning')} className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600">
            <Sunrise className="h-4 w-4" /> Create Morning Session
          </button>
        )}
        {!hasEvening && (
          <button onClick={() => createSession('evening')} className="flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-600">
            <Sunset className="h-4 w-4" /> Create Evening Session
          </button>
        )}
        <Link to="/students/new" className="flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Add Student
        </Link>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Students</h2>
          <Link to="/students" className="text-sm text-sky-600 hover:underline">View all →</Link>
        </div>
        {students.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No students yet. Add your first student to get started.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Name</th>
                <th className="py-2">Age</th>
                <th className="py-2">Primary contact</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0, 10).map((s) => {
                const primary = s.parent_contacts.find((c) => c.is_primary)
                return (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{s.name}</td>
                    <td className="py-2">{s.age}</td>
                    <td className="py-2 text-slate-600">{primary ? `${primary.phone}` : '—'}</td>
                    <td className="py-2 text-right">
                      <Link to={`/students/${s.id}/progress`} className="text-sky-600 hover:underline">Progress</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <div className="rounded-lg bg-sky-50 p-3">{icon}</div>
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-800">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  )
}
