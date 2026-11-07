import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Sunrise, Sunset, Trophy, Plus } from 'lucide-react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { useErrorNotice } from '../context/NoticeContext.jsx'

const iso = (d) => d.toISOString().slice(0, 10)

const typeIcon = (type) => {
  if (type === 'morning') return <Sunrise className="h-5 w-5 text-amber-500" />
  if (type === 'evening') return <Sunset className="h-5 w-5 text-indigo-500" />
  return <Trophy className="h-5 w-5 text-purple-500" />
}

export default function SessionList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [date, setDate] = useState(iso(new Date()))
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')
  useErrorNotice(error)

  const load = () => {
    setSessions(null)
    api
      .get(`/club/${user.club_id}/sessions`, { params: { from: date, to: date } })
      .then((res) => setSessions(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load sessions'))
  }

  useEffect(load, [user.club_id, date])

  const shiftDay = (delta) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(iso(d))
  }

  const createSession = async (type) => {
    try {
      const res = await api.post(`/club/${user.club_id}/sessions`, { session_date: date, session_type: type })
      navigate(`/sessions/${res.data.id}/attendance`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create session')
    }
  }

  const otherSessions = sessions?.filter((s) => !['morning', 'evening'].includes(s.session_type)) || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Sessions</h1>
        <button onClick={() => navigate(`/sessions/new?date=${date}`)}
          className="flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Other Session
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => shiftDay(-1)} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none" />
        <button onClick={() => shiftDay(1)} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50">
          <ChevronRight className="h-4 w-4" />
        </button>
        {date !== iso(new Date()) && (
          <button onClick={() => setDate(iso(new Date()))} className="text-sm text-sky-600 hover:underline">Today</button>
        )}
      </div>

      {!sessions ? (
        <LoadingSpinner />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {['morning', 'evening'].map((type) => {
            const s = sessions.find((x) => x.session_type === type)
            return (
              <div key={type} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  {typeIcon(type)}
                  <h2 className="font-semibold capitalize text-slate-800">{type} session</h2>
                </div>
                {s ? (
                  <SessionCardBody session={s} onView={() => navigate(`/sessions/${s.id}/attendance`)} />
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">Not created yet.</p>
                    <button onClick={() => createSession(type)}
                      className="rounded-full border border-sky-600 px-4 py-2 text-sm font-medium text-sky-600 hover:bg-sky-50">
                      Create Session
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {otherSessions.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                {typeIcon(s.session_type)}
                <h2 className="font-semibold capitalize text-slate-800">{s.session_type} session</h2>
              </div>
              <SessionCardBody session={s} onView={() => navigate(`/sessions/${s.id}/attendance`)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SessionCardBody({ session, onView }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <span className="text-slate-600">{session.total_count} students</span>
        <span className="text-green-600">{session.present_count} present</span>
        <span className="text-red-500">{session.absent_count} absent</span>
      </div>
      {session.notes && <p className="text-sm text-slate-500">{session.notes}</p>}
      <button onClick={onView}
        className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
        View Attendance
      </button>
    </div>
  )
}
