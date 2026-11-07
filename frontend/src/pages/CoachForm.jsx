import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useErrorNotice } from '../context/NoticeContext.jsx'

export default function CoachForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '' })
  const [error, setError] = useState('')
  useErrorNotice(error)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post(`/club/${user.club_id}/coaches`, form)
      navigate('/coaches')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add coach')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Add Assistant Coach</h1>

      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Phone *</label>
          <input type="tel" value={form.phone} pattern="[0-9]{10}" required placeholder="10-digit phone"
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none" />
        </div>
        <p className="text-xs text-slate-500">They'll log in with this phone number via OTP as an assistant coach.</p>
        <div className="flex gap-3">
          <button disabled={loading} className="rounded-full bg-sky-600 px-6 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
            {loading ? 'Adding…' : 'Add Coach'}
          </button>
          <button type="button" onClick={() => navigate('/coaches')} className="rounded-lg border border-slate-300 px-6 py-2 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
