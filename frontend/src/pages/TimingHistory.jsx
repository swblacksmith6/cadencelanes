import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

export default function TimingHistory() {
  const { id } = useParams()
  const { user } = useAuth()
  const [student, setStudent] = useState(null)
  const [styles, setStyles] = useState([])
  const [distances, setDistances] = useState([])
  const [styleId, setStyleId] = useState('')
  const [distanceId, setDistanceId] = useState('')
  const [timings, setTimings] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get(`/club/${user.club_id}/students/${id}`),
      api.get(`/club/${user.club_id}/swim-styles`),
      api.get(`/club/${user.club_id}/distance-events`),
    ])
      .then(([st, sy, di]) => {
        setStudent(st.data)
        setStyles(sy.data)
        setDistances(di.data)
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
  }, [id, user.club_id])

  useEffect(() => {
    const params = { student_id: id }
    if (styleId) params.style_id = styleId
    if (distanceId) params.distance_id = distanceId
    api.get(`/club/${user.club_id}/timings`, { params }).then((res) => setTimings(res.data))
  }, [id, styleId, distanceId, user.club_id])

  if (error) return <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
  if (!student || !timings) return <LoadingSpinner />

  const chartData = [...timings]
    .sort((a, b) => a.session_date.localeCompare(b.session_date))
    .map((t) => ({ date: t.session_date, time: t.time_seconds }))
  const showChart = styleId && distanceId && chartData.length > 1

  return (
    <div className="space-y-4">
      <div>
        <Link to="/students" className="text-sm text-sky-600 hover:underline">← Students</Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-800">{student.name} — Timing History</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={styleId} onChange={(e) => setStyleId(e.target.value)}
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none">
          <option value="">All styles</option>
          {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={distanceId} onChange={(e) => setDistanceId(e.target.value)}
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none">
          <option value="">All distances</option>
          {distances.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </div>

      {showChart && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Time trend (lower is better)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d6e4dd" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis unit="s" domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${v}s`, 'Time']} />
              <Line type="monotone" dataKey="time" stroke="#5b3fd6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="space-y-3 md:hidden">
        {timings.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <div className="font-bold text-slate-800">{t.style} {t.distance}</div>
              <div className="text-xs capitalize text-slate-500">{t.session_date} · {t.session_type}</div>
              {t.notes && <div className="mt-1 text-sm text-slate-500">{t.notes}</div>}
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-lg font-medium text-slate-800">{t.time_seconds}s</div>
              {t.is_pb && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">PB</span>}
            </div>
          </li>
        ))}
        {timings.length === 0 && <li className="py-8 text-center text-sm text-slate-500">No timings recorded yet.</li>}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Style</th>
              <th className="px-4 py-3">Distance</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {timings.map((t) => (
              <tr key={t.id} className="border-b border-slate-100">
                <td className="px-4 py-3">{t.session_date}</td>
                <td className="px-4 py-3 capitalize">{t.session_type}</td>
                <td className="px-4 py-3">{t.style}</td>
                <td className="px-4 py-3">{t.distance}</td>
                <td className="px-4 py-3 font-mono">
                  {t.time_seconds}s{' '}
                  {t.is_pb && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">PB</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{t.notes || '—'}</td>
              </tr>
            ))}
            {timings.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No timings recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
