import { useEffect, useRef, useState } from 'react'
import { Check, PartyPopper, Sunrise, Sunset, Trophy } from 'lucide-react'
import api from '../api/client.js'
import { exactAge } from '../utils/age.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

const today = () => new Date().toISOString().slice(0, 10)

// Accepts "32.45" (seconds) or "1:05.3" (min:sec)
function parseTime(raw) {
  const v = raw.trim()
  if (!v) return null
  if (v.includes(':')) {
    const [m, s] = v.split(':')
    const secs = parseInt(m, 10) * 60 + parseFloat(s)
    return isNaN(secs) || secs <= 0 ? null : Math.round(secs * 100) / 100
  }
  const secs = parseFloat(v)
  return isNaN(secs) || secs <= 0 ? null : secs
}

const sessionIcon = (type) =>
  type === 'morning' ? <Sunrise className="h-4 w-4" />
  : type === 'evening' ? <Sunset className="h-4 w-4" />
  : <Trophy className="h-4 w-4" />

export default function TimingEntry() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState(null)
  const [sessionId, setSessionId] = useState('')
  const [styles, setStyles] = useState([])
  const [distances, setDistances] = useState([])
  const [styleId, setStyleId] = useState(localStorage.getItem('qe_style') || '')
  const [distanceId, setDistanceId] = useState(localStorage.getItem('qe_dist') || '')
  const [rows, setRows] = useState([]) // {student_id, student_name, input, saved:{time,isPB,improvement}|null, error}
  const [sessionTimings, setSessionTimings] = useState([])
  const [error, setError] = useState('')
  const inputRefs = useRef({})

  // Load today's sessions + reference data; auto-pick the current session
  useEffect(() => {
    Promise.all([
      api.get(`/club/${user.club_id}/sessions`, { params: { from: today(), to: today() } }),
      api.get(`/club/${user.club_id}/swim-styles`),
      api.get(`/club/${user.club_id}/distance-events`),
    ])
      .then(([se, st, di]) => {
        setSessions(se.data)
        setStyles(st.data)
        setDistances(di.data)
        setStyleId((prev) => (st.data.some((x) => x.id === prev) ? prev : st.data[0]?.id || ''))
        setDistanceId((prev) => (di.data.some((x) => x.id === prev) ? prev : di.data[1]?.id || di.data[0]?.id || ''))
        if (se.data.length > 0) {
          const preferred = new Date().getHours() < 14 ? 'morning' : 'evening'
          const match = se.data.find((x) => x.session_type === preferred)
          setSessionId((match || se.data[0]).id)
        }
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
  }, [user.club_id])

  // Load present students + existing timings when the session changes
  useEffect(() => {
    if (!sessionId) return
    Promise.all([
      api.get(`/club/${user.club_id}/sessions/${sessionId}/attendance`),
      api.get(`/club/${user.club_id}/timings/session/${sessionId}`),
    ]).then(([att, tim]) => {
      setRows(
        att.data
          .filter((a) => a.status === 'present')
          .map((a) => ({
            student_id: a.student_id,
            student_name: a.student_name,
            date_of_birth: a.date_of_birth,
            input: '', saved: null, error: false,
          }))
      )
      setSessionTimings(tim.data)
    })
  }, [sessionId, user.club_id])

  const pickStyle = (id) => { setStyleId(id); localStorage.setItem('qe_style', id) }
  const pickDistance = (id) => { setDistanceId(id); localStorage.setItem('qe_dist', id) }

  const createSession = async (type) => {
    setError('')
    try {
      const res = await api.post(`/club/${user.club_id}/sessions`, { session_date: today(), session_type: type })
      setSessions((prev) => [...(prev || []), res.data])
      setSessionId(res.data.id)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create session')
    }
  }

  const save = async (idx) => {
    const row = rows[idx]
    const secs = parseTime(row.input)
    if (secs == null) {
      setRows((r) => r.map((x, i) => (i === idx ? { ...x, error: true } : x)))
      return
    }
    try {
      const res = await api.post(`/club/${user.club_id}/timings`, {
        session_id: sessionId,
        student_id: row.student_id,
        swim_style_id: styleId,
        distance_event_id: distanceId,
        time_seconds: secs,
      })
      setRows((r) =>
        r.map((x, i) =>
          i === idx
            ? { ...x, input: '', error: false, saved: { time: secs, isPB: res.data.is_new_pb, improvement: res.data.improvement } }
            : x
        )
      )
      setSessionTimings((t) => [...t, res.data])
      // jump focus to the next swimmer without a saved time
      const next = rows.findIndex((x, i) => i > idx && !x.saved)
      if (next !== -1) inputRefs.current[next]?.focus()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save timing')
    }
  }

  if (error && !sessions) return <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
  if (!sessions) return <LoadingSpinner />

  // previous times already recorded in this session for the selected style+distance
  const priorFor = (studentId) =>
    sessionTimings
      .filter((t) => t.student_id === studentId && t.swim_style_id === styleId && t.distance_event_id === distanceId)
      .map((t) => t.time_seconds)

  const style = styles.find((s) => s.id === styleId)
  const distance = distances.find((d) => d.id === distanceId)

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Record Timings</h1>
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Session — auto-picked, tap to switch */}
      {sessions.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm text-slate-600">No session today yet. Start one:</p>
          <div className="flex gap-3">
            <button onClick={() => createSession('morning')}
              className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 font-medium text-white hover:bg-amber-600">
              <Sunrise className="h-4 w-4" /> Morning
            </button>
            <button onClick={() => createSession('evening')}
              className="flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2.5 font-medium text-white hover:bg-indigo-600">
              <Sunset className="h-4 w-4" /> Evening
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sessions.map((s) => (
            <button key={s.id} onClick={() => setSessionId(s.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
                s.id === sessionId ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'
              }`}>
              {sessionIcon(s.session_type)} Today · {s.session_type}
            </button>
          ))}
        </div>
      )}

      {/* Set: style + distance chosen once, remembered */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap gap-2">
          {styles.map((s) => (
            <button key={s.id} onClick={() => pickStyle(s.id)}
              className={`min-w-12 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                s.id === styleId ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {s.short_code}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {distances.map((d) => (
            <button key={d.id} onClick={() => pickDistance(d.id)}
              className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                d.id === distanceId ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {d.label}
            </button>
          ))}
        </div>
        {style && distance && (
          <p className="mt-3 text-sm font-medium text-slate-500">
            Set: {style.name} {distance.label} — type each time and press Enter
          </p>
        )}
      </div>

      {/* Swimmers: one tap-and-type row each */}
      {sessionId && (
        <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
          {rows.map((row, idx) => {
            const prior = priorFor(row.student_id)
            return (
              <div key={row.student_id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800">{row.student_name}</div>
                  <div className="text-xs text-slate-400">{exactAge(row.date_of_birth)}</div>
                  {row.saved ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-mono text-slate-600">{row.saved.time}s saved</span>
                      {row.saved.isPB && (
                        <span className="flex items-center gap-1 font-medium text-green-600">
                          <PartyPopper className="h-4 w-4" />
                          PB{row.saved.improvement ? ` −${row.saved.improvement}s` : ''}
                        </span>
                      )}
                    </div>
                  ) : prior.length > 0 ? (
                    <div className="text-xs text-slate-400">this session: {prior.join('s, ')}s</div>
                  ) : null}
                </div>
                <input
                  ref={(el) => (inputRefs.current[idx] = el)}
                  inputMode="decimal"
                  placeholder="32.45"
                  value={row.input}
                  onChange={(e) =>
                    setRows((r) => r.map((x, i) => (i === idx ? { ...x, input: e.target.value, error: false } : x)))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && save(idx)}
                  className={`w-24 rounded-lg border px-3 py-2.5 text-right font-mono text-base focus:outline-none ${
                    row.error ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-sky-500'
                  }`}
                />
                <button onClick={() => save(idx)} disabled={!row.input}
                  className="rounded-full bg-sky-600 p-2.5 text-white hover:bg-sky-700 disabled:opacity-30">
                  <Check className="h-5 w-5" />
                </button>
              </div>
            )
          })}
          {rows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No students marked present in this session.</p>
          )}
        </div>
      )}
    </div>
  )
}
