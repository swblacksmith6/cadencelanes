import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { exactAge } from '../utils/age.js'
import { useErrorNotice } from '../context/NoticeContext.jsx'

export default function StudentList() {
  const { user } = useAuth()
  const [students, setStudents] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  useErrorNotice(error)

  useEffect(() => {
    api
      .get(`/club/${user.club_id}/students`, { params: { include_inactive: true } })
      .then((res) => setStudents(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load students'))
  }, [user.club_id])

  if (error) return <p className="py-12 text-center text-sm text-slate-500">This page could not load.</p>
  if (!students) return <LoadingSpinner />

  const filtered = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-2.5 md:space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight text-slate-800 md:text-2xl md:font-extrabold">Students</h1>
        <Link to="/students/new" className="flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 md:gap-2 md:px-4 md:py-2 md:text-base">
          <Plus className="h-4 w-4" /> Add Student
        </Link>
      </div>

      <div className="relative md:max-w-xs">
        <Search className="absolute left-3 top-2 h-4 w-4 md:top-3 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-xl border border-slate-300 py-1.5 pl-9 pr-3 text-sm md:py-2.5 focus:border-sky-500 focus:outline-none"
        />
      </div>

      {/* Phone: one card per swimmer. Wider screens: full table below. */}
      <ul className="space-y-1.5 md:hidden">
        {filtered.map((s) => {
          const primary = s.parent_contacts.find((c) => c.is_primary)
          return (
            <li key={s.id} className="rounded-xl bg-white px-3 py-2 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{s.name}</div>
                  <div className="text-[11px] leading-tight text-slate-500">{exactAge(s.date_of_birth)} · born {s.date_of_birth}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-600">
                {primary ? `${primary.name || primary.relation} · ${primary.phone}` : '—'}
              </div>
              <div className="mt-1.5 flex gap-1.5 text-xs font-semibold">
                <Link to={`/students/${s.id}/progress`} className="flex-1 rounded-full bg-sky-50 py-1 text-center text-sky-700">Progress</Link>
                <Link to={`/students/${s.id}/timings`} className="flex-1 rounded-full bg-sky-50 py-1 text-center text-sky-700">Timings</Link>
                <Link to={`/students/${s.id}/edit`} className="flex-1 rounded-full bg-slate-100 py-1 text-center text-slate-600">Edit</Link>
              </div>
            </li>
          )
        })}
        {filtered.length === 0 && <li className="py-8 text-center text-sm text-slate-500">No students found.</li>}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm md:block">
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
