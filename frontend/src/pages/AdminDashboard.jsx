import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Waves, LogOut, Plus } from 'lucide-react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

const TABS = ['pending', 'approved', 'rejected', 'all']

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

export default function AdminDashboard() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const [clubs, setClubs] = useState(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', head_coach_name: '', head_coach_phone: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setClubs(null)
    const params = tab === 'all' ? {} : { status: tab }
    api
      .get('/admin/clubs', { params })
      .then((res) => setClubs(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load clubs'))
  }

  useEffect(load, [tab])

  const createClub = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/admin/clubs', form)
      setForm({ name: '', head_coach_name: '', head_coach_phone: '' })
      setShowForm(false)
      if (tab === 'approved') load()
      else setTab('approved')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create the club')
    } finally {
      setSaving(false)
    }
  }

  const approve = async (club) => {
    try {
      await api.post(`/admin/clubs/${club.id}/approve`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Approve failed')
    }
  }

  const reject = async (club) => {
    const reason = window.prompt(`Reason for rejecting "${club.name}":`)
    if (!reason) return
    try {
      await api.post(`/admin/clubs/${club.id}/reject`, { reason })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Reject failed')
    }
  }

  const remove = async (club) => {
    if (!window.confirm(`Delete club "${club.name}" and all its data? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/clubs/${club.id}`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed')
    }
  }

  return (
    <div className="min-h-dvh bg-slate-100">
      <header className="flex items-center justify-between bg-slate-800 px-6 py-3 text-white">
        <div className="flex items-center gap-2">
          <Waves className="h-6 w-6 text-sky-400" />
          <span className="font-bold">Cadence Lanes Admin</span>
        </div>
        <button onClick={() => { logout(); navigate('/login') }}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Clubs</h1>
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            <Plus className="h-4 w-4" /> Add club
          </button>
        </div>

        {showForm && (
          <form onSubmit={createClub} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-4">
            <input required placeholder="Club name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
            <input required placeholder="Head coach name" value={form.head_coach_name}
              onChange={(e) => setForm({ ...form, head_coach_name: e.target.value })}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
            <input required type="tel" placeholder="Head coach phone (10 digits)" pattern="[0-9]{10}"
              value={form.head_coach_phone}
              onChange={(e) => setForm({ ...form, head_coach_phone: e.target.value })}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
            <button disabled={saving}
              className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create and approve'}
            </button>
          </form>
        )}

        <div className="flex gap-2">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                tab === t ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {!clubs ? (
          <LoadingSpinner />
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Head coach</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clubs.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/admin/clubs/${c.id}`} className="font-medium text-sky-600 hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3">{c.head_coach_name}</td>
                    <td className="px-4 py-3">{c.head_coach_phone}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.created_at.slice(0, 10)}</td>
                    <td className="space-x-3 whitespace-nowrap px-4 py-3 text-right">
                      {c.status === 'pending' && (
                        <>
                          <button onClick={() => approve(c)} className="font-medium text-green-600 hover:underline">Approve</button>
                          <button onClick={() => reject(c)} className="font-medium text-red-500 hover:underline">Reject</button>
                        </>
                      )}
                      {c.status === 'approved' && (
                        <button onClick={() => remove(c)} className="font-medium text-red-500 hover:underline">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
                {clubs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No clubs in this list.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
