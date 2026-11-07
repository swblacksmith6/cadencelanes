import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { useErrorNotice } from '../context/NoticeContext.jsx'

export default function CoachList() {
  const { user } = useAuth()
  const [coaches, setCoaches] = useState(null)
  const [error, setError] = useState('')
  useErrorNotice(error)

  const load = () => {
    api
      .get(`/club/${user.club_id}/coaches`)
      .then((res) => setCoaches(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load coaches'))
  }

  useEffect(load, [user.club_id])

  const toggleActive = async (coach) => {
    try {
      await api.put(`/club/${user.club_id}/coaches/${coach.id}`, { is_active: !coach.is_active })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Update failed')
    }
  }

  if (error) return <p className="py-12 text-center text-sm text-slate-500">This page could not load.</p>
  if (!coaches) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Coaches</h1>
        <Link to="/coaches/new" className="flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Add Assistant Coach
        </Link>
      </div>

      <ul className="space-y-3 md:hidden">
        {coaches.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-800">{c.name}</div>
              <div className="text-sm text-slate-500">{c.phone} · {c.role === 'head_coach' ? 'Head Coach' : 'Assistant'}</div>
              <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                {c.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {c.role !== 'head_coach' && (
              <button onClick={() => toggleActive(c)} className="shrink-0 rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
                {c.is_active ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coaches.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3">{c.role === 'head_coach' ? 'Head Coach' : 'Assistant'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {c.role !== 'head_coach' && (
                    <button onClick={() => toggleActive(c)} className="text-sky-600 hover:underline">
                      {c.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
