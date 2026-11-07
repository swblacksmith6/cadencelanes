import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

export default function AttendanceView() {
  const { id } = useParams()
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [rows, setRows] = useState([])
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .get(`/club/${user.club_id}/sessions/${id}`)
      .then((res) => {
        setSession(res.data)
        setRows(res.data.attendance)
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load session'))
  }, [id, user.club_id])

  const toggle = (studentId) => {
    setRows((prev) =>
      prev.map((r) =>
        r.student_id === studentId ? { ...r, status: r.status === 'present' ? 'absent' : 'present' } : r
      )
    )
    setDirty(true)
    setSaved(false)
  }

  const saveAll = async () => {
    setSaving(true)
    setError('')
    try {
      await api.put(`/club/${user.club_id}/sessions/${id}/attendance`, {
        updates: rows.map((r) => ({ student_id: r.student_id, status: r.status })),
      })
      setDirty(false)
      setSaved(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  if (error && !session) return <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
  if (!session) return <LoadingSpinner />

  const present = rows.filter((r) => r.status === 'present').length

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link to="/sessions" className="text-sm text-sky-600 hover:underline">← Sessions</Link>
        <h1 className="mt-1 text-2xl font-bold capitalize text-slate-800">
          {session.session_type} session · {session.session_date}
        </h1>
        <p className="text-sm text-slate-500">Created by {session.created_by_name}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-y-1 text-sm">
          <span className="font-semibold text-green-600">{present} present</span>
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-semibold text-red-500">{rows.length - present} absent</span>
          <span className="mx-2 text-slate-300">·</span>
          <span className="text-slate-500">{rows.length} total</span>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
          <button onClick={saveAll} disabled={!dirty || saving}
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40">
            {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm [&>div]:gap-3">
        {rows.map((r) => (
          <div key={r.student_id} className="flex items-center justify-between px-4 py-3">
            <span className="min-w-0 truncate font-semibold text-slate-800">{r.student_name}</span>
            <button
              onClick={() => toggle(r.student_id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                r.status === 'present'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            >
              {r.status === 'present' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {r.status === 'present' ? 'Present' : 'Absent'}
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No students in this session.</p>}
      </div>
    </div>
  )
}
