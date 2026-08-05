import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

const emptyContact = (isPrimary) => ({ relation: 'father', name: '', phone: '', is_primary: isPrimary })

export default function StudentForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', date_of_birth: '', address: '' })
  const [contact1, setContact1] = useState(emptyContact(true))
  const [hasContact2, setHasContact2] = useState(false)
  const [contact2, setContact2] = useState(emptyContact(false))
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    api.get(`/club/${user.club_id}/students/${id}`).then((res) => {
      const s = res.data
      setForm({ name: s.name, date_of_birth: s.date_of_birth, address: s.address || '' })
      setIsActive(s.is_active)
      const primary = s.parent_contacts.find((c) => c.is_primary)
      const secondary = s.parent_contacts.find((c) => !c.is_primary)
      if (primary) setContact1({ relation: primary.relation, name: primary.name || '', phone: primary.phone, is_primary: true })
      if (secondary) {
        setHasContact2(true)
        setContact2({ relation: secondary.relation, name: secondary.name || '', phone: secondary.phone, is_primary: false })
      }
    })
  }, [id, isEdit, user.club_id])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const contacts = [contact1, ...(hasContact2 ? [contact2] : [])].map((c) => ({
      ...c,
      name: c.name || null,
    }))
    const payload = { ...form, address: form.address || null, parent_contacts: contacts }
    try {
      if (isEdit) {
        await api.put(`/club/${user.club_id}/students/${id}`, { ...payload, is_active: isActive })
      } else {
        await api.post(`/club/${user.club_id}/students`, payload)
      }
      navigate('/students')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Please check the form fields')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{isEdit ? 'Edit Student' : 'Add Student'}</h1>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">Student details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="input" />
            </Field>
            <Field label="Date of birth *">
              <input type="date" value={form.date_of_birth} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} required className="input" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="input" />
              </Field>
            </div>
            {isEdit && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
            )}
          </div>
        </section>

        <ContactSection title="Parent Contact 1 (Primary)" contact={contact1} setContact={setContact1} />

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={hasContact2} onChange={(e) => setHasContact2(e.target.checked)} />
            Add second contact
          </label>
          {hasContact2 && (
            <div className="mt-4">
              <ContactFields contact={contact2} setContact={setContact2} />
            </div>
          )}
        </section>

        <div className="flex gap-3">
          <button disabled={loading} className="rounded-lg bg-sky-600 px-6 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
            {loading ? 'Saving…' : 'Save Student'}
          </button>
          <button type="button" onClick={() => navigate('/students')} className="rounded-lg border border-slate-300 px-6 py-2 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>

      <style>{`.input { width: 100%; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; } .input:focus { outline: none; border-color: #0ea5e9; }`}</style>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}

function ContactSection({ title, contact, setContact }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Primary</span>
      </div>
      <ContactFields contact={contact} setContact={setContact} />
    </section>
  )
}

function ContactFields({ contact, setContact }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Relation *">
        <select value={contact.relation} onChange={(e) => setContact({ ...contact, relation: e.target.value })} className="input">
          <option value="father">Father</option>
          <option value="mother">Mother</option>
          <option value="guardian">Guardian</option>
        </select>
      </Field>
      <Field label="Name">
        <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="input" />
      </Field>
      <Field label="Phone *">
        <input type="tel" value={contact.phone} pattern="[0-9]{10}" required
          onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="input" />
      </Field>
    </div>
  )
}
