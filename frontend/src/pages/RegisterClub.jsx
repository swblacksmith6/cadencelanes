import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Waves, CheckCircle } from 'lucide-react'
import api from '../api/client.js'
import { NoticeBar, useErrorNotice } from '../context/NoticeContext.jsx'

export default function RegisterClub() {
  const [form, setForm] = useState({ name: '', head_coach_name: '', head_coach_phone: '' })
  const [error, setError] = useState('')
  useErrorNotice(error)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/register-club', form)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-safe py-8">
      <NoticeBar floating />
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h2 className="text-lg font-semibold text-slate-800">Registration submitted!</h2>
          <p className="mt-2 text-sm text-slate-600">You'll be notified once approved.</p>
          <Link to="/" className="mt-6 inline-block text-sky-600 hover:underline">← Back to home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-safe py-8">
      <NoticeBar floating />
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center justify-center gap-2 text-sky-600">
          <Waves className="h-7 w-7" />
          <span className="text-xl font-bold">Register Your Club</span>
        </div>


        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Club name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Head coach name</label>
            <input
              value={form.head_coach_name}
              onChange={(e) => setForm({ ...form, head_coach_name: e.target.value })}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Head coach phone</label>
            <input
              type="tel"
              value={form.head_coach_phone}
              onChange={(e) => setForm({ ...form, head_coach_phone: e.target.value })}
              required
              pattern="[0-9]{10}"
              placeholder="10-digit phone"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <button
            disabled={loading}
            className="w-full rounded-full bg-sky-600 py-3 font-bold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit Registration'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already approved? <Link to="/login" className="text-sky-600 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  )
}
