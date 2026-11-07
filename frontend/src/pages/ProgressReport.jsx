import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Printer, Star, Flame } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { exactAge } from '../utils/age.js'
import { useErrorNotice } from '../context/NoticeContext.jsx'

const RATING_LABELS = { 1: 'Beginner', 2: 'Elementary', 3: 'Intermediate', 4: 'Advanced', 5: 'Elite' }

const CATEGORY_COLORS = {
  general: 'bg-slate-100 text-slate-600',
  technique: 'bg-sky-100 text-sky-700',
  fitness: 'bg-green-100 text-green-700',
  behavior: 'bg-amber-100 text-amber-700',
  goal: 'bg-purple-100 text-purple-700',
}

export default function ProgressReport() {
  const { id } = useParams()
  const { user } = useAuth()
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  useErrorNotice(error)
  const [trendKey, setTrendKey] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteCategory, setNoteCategory] = useState('general')
  const [savingNote, setSavingNote] = useState(false)
  const [styles, setStyles] = useState([])
  const [assessStyleId, setAssessStyleId] = useState('')
  const [assessRating, setAssessRating] = useState(0)
  const [savingAssess, setSavingAssess] = useState(false)

  useEffect(() => {
    api
      .get(`/club/${user.club_id}/students/${id}/progress`)
      .then((res) => {
        setReport(res.data)
        const keys = Object.keys(res.data.timing_trends)
        if (keys.length) setTrendKey(keys[0])
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load progress'))
    api.get(`/club/${user.club_id}/swim-styles`).then((res) => {
      setStyles(res.data)
      if (res.data.length) setAssessStyleId(res.data[0].id)
    })
  }, [id, user.club_id])

  const addNote = async (e) => {
    e.preventDefault()
    setSavingNote(true)
    try {
      const res = await api.post(`/club/${user.club_id}/students/${id}/notes`, {
        note: noteText,
        category: noteCategory,
      })
      setReport((r) => ({
        ...r,
        recent_notes: [
          { date: res.data.created_at.slice(0, 10), coach: res.data.coach_name, category: res.data.category, note: res.data.note },
          ...r.recent_notes,
        ],
      }))
      setNoteText('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  const addAssessment = async (e) => {
    e.preventDefault()
    if (!assessRating) return
    setSavingAssess(true)
    try {
      const res = await api.post(`/club/${user.club_id}/students/${id}/assessments`, {
        swim_style_id: assessStyleId,
        rating: assessRating,
      })
      setReport((r) => {
        const prev = r.skill_ratings[res.data.swim_style] || { history: [] }
        return {
          ...r,
          skill_ratings: {
            ...r.skill_ratings,
            [res.data.swim_style]: {
              current: res.data.rating,
              label: res.data.rating_label,
              history: [...prev.history, { date: res.data.assessed_at.slice(0, 10), rating: res.data.rating }],
            },
          },
        }
      })
      setAssessRating(0)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save assessment')
    } finally {
      setSavingAssess(false)
    }
  }

  if (error && !report) return <p className="py-12 text-center text-sm text-slate-500">This page could not load.</p>
  if (!report) return <LoadingSpinner />

  const { student, attendance, personal_bests, timing_trends, skill_ratings, recent_notes } = report
  const trendKeys = Object.keys(timing_trends)
  // Best time for each chip: the recorded personal best, or the fastest point on that trend.
  const pbByLabel = Object.fromEntries(personal_bests.map((pb) => [`${pb.style} ${pb.distance}`, pb.best_time]))
  const bestFor = (k) => {
    const t = timing_trends[k]
    if (pbByLabel[t.label] != null) return pbByLabel[t.label]
    const times = (t.data || []).map((d) => d.time)
    return times.length ? Math.min(...times) : null
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/students" className="no-print text-sm text-sky-600 hover:underline">← Students</Link>
          <h1 className="mt-0.5 text-lg font-bold tracking-tight text-slate-800 md:text-2xl md:font-extrabold">{student.name}</h1>
          <p className="text-xs text-slate-500 md:text-sm">
            Age {exactAge(student.date_of_birth)} · Enrolled since {student.enrolled_since}
          </p>
        </div>
        <button onClick={() => window.print()} aria-label="Print" title="Print"
          className="no-print flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50">
          <Printer className="h-4 w-4" />
        </button>
      </div>

      {/* Attendance */}
      <section className="rounded-2xl bg-white p-3 shadow-sm md:p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-800 md:mb-4 md:text-base">Attendance</h2>
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          <AttendanceRing label="Last 7 days" data={attendance.last_7_days} />
          <AttendanceRing label="Last 30 days" data={attendance.last_30_days} />
          <AttendanceRing label="All time" data={attendance.all_time} />
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center gap-0.5 text-xl font-bold text-orange-500 md:gap-1 md:text-3xl">
              <Flame className="h-5 w-5 md:h-7 md:w-7" /> {attendance.current_streak}
            </div>
            <div className="mt-1 text-center text-[11px] text-slate-500 md:text-sm">Streak</div>
          </div>
        </div>
      </section>

      {/* Personal bests */}
      <section className="rounded-2xl bg-white p-3 shadow-sm md:p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-800 md:mb-4 md:text-base">Personal Bests</h2>
        {personal_bests.length === 0 ? (
          <p className="text-sm text-slate-500">No timings recorded yet.</p>
        ) : (
          <>
          <ul className="divide-y divide-slate-100 md:hidden">
            {personal_bests.map((pb, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800">{pb.style} {pb.distance}</div>
                  <div className="text-[11px] text-slate-400">{pb.achieved_at}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-semibold text-slate-800">{pb.best_time}s</div>
                  <div className="text-[11px]">
                    {pb.improvement != null
                      ? <span className="text-green-600">−{pb.improvement}s</span>
                      : <span className="text-slate-400">first time</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="-mx-1 hidden overflow-x-auto px-1 md:block">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Style</th>
                <th className="py-2">Distance</th>
                <th className="py-2">Best time</th>
                <th className="py-2">Improvement</th>
                <th className="py-2">Achieved</th>
              </tr>
            </thead>
            <tbody>
              {personal_bests.map((pb, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{pb.style}</td>
                  <td className="py-2">{pb.distance}</td>
                  <td className="py-2 font-mono font-semibold">{pb.best_time}s</td>
                  <td className="py-2">
                    {pb.improvement != null
                      ? <span className="text-green-600">−{pb.improvement}s</span>
                      : <span className="text-slate-400">first time</span>}
                  </td>
                  <td className="py-2 text-slate-500">{pb.achieved_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </section>

      {/* Timing trends */}
      {trendKeys.length > 0 && (
        <section className="rounded-2xl bg-white p-3 shadow-sm md:p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-800 md:mb-3 md:text-base">Timing Trends</h2>
          <div role="radiogroup" aria-label="Timing trend" className="no-print mb-3 flex flex-wrap gap-1.5">
            {trendKeys.map((k) => (
              <label key={k}
                className="cursor-pointer rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition has-[:checked]:bg-sky-600 has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sky-500">
                <input type="radio" name="trend" value={k} checked={trendKey === k}
                  onChange={() => setTrendKey(k)} className="sr-only" />
                {timing_trends[k].label}{bestFor(k) != null && ` (PB ${bestFor(k)}s)`}
              </label>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timing_trends[trendKey]?.data || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d6e4dd" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis unit="s" domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${v}s`, 'Time']} />
              <Line type="monotone" dataKey="time" stroke="#5b3fd6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Skill ratings */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">Skill Ratings</h2>

        <form onSubmit={addAssessment} className="no-print mb-5 rounded-lg bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {styles.map((s) => (
                <button key={s.id} type="button" onClick={() => setAssessStyleId(s.id)}
                  title={s.name}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    assessStyleId === s.id ? 'bg-sky-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'
                  }`}>
                  {s.short_code}
                </button>
              ))}
            </div>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setAssessRating(n)}>
                  <Star className={`h-6 w-6 transition ${n <= assessRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300'}`} />
                </button>
              ))}
            </div>
            <span className="w-24 text-xs text-slate-500">
              {assessRating ? RATING_LABELS[assessRating] : 'Tap stars to rate'}
            </span>
            <button disabled={savingAssess || !assessRating}
              className="ml-auto rounded-full bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40">
              {savingAssess ? 'Saving…' : 'Save Rating'}
            </button>
          </div>
        </form>

        {Object.keys(skill_ratings).length === 0 ? (
          <p className="text-sm text-slate-500">No assessments yet.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(skill_ratings).map(([style, r]) => (
              <div key={style} className="flex items-center justify-between">
                <span className="font-medium text-slate-800">{style}</span>
                <div className="flex items-center gap-3">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-5 w-5 ${n <= r.current ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </div>
                  <span className="w-28 text-right text-sm text-slate-500">{r.label}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Coach notes */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">Coach Notes</h2>

        <form onSubmit={addNote} className="no-print mb-5 space-y-2 rounded-lg bg-slate-50 p-3">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            required
            rows={2}
            placeholder="Add an observation… e.g. Breathing rhythm improving on freestyle"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(CATEGORY_COLORS).map((c) => (
                <button key={c} type="button" onClick={() => setNoteCategory(c)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                    noteCategory === c ? CATEGORY_COLORS[c] + ' ring-2 ring-sky-400' : 'bg-white text-slate-500 hover:bg-slate-100'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
            <button disabled={savingNote || !noteText.trim()}
              className="rounded-full bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40">
              {savingNote ? 'Saving…' : 'Add Note'}
            </button>
          </div>
        </form>

        {recent_notes.length === 0 ? (
          <p className="text-sm text-slate-500">No notes yet.</p>
        ) : (
          <div className="space-y-4">
            {recent_notes.map((n, i) => (
              <div key={i} className="border-l-2 border-sky-200 pl-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{n.date}</span>
                  <span>·</span>
                  <span>{n.coach}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${CATEGORY_COLORS[n.category] || CATEGORY_COLORS.general}`}>
                    {n.category}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{n.note}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AttendanceRing({ label, data }) {
  const pct = data.percentage
  return (
    <div className="flex flex-col items-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full md:h-20 md:w-20"
        style={{ background: `conic-gradient(#5b3fd6 ${pct * 3.6}deg, #d6e4dd 0deg)` }}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-800 md:h-16 md:w-16 md:text-sm">
          {data.total ? `${Math.round(pct)}%` : '—'}
        </div>
      </div>
      <div className="mt-1 text-center text-[11px] text-slate-500 md:mt-2 md:text-sm">{label}</div>
      <div className="text-[10px] text-slate-400 md:text-xs">{data.attended}/{data.total}<span className="hidden md:inline"> sessions</span></div>
    </div>
  )
}
