import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

export default function AdminClubDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [club, setClub] = useState(null)
  const [error, setError] = useState('')

  const load = () => {
    api
      .get(`/admin/clubs/${id}`)
      .then((res) => setClub(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load club'))
  }

  useEffect(load, [id])

  const approve = async () => {
    try {
      await api.post(`/admin/clubs/${id}/approve`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Approve failed')
    }
  }

  const reject = async () => {
    const reason = window.prompt('Reason for rejection:')
    if (!reason) return
    try {
      await api.post(`/admin/clubs/${id}/reject`, { reason })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Reject failed')
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete club "${club.name}" and all its data?`)) return
    try {
      await api.delete(`/admin/clubs/${id}`)
      navigate('/admin')
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed')
    }
  }

  if (error && !club) return <div className="p-6 text-red-700">{error}</div>
  if (!club) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div className="min-h-dvh bg-slate-100 p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/admin" className="text-sm text-sky-600 hover:underline">← All clubs</Link>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">{club.name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {club.head_coach_name} · {club.head_coach_phone}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Registered {club.created_at.slice(0, 10)}
                {club.approved_at && ` · Approved ${club.approved_at.slice(0, 10)}`}
              </p>
              {club.rejection_reason && (
                <p className="mt-2 text-sm text-red-600">Rejection reason: {club.rejection_reason}</p>
              )}
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
              club.status === 'approved' ? 'bg-green-100 text-green-700'
              : club.status === 'pending' ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-600'
            }`}>{club.status}</span>
          </div>

          {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="mt-6 flex gap-3">
            {club.status === 'pending' && (
              <>
                <button onClick={approve} className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Approve</button>
                <button onClick={reject} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">Reject</button>
              </>
            )}
            {club.status === 'approved' && (
              <button onClick={remove} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50">Delete Club</button>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Users</h2>
          {(!club.users || club.users.length === 0) ? (
            <p className="text-sm text-slate-500">No users yet (created on approval).</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Name</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {club.users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{u.name}</td>
                    <td className="py-2">{u.phone}</td>
                    <td className="py-2">{u.role === 'head_coach' ? 'Head Coach' : 'Assistant'}</td>
                    <td className="py-2">{u.is_active ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
