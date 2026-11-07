import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { useErrorNotice, useNotice } from '../context/NoticeContext.jsx'

export default function AttendanceView() {
  const { id } = useParams()
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [rows, setRows] = useState([])
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  useErrorNotice(error)
  const { notify } = useNotice()
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
  }

  const saveAll = async () => {
    setSaving(true)
    setError('')
    try {
      await api.put(`/club/${user.club_id}/sessions/${id}/attendance`, {
        updates: rows.map((r) => ({ student_id: r.student_id, status: r.status })),
      })
      setDirty(false)
      notify('Attendance saved', 'success')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  if (error && !session) return <p className="py-12 text-center text-sm text-slate-500">This page could not load.</p>
  if (!session) return <LoadingSpinner />

  const present = rows.filter((r) => r.status === 'present').length

  return (
    <div className="mx-auto max-w-2xl space-y-2.5">
      <div>
        <Link to="/sessions" className="text-sm text-sky-600 hover:underline">← Sessions</Link>
        <h1 className="text-lg font-bold capitalize text-slate-800">
          {session.session_type} session · {session.session_date}
        </h1>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-1.5 shadow-sm">
        <div className="flex flex-wrap items-center text-xs">
          <span className="font-semibold text-green-600">{present} present</span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="font-semibold text-red-500">{rows.length - present} absent</span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="text-slate-500">{rows.length} total</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveAll} disabled={!dirty || saving}
            className="rounded-full bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40">
            {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm [&>div]:gap-3">
        {rows.map((r) => (
          <div key={r.student_id} className="flex items-center justify-between px-3 py-1">
            <span className="min-w-0 truncate text-sm font-medium text-slate-800">{r.student_name}</span>
            <button
              onClick={() => toggle(r.student_id)}
              aria-label={`${r.student_name}: ${r.status === 'present' ? 'Present' : 'Absent'}. Tap to change.`}
              className={`flex h-7 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                r.status === 'present'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            >
              {r.status === 'present' ? 'P' : 'A'}
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No students in this session.</p>}
      </div>
    </div>
  )
}
