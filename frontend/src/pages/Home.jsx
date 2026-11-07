import { Link, Navigate } from 'react-router-dom'
import { Waves } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Home() {
  const { user } = useAuth()
  if (user) return <Navigate to={user.role === 'super_admin' ? '/admin' : '/dashboard'} replace />

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-800 px-6 pt-safe pb-safe text-center text-white">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-sky-600/90"><Waves className="h-12 w-12 text-white" /></div>
      <h1 className="text-4xl font-extrabold tracking-tight">Cadence Lanes</h1>
      <p className="mt-2 text-slate-300">Track every lap. Grow every swimmer.</p>
      <div className="mt-10 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link
          to="/login"
          className="rounded-full bg-sky-400 px-8 py-3.5 text-center font-bold text-slate-900 shadow hover:bg-sky-300"
        >
          Login
        </Link>
        <Link
          to="/register"
          className="rounded-full border-2 border-slate-400 px-8 py-3.5 text-center font-bold text-white hover:bg-white/10"
        >
          Register Club
        </Link>
      </div>
    </div>
  )
}
