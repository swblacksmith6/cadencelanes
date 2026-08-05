import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

export default function CoachList() {
  const { user } = useAuth()
  const [coaches, setCoaches] = useState(null)
  const [error, setError] = useState('')

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

  if (error) return <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
  if (!coaches) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Coaches</h1>
        <Link to="/coaches/new" className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Add Assistant Coach
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
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
