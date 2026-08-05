import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { exactAge } from '../utils/age.js'

export default function StudentList() {
  const { user } = useAuth()
  const [students, setStudents] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get(`/club/${user.club_id}/students`, { params: { include_inactive: true } })
      .then((res) => setStudents(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load students'))
  }, [user.club_id])

  if (error) return <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
  if (!students) return <LoadingSpinner />

  const filtered = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Students</h1>
        <Link to="/students/new" className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Add Student
        </Link>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Date of birth</th>
              <th className="px-4 py-3">Primary contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const primary = s.parent_contacts.find((c) => c.is_primary)
              return (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{s.name}</div>
                    <div className="text-xs text-slate-400">{exactAge(s.date_of_birth)}</div>
                  </td>
                  <td className="px-4 py-3">{s.age}</td>
                  <td className="px-4 py-3">{s.date_of_birth}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {primary ? `${primary.name || primary.relation} · ${primary.phone}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <Link to={`/students/${s.id}/progress`} className="text-sky-600 hover:underline">Progress</Link>
                    <Link to={`/students/${s.id}/timings`} className="text-sky-600 hover:underline">Timings</Link>
                    <Link to={`/students/${s.id}/edit`} className="text-slate-500 hover:underline">Edit</Link>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No students found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
