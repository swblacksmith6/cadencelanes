import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

const PRESET_TYPES = ['morning', 'evening', 'competition']

export default function SessionCreate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    session_date: searchParams.get('date') || new Date().toISOString().slice(0, 10),
    session_type: searchParams.get('type') || 'morning',
    notes: '',
  })
  const [customType, setCustomType] = useState('')
  const isCustom = form.session_type === '__custom__'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post(`/club/${user.club_id}/sessions`, {
        session_date: form.session_date,
        session_type: isCustom ? customType : form.session_type,
        notes: form.notes || null,
      })
      navigate(`/sessions/${res.data.id}/attendance`)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Create Session</h1>
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
          <input type="date" value={form.session_date} required
            onChange={(e) => setForm({ ...form, session_date: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
          <select value={form.session_type} onChange={(e) => setForm({ ...form, session_type: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm capitalize focus:border-sky-500 focus:outline-none">
            {PRESET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value="__custom__">Custom…</option>
          </select>
        </div>
        {isCustom && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Custom type name</label>
            <input value={customType} required placeholder="e.g. district meet"
              onChange={(e) => setCustomType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
          <textarea value={form.notes} rows={2} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none" />
        </div>
        <p className="text-xs text-slate-500">
          One session per type per day. Attendance is auto-created for all active students, marked present.
        </p>
        <button disabled={loading} className="rounded-full bg-sky-600 px-6 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
          {loading ? 'Creating…' : 'Create Session'}
        </button>
      </form>
    </div>
  )
}
